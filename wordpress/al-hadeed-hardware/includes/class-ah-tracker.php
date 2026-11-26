<?php
/**
 * The figures for the "ALH Tracker" export.
 *
 * The shop kept its steel business in one Excel workbook before this
 * system: a Purchase sheet (every delivery, its FDN and the company),
 * a Sell Detail sheet (every line sold), a stock sheet (bought, sold,
 * left) and a Code sheet (each item's latest buy price and who it came
 * from). The export rebuilds those four sheets from the stock book, so
 * the owner gets the file he already knows how to read.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Tracker {

	public static function routes() {
		register_rest_route(
			AH_Rest::NS,
			'/manager/stock/tracker',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => AH_Rest::desk( array( 'manager' ) ),
				'callback'            => array( __CLASS__, 'data' ),
			)
		);
	}

	public static function data( $req ) {
		global $wpdb;
		$t    = AH_Install::table( 'stock_moves' );
		$from = self::day( $req->get_param( 'from' ), gmdate( 'Y-m-01', current_time( 'timestamp' ) ) );
		$to   = self::day( $req->get_param( 'to' ), current_time( 'Y-m-d' ) );
		$vat  = 'no' !== AH_Settings::get( 'vat_included' );

		// Every product the stock book or the shop knows, with its size.
		$items = array();
		$ids   = wc_get_products( array( 'limit' => -1, 'return' => 'ids', 'status' => array( 'publish', 'private', 'draft' ) ) );
		$moved = array_map( 'intval', (array) $wpdb->get_col( "SELECT DISTINCT product_id FROM {$t}" ) );
		$ids   = array_values( array_unique( array_merge( array_map( 'intval', $ids ), $moved ) ) );

		$totals = array();
		foreach ( (array) $wpdb->get_results(
			"SELECT product_id,
			        SUM(CASE WHEN kind IN ('opening','received') OR ( kind = 'count' AND qty > 0 ) THEN qty ELSE 0 END) AS bought,
			        SUM(CASE WHEN kind IN ('sold','restored') THEN -qty ELSE 0 END) AS sold,
			        SUM(qty) AS book
			   FROM {$t} GROUP BY product_id",
			ARRAY_A
		) as $r ) {
			$totals[ (int) $r['product_id'] ] = $r;
		}

		foreach ( $ids as $id ) {
			$p = wc_get_product( $id );
			if ( ! $p ) {
				continue;
			}
			$last  = AH_Stock::last_buy( $id );
			$cost  = (int) get_post_meta( $id, '_ah_cost', true );
			$tot   = $totals[ $id ] ?? array( 'bought' => 0, 'sold' => 0, 'book' => 0 );
			$items[] = array(
				'id'             => $id,
				'name'           => $p->get_name(),
				'code'           => $p->get_sku(),
				'unit'           => (string) get_post_meta( $id, '_ah_unit', true ) ?: 'pc',
				'item_short'     => (string) get_post_meta( $id, '_ah_item_short', true ),
				'width_ft'       => self::num( $id, '_ah_width_ft' ),
				'length_ft'      => self::num( $id, '_ah_length_ft' ),
				'thickness_mm'   => self::num( $id, '_ah_thickness_mm' ),
				'weight_kg'      => self::num( $id, '_ah_weight_kg' ),
				'bought'         => round( (float) $tot['bought'], 2 ),
				'sold'           => round( (float) $tot['sold'], 2 ),
				'stock'          => round( (float) $tot['book'], 2 ),
				'price'          => (int) $p->get_regular_price(),
				'cost'           => $cost,
				'avg_cost'       => AH_Stock::cost_of( $id ),
				'last_cost'      => $last ? $last['cost'] : ( $cost ?: null ),
				'last_supplier'  => $last ? $last['supplier'] : (string) get_post_meta( $id, '_ah_supplier', true ),
				'expected_cost'  => self::num( $id, '_ah_expected_cost' ),
				'expected_price' => self::num( $id, '_ah_expected_price' ),
				'on_sale'        => 'publish' === $p->get_status(),
			);
		}
		usort( $items, function ( $a, $b ) {
			return strcasecmp( $a['name'], $b['name'] );
		} );
		$by_id = array();
		foreach ( $items as $i ) {
			$by_id[ $i['id'] ] = $i;
		}

		// Deliveries in the period, one line each, as on the Purchase sheet.
		$purchases = array();
		foreach ( (array) $wpdb->get_results( $wpdb->prepare(
			"SELECT id, product_id, qty, unit_cost, supplier, ref, moved_on FROM {$t}
			  WHERE kind = 'received' AND moved_on BETWEEN %s AND %s ORDER BY moved_on, id",
			$from, $to
		), ARRAY_A ) as $r ) {
			$pid         = (int) $r['product_id'];
			$purchases[] = array(
				'product_id' => $pid,
				'qty'        => (float) $r['qty'],
				'unit_cost'  => (int) $r['unit_cost'],
				'supplier'   => (string) $r['supplier'],
				'fdn'        => (string) $r['ref'],
				'date'       => (string) $r['moved_on'],
			);
		}

		// Lines sold in the period, net of anything cancelled back.
		$sales  = array();
		$orders = array();
		foreach ( (array) $wpdb->get_results( $wpdb->prepare(
			"SELECT order_id, product_id, MIN(moved_on) AS day, SUM(-qty) AS qty,
			        MAX(unit_price) AS unit_price, MAX(unit_cost) AS unit_cost
			   FROM {$t}
			  WHERE kind IN ('sold','restored') AND moved_on BETWEEN %s AND %s
			  GROUP BY order_id, product_id
			 HAVING ABS(SUM(qty)) >= 0.005
			  ORDER BY day, order_id",
			$from, $to
		), ARRAY_A ) as $r ) {
			$oid = (int) $r['order_id'];
			if ( $oid && ! isset( $orders[ $oid ] ) ) {
				$o              = wc_get_order( $oid );
				$orders[ $oid ] = $o ? array(
					'no'       => AH_Shape::order_no( $o ),
					'customer' => trim( $o->get_formatted_billing_full_name() ) ?: ( $o->get_billing_company() ?: 'Walk-in' ),
					'receipt'  => (string) $o->get_meta( '_ah_receipt_no' ),
					'paid'     => (bool) $o->get_meta( '_ah_receipt_no' ),
				) : array( 'no' => '#' . $oid, 'customer' => '', 'receipt' => '', 'paid' => true );
			}
			$sales[] = array(
				'product_id' => (int) $r['product_id'],
				'date'       => (string) $r['day'],
				'qty'        => round( (float) $r['qty'], 2 ),
				'unit_price' => (int) $r['unit_price'],
				'unit_cost'  => (int) $r['unit_cost'],
				'order'      => $oid ? $orders[ $oid ] : array( 'no' => '', 'customer' => '', 'receipt' => '', 'paid' => true ),
			);
		}

		$user = AH_Auth::current();
		AH_Flow::log_event( 0, 'manager', 'data_exported', null, null, $user ? $user->ID : null, sprintf( 'Tracker file, %s to %s', $from, $to ) );

		return array(
			'shop'        => get_bloginfo( 'name' ) ?: 'Al Hadeed Hardware',
			'from'        => $from,
			'to'          => $to,
			'vatIncluded' => $vat,
			'vatRate'     => 0.18,
			'items'       => $items,
			'purchases'   => $purchases,
			'sales'       => $sales,
		);
	}

	private static function num( $id, $key ) {
		$v = get_post_meta( $id, $key, true );
		return '' === $v || null === $v ? null : (float) $v;
	}

	private static function day( $v, $fallback ) {
		$v = (string) $v;
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) ? $v : $fallback;
	}
}
