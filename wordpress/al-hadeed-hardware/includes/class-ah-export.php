<?php
/**
 * Taking the shop's data out of the shop.
 *
 * One door, and only a manager has the key. Other desks still see what
 * they need on their screens; what they cannot do is ask for all of it
 * at once. Every time the door opens, the audit trail says who opened it
 * and for what.
 *
 * The data leaves as JSON; the panel turns it into the Excel file.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Export {

	public static function routes() {
		register_rest_route(
			AH_Rest::NS,
			'/manager/export',
			array(
				// POST, because it writes to the audit trail: a link
				// somebody is tricked into opening must not do that.
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => AH_Rest::desk( array( 'manager' ) ),
				'callback'            => array( __CLASS__, 'export' ),
			)
		);
	}

	public static function export( $req ) {
		$report = sanitize_key( (string) $req->get_param( 'report' ) );
		$user   = AH_Auth::current( $req );

		if ( 'products' === $report ) {
			$out           = AH_Catalogue::export();
			$out['shop']   = AH_Sms::shop_name();
			self::note( $user, 'Products: ' . count( $out['products'] ) . ' rows' );
			return $out;
		}
		if ( ! in_array( $report, array( 'monthly', 'business' ), true ) ) {
			return new WP_Error( 'ah_unknown_report', 'No such report', array( 'status' => 404 ) );
		}

		if ( 'monthly' === $report ) {
			$out          = AH_Monthly::report( $req );
			$out['title'] = 'Monthly report';
			$from         = $out['from'];
			$to           = $out['to'];
		} else {
			list( $from, $to ) = AH_Rest_Desks::range( $req );
			foreach ( array( $from, $to ) as $d ) {
				if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $d ) ) {
					return new WP_Error( 'ah_bad_date', 'Choose a start and an end date', array( 'status' => 400 ) );
				}
			}
			if ( $from > $to ) {
				return new WP_Error( 'ah_bad_date', 'The start date is after the end date', array( 'status' => 400 ) );
			}
			$out          = AH_Monthly::between( $from, $to );
			$out['title'] = 'Business report';
		}

		$range = new WP_REST_Request();
		$range->set_param( 'from', $from );
		$range->set_param( 'to', $to );

		$out['by']       = $user->display_name;
		$out['receipts'] = self::receipts( $from, $to );
		$out['book']     = self::book( $from, $to, (int) $out['totals']['opening'] );
		$out['stock']    = AH_Rest_Desks::stock_movement( $range )['movements'];

		self::note( $user, $out['title'] . ', ' . $from . ' to ' . $to );
		return $out;
	}

	private static function note( $user, $what ) {
		AH_Flow::log_event( 0, 'manager', 'data_exported', null, null, $user->ID, $what );
	}

	private static function receipts( $from, $to ) {
		global $wpdb;
		$t    = AH_Install::table( 'payments' );
		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$t} WHERE DATE(created_at) BETWEEN %s AND %s ORDER BY id", $from, $to ),
			ARRAY_A
		);

		$names = array();
		$out   = array();
		foreach ( $rows as $r ) {
			$cid = (int) $r['cashier_id'];
			if ( ! isset( $names[ $cid ] ) ) {
				$u             = $cid ? get_user_by( 'id', $cid ) : null;
				$names[ $cid ] = $u ? $u->display_name : '';
			}
			$order = wc_get_order( (int) $r['order_id'] );
			$out[] = array(
				'receipt_no'      => $r['receipt_no'],
				'created_at'      => $r['created_at'],
				'order_no'        => $order ? AH_Shape::order_no( $order ) : '',
				'customer'        => $order ? trim( AH_Shape::text( $order->get_meta( '_ah_company_name' ) ?: $order->get_formatted_billing_full_name() ) ) : '',
				'method'          => $r['method'],
				'transaction_ref' => $r['transaction_ref'],
				'cashier'         => $names[ $cid ],
				'verified'        => 1 === (int) $r['verified'],
				'amount'          => (int) $r['amount_paid'],
			);
		}
		return $out;
	}

	private static function book( $from, $to, $balance ) {
		global $wpdb;
		$t    = AH_Install::table( 'cash_book' );
		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT entry_date, details, method, cash_in, cash_out FROM {$t} WHERE entry_date BETWEEN %s AND %s ORDER BY entry_date, id", $from, $to ),
			ARRAY_A
		);
		foreach ( $rows as $i => $r ) {
			$balance               += (int) $r['cash_in'] - (int) $r['cash_out'];
			$rows[ $i ]['cash_in']  = (int) $r['cash_in'];
			$rows[ $i ]['cash_out'] = (int) $r['cash_out'];
			$rows[ $i ]['balance']  = $balance;
		}
		return $rows;
	}
}
