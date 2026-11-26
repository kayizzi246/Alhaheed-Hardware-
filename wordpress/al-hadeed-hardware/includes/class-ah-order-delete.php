<?php
/**
 * Deleting orders, for the manager only.
 *
 * The manager asked that a deleted order goes from everywhere: the
 * order list, the takings, the cash book, the receipts and the stock
 * book. Stock the order took off the shelf is put back by removing the
 * order's own lines from the stock book, so the sales and profit
 * figures lose the sale too.
 *
 * One line stays in History: who deleted which order, for how much,
 * and when. That line is the only trace, and it is what lets the owner
 * see that it happened.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Order_Delete {

	public static function routes() {
		register_rest_route(
			AH_Rest::NS,
			'/manager/orders/delete',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => AH_Rest::desk( array( 'manager' ) ),
				'callback'            => array( __CLASS__, 'remove' ),
			)
		);
	}

	public static function remove( $req ) {
		global $wpdb;

		$ids = array_values( array_unique( array_filter( array_map( 'intval', (array) $req->get_param( 'ids' ) ) ) ) );
		if ( ! $ids ) {
			return new WP_Error( 'ah_nothing_chosen', 'Choose the orders to delete', array( 'status' => 400 ) );
		}
		if ( count( $ids ) > 200 ) {
			return new WP_Error( 'ah_too_many', 'Delete at most 200 orders at a time', array( 'status' => 400 ) );
		}

		$user  = AH_Auth::current();
		$moves = AH_Install::table( 'stock_moves' );
		$done  = array();

		foreach ( $ids as $id ) {
			$order = wc_get_order( $id );
			if ( ! $order || 'shop_order_refund' === $order->get_type() ) {
				continue;
			}
			$no    = AH_Shape::order_no( $order );
			$total = AH_Shape::money( $order->get_total() );
			$who   = trim( $order->get_formatted_billing_full_name() ) ?: 'walk-in';

			// Stock the order touched, so the shelf can be set again after
			// its lines are gone.
			$products = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT product_id FROM {$moves} WHERE order_id = %d", $id ) );

			$wpdb->delete( $moves, array( 'order_id' => $id ) );
			$wpdb->delete( AH_Install::table( 'payments' ), array( 'order_id' => $id ) );
			$wpdb->delete( AH_Install::table( 'cash_book' ), array( 'order_id' => $id ) );
			$wpdb->delete( AH_Install::table( 'overrides' ), array( 'order_id' => $id ) );
			$wpdb->delete( AH_Install::table( 'events' ), array( 'order_id' => $id ) );

			// WooCommerce must not put the stock back a second time when
			// the order goes: the stock book is already right.
			$order->update_meta_data( '_order_stock_reduced', 'no' );
			$order->save_meta_data();
			$order->delete( true );

			foreach ( $products as $pid ) {
				$product = wc_get_product( (int) $pid );
				if ( $product ) {
					AH_Stock::sync_shelf( $product );
				}
			}

			$done[] = sprintf( '%s (%s, %s)', $no, $who, number_format( $total ) . ' UGX' );
		}

		if ( ! $done ) {
			return new WP_Error( 'ah_not_found', 'Those orders were already deleted', array( 'status' => 404 ) );
		}

		AH_Flow::log_event(
			0, 'manager', 'orders_deleted', null, null, $user ? $user->ID : null,
			sprintf( '%d deleted: %s', count( $done ), implode( ', ', array_slice( $done, 0, 20 ) ) . ( count( $done ) > 20 ? '…' : '' ) )
		);

		return array( 'deleted' => count( $done ) );
	}
}
