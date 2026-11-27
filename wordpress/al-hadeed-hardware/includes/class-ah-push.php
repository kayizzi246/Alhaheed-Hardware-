<?php
/**
 * Push notifications to phones, through OneSignal.
 *
 * The app tells OneSignal who is signed in on the phone ("ah-<user id>").
 * The shop then sends to people, not to phones: OneSignal finds every
 * phone that person is signed in on. Nothing about phones is kept here.
 *
 * Who hears what:
 *   - the customer: their own order, paid, checked, ready, cancelled
 *   - the manager: every sale, every delivery, anything sent back or
 *     cancelled
 *   - the cashier: a new order from the app is waiting to pay
 *   - accounts: a payment is waiting to be checked
 *   - the store: an order is ready to give out
 *
 * Sent without waiting for an answer, so a slow connection to OneSignal
 * never holds up the counter.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Push {

	const API = 'https://api.onesignal.com/notifications';

	public static function init() {
		add_action( 'ah_order_moved', array( __CLASS__, 'on_move' ), 20, 2 );
		add_action( 'ah_order_placed', array( __CLASS__, 'on_placed' ), 20 );
	}

	public static function routes() {
		// The app needs the OneSignal app id to start. It is not a secret.
		register_rest_route(
			AH_Rest::NS,
			'/push/config',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => '__return_true',
				'callback'            => function () {
					return array( 'appId' => (string) AH_Settings::get( 'onesignal_app_id' ) );
				},
			)
		);
		// The manager can check it works from the panel.
		register_rest_route(
			AH_Rest::NS,
			'/manager/push/test',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'permission_callback' => AH_Rest::desk( array( 'manager' ) ),
				'callback'            => array( __CLASS__, 'test' ),
			)
		);
	}

	public static function ready() {
		return '' !== (string) AH_Settings::get( 'onesignal_app_id' ) && '' !== (string) AH_Settings::get( 'onesignal_api_key' );
	}

	/** The name the app gives OneSignal for a person. */
	public static function alias( $user_id ) {
		return 'ah-' . (int) $user_id;
	}

	/** Everyone at a desk: 'manager', 'cashier', 'accounts' or 'store'. */
	public static function desk( $desk ) {
		$ids = get_users( array( 'role' => 'ah_' . $desk, 'fields' => 'ID', 'number' => 200 ) );
		if ( 'manager' === $desk ) {
			$ids = array_merge( $ids, get_users( array( 'role' => 'administrator', 'fields' => 'ID', 'number' => 50 ) ) );
		}
		return array_values( array_unique( array_map( 'intval', $ids ) ) );
	}

	/**
	 * Send one message to some people.
	 *
	 * @param int[]  $user_ids
	 * @param string $title
	 * @param string $body
	 * @param array  $data    handed to the app with the message
	 */
	public static function send( $user_ids, $title, $body, $data = array() ) {
		$user_ids = array_values( array_unique( array_filter( array_map( 'intval', (array) $user_ids ) ) ) );
		if ( ! $user_ids || ! self::ready() ) {
			return false;
		}
		$payload = array(
			'app_id'          => AH_Settings::get( 'onesignal_app_id' ),
			'target_channel'  => 'push',
			'include_aliases' => array( 'external_id' => array_map( array( __CLASS__, 'alias' ), $user_ids ) ),
			'headings'        => array( 'en' => $title ),
			'contents'        => array( 'en' => $body ),
			'data'            => (object) $data,
		);
		wp_remote_post( self::API, array(
			'blocking' => false,
			'timeout'  => 5,
			'headers'  => array(
				'Content-Type'  => 'application/json',
				'Authorization' => 'Key ' . AH_Settings::get( 'onesignal_api_key' ),
			),
			'body'     => wp_json_encode( $payload ),
		) );
		return true;
	}

	private static function money( $order ) {
		return 'UGX ' . number_format( AH_Shape::money( $order->get_total() ) );
	}

	private static function who( $order ) {
		$name = trim( $order->get_formatted_billing_full_name() );
		return $name ? $name : 'Walk-in';
	}

	/** A new order from the app: the cashier is waiting for the customer. */
	public static function on_placed( $order ) {
		$no = AH_Shape::order_no( $order );
		self::send(
			self::desk( 'cashier' ),
			'New order ' . $no,
			sprintf( '%s · %s. Waiting to pay.', self::who( $order ), self::money( $order ) ),
			array( 'order' => $no, 'kind' => 'placed' )
		);
	}

	public static function on_move( $order, $to ) {
		$no   = AH_Shape::order_no( $order );
		$data = array( 'order' => $no, 'kind' => $to );
		$sum  = self::money( $order );
		$who  = self::who( $order );

		// The customer, about their own order. Same words as the SMS.
		$customer = (int) $order->get_customer_id();
		$text     = AH_Sms::status_message( $order, $to );
		if ( $customer && $text ) {
			$titles = array(
				'paid'             => 'Payment received',
				'payment_verified' => 'Payment confirmed',
				'released'         => 'Your order is ready',
				'rejected'         => 'Please see the cashier',
				'cancelled'        => 'Order cancelled',
				'refunded'         => 'Refund approved',
			);
			self::send( array( $customer ), $titles[ $to ] ?? 'Your order', $text, $data );
		}

		switch ( $to ) {
			case 'paid':
				// A credit sale tells the manager itself, with what is owed.
				if ( 'yes' !== $order->get_meta( '_ah_on_credit' ) ) self::send( self::desk( 'manager' ), 'Sale ' . $sum, sprintf( '%s · %s', $no, $who ), $data );
				self::send( self::desk( 'accounts' ), 'Check payment ' . $no, sprintf( '%s · %s', $who, $sum ), $data );
				break;
			case 'payment_verified':
				self::send( self::desk( 'store' ), 'Give out ' . $no, sprintf( '%s · paid and checked', $who ), $data );
				break;
			case 'released':
				self::send( self::desk( 'manager' ), 'Delivered ' . $no, sprintf( '%s · %s', $who, $sum ), $data );
				break;
			case 'rejected':
				self::send( array_merge( self::desk( 'cashier' ), self::desk( 'manager' ) ), 'Payment sent back ' . $no, sprintf( '%s · %s. Check it.', $who, $sum ), $data );
				break;
			case 'cancelled':
				self::send( self::desk( 'manager' ), 'Cancelled ' . $no, sprintf( '%s · %s', $who, $sum ), $data );
				break;
		}
	}

	public static function test() {
		if ( ! self::ready() ) {
			return new WP_Error( 'ah_push_off', 'Add the OneSignal App ID and API key in Settings first.', array( 'status' => 400 ) );
		}
		$user = AH_Auth::current();
		self::send( array( $user->ID ), 'Al Hadeed test', 'Push notifications work on this phone.', array( 'kind' => 'test' ) );
		return array( 'sent' => true );
	}
}
