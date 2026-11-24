<?php
/**
 * A customer deleting their own account, for good.
 *
 * Google Play requires it of any app that makes accounts, and it is the
 * customer's right anyway. What goes: the account, and the name, phone,
 * email and address on every order they placed. What stays: the orders
 * and receipts themselves, with nobody's name on them, because the
 * shop's books must still add up and tax records must be kept.
 *
 * Staff cannot use it. Their name on a receipt is the audit trail, and
 * the manager is who ends a staff account.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Account {

	const GONE = 'Deleted customer';

	public static function routes() {
		register_rest_route(
			AH_Rest::NS,
			'/account/delete',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => array( 'AH_Rest', 'signed_in' ),
				'callback'            => array( __CLASS__, 'delete' ),
			)
		);
	}

	public static function delete( $req ) {
		global $wpdb;
		$user = AH_Auth::current( $req );

		// Anyone with any power on the site, not only the four desks: an
		// owner or an editor must never be one tap from deleting themselves.
		if ( AH_Roles::desk_of( $user ) || user_can( $user, 'edit_posts' ) ) {
			return self::err( 'ah_staff_account', 'This is a staff account. Ask the manager to close it.', 403 );
		}
		if ( 'DELETE' !== strtoupper( trim( (string) $req->get_param( 'confirm' ) ) ) ) {
			return self::err( 'ah_not_confirmed', 'Type DELETE to confirm', 400 );
		}

		$id     = (int) $user->ID;
		$orders = wc_get_orders(
			array(
				'customer_id' => $id,
				'limit'       => -1,
				'type'        => 'shop_order',
				'status'      => array_merge(
					array_keys( wc_get_order_statuses() ),
					array_keys( AH_Statuses::custom() )
				),
			)
		);

		// Money handed over and goods not yet: deleting now would leave
		// the shop holding something for nobody it can reach.
		$open = array();
		foreach ( $orders as $order ) {
			if ( in_array( AH_Statuses::to_api( $order->get_status() ), array( 'paid', 'payment_verified', 'rejected' ), true ) ) {
				$open[] = AH_Shape::order_no( $order );
			}
		}
		if ( $open ) {
			return self::err(
				'ah_open_orders',
				sprintf(
					'%s %s paid for but not finished. Collect it, or ask the shop to cancel or refund it, then delete your account.',
					implode( ', ', $open ),
					1 === count( $open ) ? 'is' : 'are'
				),
				409
			);
		}

		$phone = get_user_meta( $id, 'ah_phone', true ) ?: get_user_meta( $id, 'billing_phone', true );

		foreach ( $orders as $order ) {
			// Nothing was paid on it, so nothing is lost by closing it.
			// No message: the number is about to be forgotten.
			if ( 'pending_payment' === AH_Statuses::to_api( $order->get_status() ) ) {
				$order->update_meta_data( '_ah_cancel_reason', 'The customer deleted their account.' );
				$order->set_status( 'cancelled', 'The customer deleted their account.' );
				AH_Flow::log_event( $order->get_id(), 'customer', 'cancelled', 'pending_payment', 'cancelled', null, 'The customer deleted their account.' );
			}
			self::forget( $order, array( $user->display_name, $phone ) );
		}

		// Where the name was copied into the trail.
		$wpdb->update(
			AH_Install::table( 'events' ),
			array( 'handled_by' => null, 'handler_name' => self::GONE ),
			array( 'handled_by' => $id )
		);
		if ( $phone ) {
			$wpdb->delete( AH_Install::table( 'otp' ), array( 'phone' => AH_Sms::normalise_phone( $phone ) ) );
		}

		// A company's owner leaving does not delete the people who bought
		// on it. They carry on as ordinary customers.
		$company = (int) get_user_meta( $id, 'ah_company_id', true );
		if ( $company && 'company_owner' === get_user_meta( $id, 'ah_account_type', true ) ) {
			foreach ( get_users( array( 'meta_key' => 'ah_company_id', 'meta_value' => $company, 'fields' => 'ID', 'exclude' => array( $id ) ) ) as $member ) {
				foreach ( array( 'ah_company_id', 'ah_company_name', 'ah_staff_role', 'ah_spending_limit' ) as $key ) {
					delete_user_meta( $member, $key );
				}
				update_user_meta( $member, 'ah_account_type', 'individual' );
			}
		}

		// The WordPress row goes with every meta value on it, and with it
		// every token: there is no longer anybody for one to belong to.
		require_once ABSPATH . 'wp-admin/includes/user.php';
		if ( ! wp_delete_user( $id ) ) {
			return self::err( 'ah_not_deleted', 'The account could not be deleted. Please try again.', 500 );
		}

		AH_Flow::log_event( 0, 'customer', 'account_deleted', null, null, null, 'A customer deleted their account.' );

		return array( 'deleted' => true );
	}

	/** Take the person off an order and leave the order. */
	private static function forget( $order, $traces ) {
		global $wpdb;
		$events = AH_Install::table( 'events' );

		// The store writes down who collected, and a note can name anybody.
		$wpdb->query( $wpdb->prepare( "UPDATE {$events} SET notes = 'Collected' WHERE order_id = %d AND notes LIKE %s", $order->get_id(), 'Collected by%' ) );
		$traces[] = trim( $order->get_formatted_billing_full_name() );
		foreach ( array_unique( array_filter( $traces ) ) as $trace ) {
			$wpdb->query( $wpdb->prepare( "UPDATE {$events} SET notes = REPLACE( notes, %s, %s ) WHERE order_id = %d", $trace, self::GONE, $order->get_id() ) );
		}

		$blank = array( 'first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'postcode', 'state', 'phone' );
		foreach ( array( 'billing', 'shipping' ) as $side ) {
			foreach ( $blank as $field ) {
				$set = "set_{$side}_{$field}";
				if ( is_callable( array( $order, $set ) ) ) {
					$order->{$set}( '' );
				}
			}
		}
		$order->set_billing_email( '' );
		$order->set_billing_first_name( 'Deleted' );
		$order->set_billing_last_name( 'customer' );
		$order->set_customer_note( '' );
		$order->set_customer_ip_address( '' );
		$order->set_customer_user_agent( '' );
		$order->set_customer_id( 0 );
		foreach ( array( '_ah_location', '_ah_collected_by' ) as $key ) {
			$order->delete_meta_data( $key );
		}
		$order->update_meta_data( '_anonymized', 'yes' );
		$order->save();
	}

	private static function err( $code, $message, $status ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}
}
