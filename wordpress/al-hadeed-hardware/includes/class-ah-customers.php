<?php
/**
 * Customers who walk in.
 *
 * Until now a customer only existed once they had ordered on the phone
 * app. Plenty of the shop's buyers never will: they walk up to the
 * counter, pay, and leave. This lets the cashier put them on the list
 * with a name and a number, so the shop knows who they are next time
 * and they can order from the app later under the same number.
 *
 * They are ordinary WooCommerce customers, made the same way as one
 * who orders from the app as a guest — so they appear on the Customers
 * screen, and in WooCommerce, alongside everyone else.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Customers {

	public static function routes() {
		$ns = AH_Rest::NS;

		register_rest_route(
			$ns,
			'/customers',
			array(
				// The desks that deal with customers face to face can look
				// them up. The same list the manager sees.
				array(
					'methods'             => WP_REST_Server::READABLE,
					'permission_callback' => AH_Rest::desk( array( 'cashier', 'accounts', 'manager' ) ),
					'callback'            => array( 'AH_Rest_Desks', 'customers' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'permission_callback' => AH_Rest::desk( array( 'cashier', 'manager' ) ),
					'callback'            => array( __CLASS__, 'create' ),
				),
			)
		);

		// One customer and everything they have bought, at the counter
		// or on the app.
		register_rest_route(
			$ns,
			'/customers/(?P<id>\d+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => AH_Rest::desk( array( 'cashier', 'accounts', 'manager' ) ),
				'callback'            => array( __CLASS__, 'one' ),
			)
		);
	}

	/**
	 * A customer's history: each order with its items, newest first,
	 * and what they buy most.
	 */
	public static function one( $req ) {
		$user = get_user_by( 'id', (int) $req['id'] );
		if ( ! $user || AH_Roles::desk_of( $user ) ) {
			return new WP_Error( 'ah_no_customer', 'That customer is not on the list', array( 'status' => 404 ) );
		}

		$orders = wc_get_orders(
			array(
				'customer_id' => $user->ID,
				'limit'       => 200,
				'orderby'     => 'date',
				'order'       => 'DESC',
			)
		);

		$skip   = array( 'cancelled', 'ah-rejected', 'refunded', 'failed' );
		$out    = array();
		$spent  = 0;
		$owing  = 0;
		$tally  = array();
		foreach ( $orders as $o ) {
			$row          = AH_Shape::order( $o );
			$row['items'] = AH_Shape::items( $o );
			$out[]        = $row;

			if ( in_array( $o->get_status(), $skip, true ) ) {
				continue;
			}
			if ( 'pending_payment' === $row['status'] ) {
				$owing += (int) $row['total'];
			} else {
				$spent += (int) $row['total'];
			}
			foreach ( $row['items'] as $it ) {
				$key = $it['product_id'] ? $it['product_id'] : $it['product_name'];
				if ( ! isset( $tally[ $key ] ) ) {
					$tally[ $key ] = array( 'name' => $it['product_name'], 'unit' => $it['unit'], 'quantity' => 0, 'spent' => 0 );
				}
				$tally[ $key ]['quantity'] += $it['quantity'];
				$tally[ $key ]['spent']    += $it['line_total'];
			}
		}
		usort( $tally, function ( $a, $b ) { return $b['spent'] <=> $a['spent']; } );

		$customer          = AH_Shape::user( $user );
		$customer['notes'] = (string) get_user_meta( $user->ID, 'ah_notes', true ) ?: null;
		$customer['address'] = (string) get_user_meta( $user->ID, 'ah_location', true ) ?: null;

		return array(
			'customer' => $customer,
			'orders'   => $out,
			'spent'    => $spent,
			'unpaid'   => $owing,
			'topItems' => array_slice( array_values( $tally ), 0, 5 ),
		);
	}

	/**
	 * Put somebody who walked in on the customer list.
	 *
	 * The phone number is the customer: it is how the app signs them in
	 * and how the shop texts them. So a number that is already on the
	 * list is not added twice — the existing customer is handed back, so
	 * the cashier can carry on with them instead of making a duplicate
	 * whose orders would never add up.
	 */
	public static function create( $req ) {
		$name    = trim( sanitize_text_field( (string) $req->get_param( 'fullName' ) ) );
		$raw     = (string) $req->get_param( 'phone' );
		$phone   = AH_Sms::normalise_phone( $raw );
		$email   = sanitize_email( (string) $req->get_param( 'email' ) );
		$address = trim( sanitize_text_field( (string) $req->get_param( 'address' ) ) );
		$notes   = trim( sanitize_textarea_field( (string) $req->get_param( 'notes' ) ) );

		if ( mb_strlen( $name ) < 2 ) {
			return new WP_Error( 'ah_bad_name', 'Enter the customer\'s name', array( 'status' => 400 ) );
		}
		// A Ugandan mobile number, after normalising: +256 then nine digits.
		if ( ! $phone || ! preg_match( '/^\+256\d{9}$/', $phone ) ) {
			return new WP_Error(
				'ah_bad_phone',
				'Enter a phone number like 0772 123 456. It is how they will be found next time',
				array( 'status' => 400 )
			);
		}
		if ( '' !== (string) $req->get_param( 'email' ) && ! is_email( $email ) ) {
			return new WP_Error( 'ah_bad_email', 'That email address is not valid. Leave it blank if they have none.', array( 'status' => 400 ) );
		}

		$existing = AH_Auth::user_by_phone( $phone );
		if ( $existing ) {
			if ( AH_Roles::desk_of( $existing ) ) {
				return new WP_Error(
					'ah_staff_number',
					'That number belongs to a member of staff, not a customer.',
					array( 'status' => 409 )
				);
			}
			return new WP_Error(
				'ah_customer_exists',
				sprintf( '%s is already a customer with that number.', $existing->display_name ),
				array( 'status' => 409, 'customer' => AH_Shape::user( $existing ) )
			);
		}
		if ( $email && email_exists( $email ) ) {
			return new WP_Error( 'ah_email_taken', 'Somebody already has an account with that email', array( 'status' => 409 ) );
		}

		// The same login the app makes for a guest with this number, so
		// if they later order on the app it is recognised as them.
		$login = 'ah' . preg_replace( '/\D/', '', $phone );
		if ( username_exists( $login ) ) {
			$login .= wp_rand( 10, 99 );
		}

		$user_id = wp_insert_user(
			array(
				'user_login'   => $login,
				'user_pass'    => wp_generate_password( 24 ),
				'user_email'   => $email ? $email : '',
				'display_name' => $name,
				'first_name'   => $name,
				'role'         => 'customer',
			)
		);
		if ( is_wp_error( $user_id ) ) {
			return new WP_Error( 'ah_failed', 'Could not add them: ' . $user_id->get_error_message(), array( 'status' => 400 ) );
		}

		$staff = get_current_user_id();

		update_user_meta( $user_id, 'ah_phone', $phone );
		update_user_meta( $user_id, 'ah_account_type', 'individual' );
		update_user_meta( $user_id, 'ah_status', 'active' );
		update_user_meta( $user_id, 'ah_source', 'counter' );
		update_user_meta( $user_id, 'ah_added_by', $staff );
		if ( $notes ) {
			update_user_meta( $user_id, 'ah_notes', $notes );
		}

		// Their details where WooCommerce looks for them, so an order made
		// for them later is already addressed.
		if ( class_exists( 'WC_Customer' ) ) {
			$customer = new WC_Customer( $user_id );
			$customer->set_billing_first_name( $name );
			$customer->set_billing_phone( $phone );
			if ( $email ) {
				$customer->set_billing_email( $email );
			}
			if ( $address ) {
				$customer->set_billing_address_1( $address );
				$customer->set_shipping_address_1( $address );
			}
			$customer->save();
		} else {
			update_user_meta( $user_id, 'billing_phone', $phone );
		}
		if ( $address ) {
			update_user_meta( $user_id, 'ah_location', $address );
		}

		$sms = null;
		if ( filter_var( $req->get_param( 'welcome' ), FILTER_VALIDATE_BOOLEAN ) ) {
			$sms = AH_Sms::send(
				$phone,
				sprintf(
					'%s: welcome, %s. You are registered with this number. Order from the Al Hadeed app with it, or at the counter any time.',
					AH_Sms::shop_name(),
					strtok( $name, ' ' )
				)
			);
		}

		AH_Flow::log_event( 0, 'cashier', 'customer_added', null, null, $staff, $name . ' · ' . $phone );

		return array(
			'customer' => AH_Shape::user( $user_id ),
			'smsSent'  => $sms ? (bool) $sms['ok'] : null,
		);
	}
}
