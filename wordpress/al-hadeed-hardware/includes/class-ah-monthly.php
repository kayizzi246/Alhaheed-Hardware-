<?php
/**
 * The month, all of it, in one place.
 *
 * Not another chart. This is the thing a manager prints, takes to the
 * accountant, or files — what came in, what went out, what is still
 * owed to the shop and what the shop still owes, with the detail
 * behind each figure rather than only the totals.
 *
 * It is one call rather than seven because a monthly report is read as
 * a whole: a sales figure means something different beside the
 * expenses that month, and asking the panel to stitch seven responses
 * together is how two numbers end up disagreeing on the same page.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Monthly {

	public static function routes() {
		register_rest_route(
			AH_Rest::NS,
			'/reports/monthly',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => AH_Rest::desk( array( 'manager', 'accounts' ) ),
				'callback'            => array( __CLASS__, 'report' ),
			)
		);

		register_rest_route(
			AH_Rest::NS,
			'/reports/months',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => AH_Rest::desk( array( 'manager', 'accounts' ) ),
				'callback'            => array( __CLASS__, 'months' ),
			)
		);
	}

	/**
	 * Which months have anything in them.
	 *
	 * So the picker offers months the shop actually traded rather than
	 * a list of every month since the epoch, most of which are empty.
	 */
	public static function months() {
		global $wpdb;
		$pay = AH_Install::table( 'payments' );

		$rows = $wpdb->get_col( "SELECT DISTINCT DATE_FORMAT(created_at, '%Y-%m') FROM {$pay} ORDER BY 1 DESC" );
		$out  = array();

		foreach ( (array) $rows as $m ) {
			$out[] = array(
				'month' => $m,
				'label' => date_i18n( 'F Y', strtotime( $m . '-01' ) ),
			);
		}

		// There is always this month, even on a shop that has taken
		// nothing yet — otherwise the picker is empty on day one.
		$now = current_time( 'Y-m' );
		if ( ! in_array( $now, (array) $rows, true ) ) {
			array_unshift( $out, array( 'month' => $now, 'label' => date_i18n( 'F Y', current_time( 'timestamp' ) ) ) );
		}

		return array( 'months' => $out );
	}

	public static function report( $req ) {
		global $wpdb;

		$month = (string) $req->get_param( 'month' );
		if ( ! preg_match( '/^\d{4}-\d{2}$/', $month ) ) {
			$month = current_time( 'Y-m' );
		}

		$from = $month . '-01';
		$to   = gmdate( 'Y-m-t', strtotime( $from ) );

		$pay   = AH_Install::table( 'payments' );
		$book  = AH_Install::table( 'cash_book' );
		$spend = AH_Install::table( 'expenses' );

		// ── What came in ───────────────────────────────────────────────
		$takings = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT COUNT(*) AS receipts, COALESCE(SUM(amount_paid),0) AS gross
				   FROM {$pay} WHERE DATE(created_at) BETWEEN %s AND %s AND verified = 1",
				$from,
				$to
			),
			ARRAY_A
		);

		$by_method = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT method, COUNT(*) AS receipts, COALESCE(SUM(amount_paid),0) AS total
				   FROM {$pay} WHERE DATE(created_at) BETWEEN %s AND %s AND verified = 1
				  GROUP BY method ORDER BY total DESC",
				$from,
				$to
			),
			ARRAY_A
		);

		$by_day = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT DATE(created_at) AS day, COUNT(*) AS receipts, COALESCE(SUM(amount_paid),0) AS total
				   FROM {$pay} WHERE DATE(created_at) BETWEEN %s AND %s AND verified = 1
				  GROUP BY day ORDER BY day",
				$from,
				$to
			),
			ARRAY_A
		);

		// ── What went out ──────────────────────────────────────────────
		$expenses = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT ref, kind, details, amount, status, method, created_at, paid_at
				   FROM {$spend} WHERE DATE(created_at) BETWEEN %s AND %s ORDER BY id",
				$from,
				$to
			),
			ARRAY_A
		);

		$spent = 0;
		foreach ( $expenses as $e ) {
			if ( 'paid' === $e['status'] ) {
				$spent += (int) $e['amount'];
			}
		}

		// ── The book ───────────────────────────────────────────────────
		$cash = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT COALESCE(SUM(cash_in),0) AS cash_in, COALESCE(SUM(cash_out),0) AS cash_out
				   FROM {$book} WHERE entry_date BETWEEN %s AND %s",
				$from,
				$to
			),
			ARRAY_A
		);

		$opening = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COALESCE(SUM(cash_in - cash_out),0) FROM {$book} WHERE entry_date < %s", $from )
		);

		// ── Orders ─────────────────────────────────────────────────────
		$orders = wc_get_orders(
			array(
				'limit'        => -1,
				'date_created' => $from . '...' . $to,
				'return'       => 'ids',
			)
		);

		$by_status = array();
		$lines     = array();
		$sold      = array();

		foreach ( $orders as $id ) {
			$order = wc_get_order( $id );
			if ( ! $order ) {
				continue;
			}
			$status               = AH_Statuses::to_api( $order->get_status() );
			$by_status[ $status ] = isset( $by_status[ $status ] ) ? $by_status[ $status ] + 1 : 1;

			$lines[] = array(
				'order_no' => AH_Shape::order_no( $order ),
				'customer' => trim( AH_Shape::text( $order->get_meta( '_ah_company_name' ) ?: $order->get_formatted_billing_full_name() ) ),
				'status'   => $status,
				'items'    => $order->get_item_count(),
				'total'    => AH_Shape::money( $order->get_total() ),
				'placed'   => AH_Shape::stamp( $order->get_date_created() ),
			);

			if ( in_array( $status, array( 'cancelled', 'rejected' ), true ) ) {
				continue;
			}
			foreach ( $order->get_items() as $item ) {
				$name = AH_Shape::text( $item->get_name() );
				if ( ! isset( $sold[ $name ] ) ) {
					$sold[ $name ] = array( 'name' => $name, 'qty' => 0, 'revenue' => 0 );
				}
				$sold[ $name ]['qty']     += (int) $item->get_quantity();
				$sold[ $name ]['revenue'] += AH_Shape::money( $item->get_total() );
			}
		}

		usort( $sold, function ( $a, $b ) {
			return $b['revenue'] <=> $a['revenue'];
		} );

		// ── Who did the work ───────────────────────────────────────────
		// The event row carries the name as it was at the time, which is
		// what a historical report wants — a staff member who has since
		// left still did the work, and their account may be gone.
		$events = AH_Install::table( 'events' );
		$staff  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT handler_name, stage, action, COUNT(*) AS n
				   FROM {$events}
				  WHERE DATE(created_at) BETWEEN %s AND %s AND handler_name <> ''
				  GROUP BY handler_name, stage, action",
				$from,
				$to
			),
			ARRAY_A
		);

		$people = array();
		foreach ( $staff as $row ) {
			$name = $row['handler_name'];
			if ( ! isset( $people[ $name ] ) ) {
				$people[ $name ] = array(
					'name'    => $name,
					'desk'    => $row['stage'],
					'actions' => array(),
					'total'   => 0,
				);
			}
			$people[ $name ]['actions'][ $row['action'] ] = (int) $row['n'];
			$people[ $name ]['total']                    += (int) $row['n'];
		}

		uasort( $people, function ( $a, $b ) {
			return $b['total'] <=> $a['total'];
		} );

		$gross = (int) $takings['gross'];

		return array(
			'month'   => $month,
			'label'   => date_i18n( 'F Y', strtotime( $from ) ),
			'from'    => $from,
			'to'      => $to,
			'shop'    => AH_Sms::shop_name(),
			'totals'  => array(
				'gross'       => $gross,
				'receipts'    => (int) $takings['receipts'],
				'expenses'    => $spent,
				'net'         => $gross - $spent,
				'orders'      => count( $orders ),
				'average'     => $takings['receipts'] ? (int) round( $gross / (int) $takings['receipts'] ) : 0,
				'cash_in'     => (int) $cash['cash_in'],
				'cash_out'    => (int) $cash['cash_out'],
				'opening'     => $opening,
				'closing'     => $opening + (int) $cash['cash_in'] - (int) $cash['cash_out'],
			),
			'byMethod' => array_map( function ( $r ) {
				return array(
					'method'   => $r['method'],
					'receipts' => (int) $r['receipts'],
					'total'    => (int) $r['total'],
				);
			}, (array) $by_method ),
			'byDay'    => array_map( function ( $r ) {
				return array(
					'day'      => $r['day'],
					'receipts' => (int) $r['receipts'],
					'total'    => (int) $r['total'],
				);
			}, (array) $by_day ),
			'byStatus' => $by_status,
			'orders'   => $lines,
			'products' => array_slice( array_values( $sold ), 0, 50 ),
			'expenses' => array_map( function ( $e ) {
				return array(
					'ref'     => $e['ref'],
					'kind'    => $e['kind'],
					'details' => $e['details'],
					'amount'  => (int) $e['amount'],
					'status'  => $e['status'],
					'method'  => $e['method'],
					'raised'  => $e['created_at'],
					'paid'    => $e['paid_at'],
				);
			}, (array) $expenses ),
			'staff'    => array_values( $people ),
		);
	}
}
