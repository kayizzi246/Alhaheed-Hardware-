<?php
/**
 * The API the apps talk to.
 *
 * Same paths and same JSON as the Node API they were built against, so
 * the Next.js panel and the FlutterFlow app each needed one line
 * changed — their base URL — and nothing else.
 *
 * Reachable two ways:
 *   https://shop.example/wp-json/alhadeed/v1/products
 *   https://shop.example/api/products          (the rewrite below)
 *
 * The second exists so a client that has `/api/...` baked into every
 * call keeps working. It is the same code either way.
 *
 * Errors come back as `{"error": "in plain words"}`, because that is
 * what both clients already show the user, and because "Only 8 length
 * of Iron Bar Y12 left in stock" is worth more at a counter than a
 * status code.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Rest {

	const NS = 'alhadeed/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'init', array( __CLASS__, 'rewrite_rules' ) );
		add_filter( 'query_vars', array( __CLASS__, 'query_vars' ) );

		// Clients are on other domains (Vercel, a phone), so they are
		// cross-origin by definition.
		add_action( 'rest_api_init', array( __CLASS__, 'cors' ), 15 );
	}

	/** Puts the API on /api/... as well as /wp-json/alhadeed/v1/... */
	public static function rewrite_rules() {
		add_rewrite_rule(
			'^api/(.*)$',
			'index.php?rest_route=/' . self::NS . '/$matches[1]',
			'top'
		);
	}

	public static function query_vars( $vars ) {
		$vars[] = 'rest_route';
		return $vars;
	}

	public static function cors() {
		remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
		add_filter(
			'rest_pre_serve_request',
			function ( $served ) {
				$allowed = array_filter( array_map( 'trim', explode( ',', AH_Sms::option( 'cors_origins', '*' ) ) ) );
				$origin  = isset( $_SERVER['HTTP_ORIGIN'] ) ? esc_url_raw( $_SERVER['HTTP_ORIGIN'] ) : '';

				if ( in_array( '*', $allowed, true ) ) {
					header( 'Access-Control-Allow-Origin: ' . ( $origin ? $origin : '*' ) );
				} elseif ( $origin && in_array( $origin, $allowed, true ) ) {
					header( 'Access-Control-Allow-Origin: ' . $origin );
				}

				header( 'Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS' );
				header( 'Access-Control-Allow-Headers: Authorization, Content-Type' );
				header( 'Vary: Origin' );
				return $served;
			}
		);
	}

	// -----------------------------------------------------------------
	// Guards
	// -----------------------------------------------------------------

	public static function open() {
		return true;
	}

	/** Anybody with a valid token. */
	public static function signed_in() {
		return (bool) AH_Auth::current();
	}

	/** One of the named desks. */
	public static function desk( $desks ) {
		return function () use ( $desks ) {
			$user = AH_Auth::current();
			if ( ! $user ) {
				return new WP_Error( 'ah_unauthorised', 'Not signed in', array( 'status' => 401 ) );
			}
			foreach ( (array) $desks as $d ) {
				if ( user_can( $user, 'ah_desk_' . $d ) ) {
					return true;
				}
			}
			return new WP_Error( 'ah_forbidden', 'You do not have access to this', array( 'status' => 403 ) );
		};
	}

	private static function err( $code, $message, $status ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}

	// -----------------------------------------------------------------
	// Routes
	// -----------------------------------------------------------------

	public static function routes() {
		$ns = self::NS;

		$get  = WP_REST_Server::READABLE;
		$post = WP_REST_Server::CREATABLE;

		// ── Health ────────────────────────────────────────────────────
		register_rest_route(
			$ns, '/health',
			array(
				'methods'             => $get,
				'permission_callback' => array( __CLASS__, 'open' ),
				'callback'            => function () {
					return array(
						'ok'       => true,
						'shop'     => AH_Sms::shop_name(),
						'currency' => AH_Sms::option( 'currency', 'UGX' ),
						'time'     => gmdate( 'c' ),
					);
				},
			)
		);

		// ── Auth ──────────────────────────────────────────────────────
		register_rest_route(
			$ns, '/auth/staff/login',
			array(
				'methods'             => $post,
				'permission_callback' => array( __CLASS__, 'open' ),
				'callback'            => array( __CLASS__, 'staff_login' ),
			)
		);
		register_rest_route(
			$ns, '/auth/otp/request',
			array(
				'methods'             => $post,
				'permission_callback' => array( __CLASS__, 'open' ),
				'callback'            => array( __CLASS__, 'otp_request' ),
			)
		);
		register_rest_route(
			$ns, '/auth/otp/verify',
			array(
				'methods'             => $post,
				'permission_callback' => array( __CLASS__, 'open' ),
				'callback'            => array( __CLASS__, 'otp_verify' ),
			)
		);
		register_rest_route(
			$ns, '/auth/me',
			array(
				'methods'             => $get,
				'permission_callback' => array( __CLASS__, 'signed_in' ),
				'callback'            => function () {
					return array( 'user' => AH_Shape::user( AH_Auth::current() ) );
				},
			)
		);

		// ── Catalogue (public: a shelf needs no password) ─────────────
		register_rest_route(
			$ns, '/products',
			array(
				'methods'             => $get,
				'permission_callback' => array( __CLASS__, 'open' ),
				'callback'            => array( __CLASS__, 'products' ),
			)
		);
		register_rest_route(
			$ns, '/products/categories',
			array(
				'methods'             => $get,
				'permission_callback' => array( __CLASS__, 'open' ),
				'callback'            => array( __CLASS__, 'categories' ),
			)
		);

		// ── Ordering ──────────────────────────────────────────────────
		register_rest_route(
			$ns, '/orders/guest',
			array(
				'methods'             => $post,
				'permission_callback' => array( __CLASS__, 'open' ),
				'callback'            => array( __CLASS__, 'guest_order' ),
			)
		);
		register_rest_route(
			$ns, '/orders/mine',
			array(
				'methods'             => $get,
				'permission_callback' => array( __CLASS__, 'signed_in' ),
				'callback'            => array( __CLASS__, 'my_orders' ),
			)
		);
		register_rest_route(
			$ns, '/orders/(?P<id>\d+)/track',
			array(
				'methods'             => $get,
				'permission_callback' => array( __CLASS__, 'signed_in' ),
				'callback'            => array( __CLASS__, 'track' ),
			)
		);
		register_rest_route(
			$ns, '/orders/(?P<id>\d+)',
			array(
				'methods'             => $get,
				'permission_callback' => array( __CLASS__, 'signed_in' ),
				'callback'            => array( __CLASS__, 'one_order' ),
			)
		);
		register_rest_route(
			$ns, '/orders/(?P<id>\d+)/cancel',
			array(
				'methods'             => $post,
				'permission_callback' => array( __CLASS__, 'signed_in' ),
				'callback'            => array( __CLASS__, 'cancel' ),
			)
		);

		// ── Cashier ───────────────────────────────────────────────────
		register_rest_route(
			$ns, '/cashier/queue',
			array(
				'methods'             => $get,
				'permission_callback' => self::desk( array( 'cashier', 'manager' ) ),
				'callback'            => function () {
					return array( 'orders' => AH_Flow::queue_for( 'cashier' ) );
				},
			)
		);
		register_rest_route(
			$ns, '/cashier/orders/(?P<id>\d+)/payment',
			array(
				'methods'             => $post,
				'permission_callback' => self::desk( array( 'cashier', 'manager' ) ),
				'callback'            => array( __CLASS__, 'take_payment' ),
			)
		);

		// ── Accounts ──────────────────────────────────────────────────
		register_rest_route(
			$ns, '/accounts/queue',
			array(
				'methods'             => $get,
				'permission_callback' => self::desk( array( 'accounts', 'manager' ) ),
				'callback'            => function () {
					return array( 'orders' => AH_Flow::queue_for( 'accounts' ) );
				},
			)
		);
		register_rest_route(
			$ns, '/accounts/orders/(?P<id>\d+)/verify',
			array(
				'methods'             => $post,
				'permission_callback' => self::desk( array( 'accounts', 'manager' ) ),
				'callback'            => array( __CLASS__, 'verify' ),
			)
		);
		register_rest_route(
			$ns, '/accounts/cash-book',
			array(
				'methods'             => array( $get, $post ),
				'permission_callback' => self::desk( array( 'accounts', 'cashier', 'manager' ) ),
				'callback'            => array( __CLASS__, 'cash_book' ),
			)
		);

		// ── Store ─────────────────────────────────────────────────────
		register_rest_route(
			$ns, '/store/queue',
			array(
				'methods'             => $get,
				'permission_callback' => self::desk( array( 'store', 'manager' ) ),
				'callback'            => function () {
					return array( 'orders' => AH_Flow::queue_for( 'store' ) );
				},
			)
		);
		register_rest_route(
			$ns, '/store/orders/(?P<id>\d+)/release',
			array(
				'methods'             => $post,
				'permission_callback' => self::desk( array( 'store', 'manager' ) ),
				'callback'            => array( __CLASS__, 'release' ),
			)
		);

		// ── Manager ───────────────────────────────────────────────────
		register_rest_route(
			$ns, '/manager/dashboard',
			array(
				'methods'             => $get,
				'permission_callback' => self::desk( array( 'manager' ) ),
				'callback'            => array( __CLASS__, 'dashboard' ),
			)
		);
	}

	// -----------------------------------------------------------------
	// Auth handlers
	// -----------------------------------------------------------------

	public static function staff_login( $req ) {
		$identifier = trim( (string) $req->get_param( 'identifier' ) );
		$password   = (string) $req->get_param( 'password' );

		if ( ! $identifier || ! $password ) {
			return self::err( 'ah_bad_login', 'Wrong login details', 401 );
		}

		$user = is_email( $identifier )
			? get_user_by( 'email', $identifier )
			: AH_Auth::user_by_phone( $identifier );

		if ( ! $user ) {
			$user = get_user_by( 'login', $identifier );
		}
		// The same answer whether the account does not exist or the
		// password is wrong, so the form cannot be used to discover who
		// works here.
		if ( ! $user || ! wp_check_password( $password, $user->user_pass, $user->ID ) ) {
			return self::err( 'ah_bad_login', 'Wrong login details', 401 );
		}
		if ( ! AH_Roles::desk_of( $user ) ) {
			return self::err( 'ah_bad_login', 'Wrong login details', 401 );
		}
		if ( 'suspended' === get_user_meta( $user->ID, 'ah_status', true ) ) {
			return self::err( 'ah_suspended', 'This staff account has been suspended', 401 );
		}

		return array(
			'user'  => AH_Shape::user( $user ),
			'token' => AH_Auth::issue( $user->ID ),
		);
	}

	public static function otp_request( $req ) {
		$phone = AH_Sms::normalise_phone( $req->get_param( 'phone' ) );
		if ( ! $phone ) {
			return self::err( 'ah_bad_phone', 'Enter a phone number', 400 );
		}

		$user = AH_Auth::user_by_phone( $phone );
		if ( ! $user ) {
			return self::err( 'ah_unknown_phone', 'That phone number is not registered', 400 );
		}
		if ( 'suspended' === get_user_meta( $user->ID, 'ah_status', true ) ) {
			return self::err( 'ah_suspended', 'This account has been suspended', 401 );
		}

		$code = AH_Auth::issue_otp( $phone );
		$sent = AH_Sms::send( $phone, AH_Sms::otp_message( $code ) );

		if ( ! $sent['ok'] && ! AH_Auth::dev_mode() ) {
			return self::err( 'ah_sms_failed', 'We could not send the code just now. Try again in a moment.', 400 );
		}

		$out = array(
			'sent'    => true,
			'phone'   => $phone,
			'message' => "A 6-digit code was sent to {$phone}",
			// Which desk this number belongs to, so the app opens the
			// right side once the code is checked.
			'role'    => AH_Roles::desk_of( $user ) ?: 'customer',
		);
		if ( AH_Auth::dev_mode() ) {
			$out['devCode'] = $code;
		}
		return $out;
	}

	public static function otp_verify( $req ) {
		$phone = AH_Sms::normalise_phone( $req->get_param( 'phone' ) );
		$code  = trim( (string) $req->get_param( 'code' ) );

		if ( ! AH_Auth::check_otp( $phone, $code ) ) {
			return self::err( 'ah_bad_code', 'That code is wrong or has expired', 401 );
		}
		$user = AH_Auth::user_by_phone( $phone );
		if ( ! $user ) {
			return self::err( 'ah_no_account', 'Account not found', 401 );
		}

		return array(
			'user'  => AH_Shape::user( $user ),
			'token' => AH_Auth::issue( $user->ID ),
		);
	}

	// -----------------------------------------------------------------
	// Catalogue
	// -----------------------------------------------------------------

	public static function products( $req ) {
		$args = array(
			'status' => 'publish',
			'limit'  => 500,
			'return' => 'objects',
		);
		if ( $req->get_param( 'search' ) ) {
			$args['s'] = sanitize_text_field( $req->get_param( 'search' ) );
		}
		if ( $req->get_param( 'category' ) && 'all' !== $req->get_param( 'category' ) ) {
			$args['category'] = array( sanitize_text_field( $req->get_param( 'category' ) ) );
		}

		$products = wc_get_products( $args );
		$out      = array();
		foreach ( $products as $p ) {
			$row = AH_Shape::product( $p );
			if ( $row ) {
				$out[] = $row;
			}
		}
		return array( 'products' => $out );
	}

	public static function categories() {
		$terms = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'hide_empty' => false,
			)
		);
		$out = array();
		foreach ( (array) $terms as $t ) {
			if ( is_wp_error( $t ) ) {
				continue;
			}
			$out[] = array(
				'id'            => $t->term_id,
				'name'          => $t->name,
				'product_count' => (int) $t->count,
			);
		}
		return array( 'categories' => $out );
	}

	// -----------------------------------------------------------------
	// Ordering
	// -----------------------------------------------------------------

	/**
	 * An order from the app, by somebody who has not signed in.
	 *
	 * The phone number is the account: a number that has ordered before
	 * is recognised, a new one gets a customer created for it. The
	 * device is handed a token so the order appears in its history
	 * straight away.
	 */
	public static function guest_order( $req ) {
		$phone = AH_Sms::normalise_phone( $req->get_param( 'phone' ) );
		$name  = trim( (string) $req->get_param( 'fullName' ) );
		$items = (array) $req->get_param( 'items' );
		$how   = (string) $req->get_param( 'delivery' );
		$where = trim( (string) $req->get_param( 'location' ) );

		if ( ! $phone ) {
			return self::err( 'ah_bad_phone', 'The shop needs a number to reach you on', 400 );
		}
		if ( strlen( $name ) < 2 ) {
			return self::err( 'ah_bad_name', 'Enter your name', 400 );
		}
		if ( ! $items ) {
			return self::err( 'ah_empty', 'Your order is empty', 400 );
		}
		if ( 'shop_delivery' === $how && '' === $where ) {
			return self::err( 'ah_no_address', 'Tell us where to deliver, so the driver can find you', 400 );
		}

		$user = AH_Auth::user_by_phone( $phone );
		if ( $user && AH_Roles::desk_of( $user ) ) {
			return self::err( 'ah_staff_number', 'That number belongs to a staff account. Use a customer number to order.', 400 );
		}

		if ( ! $user ) {
			$user_id = wp_insert_user(
				array(
					'user_login'   => 'ah' . preg_replace( '/\D/', '', $phone ),
					'user_pass'    => wp_generate_password( 24 ),
					'display_name' => $name,
					'first_name'   => $name,
					'role'         => 'customer',
				)
			);
			if ( is_wp_error( $user_id ) ) {
				return self::err( 'ah_user_failed', 'Could not create your account: ' . $user_id->get_error_message(), 400 );
			}
			update_user_meta( $user_id, 'ah_phone', $phone );
			update_user_meta( $user_id, 'billing_phone', $phone );
			update_user_meta( $user_id, 'ah_account_type', 'individual' );
			$user = get_user_by( 'id', $user_id );
		}

		// Build the order through WooCommerce, so stock, taxes and every
		// other plugin on the site see it as an ordinary order.
		$order = wc_create_order( array( 'customer_id' => $user->ID ) );

		foreach ( $items as $line ) {
			$product_id = isset( $line['productId'] ) ? (int) $line['productId'] : 0;
			$qty        = isset( $line['quantity'] ) ? max( 1, (int) $line['quantity'] ) : 1;
			$product    = $product_id ? wc_get_product( $product_id ) : null;

			if ( ! $product ) {
				$order->delete( true );
				return self::err( 'ah_bad_product', "Product {$product_id} is not available", 400 );
			}
			if ( $product->get_manage_stock() && $qty > (int) $product->get_stock_quantity() ) {
				$order->delete( true );
				return self::err(
					'ah_no_stock',
					sprintf(
						'Only %d %s of %s left in stock',
						(int) $product->get_stock_quantity(),
						$product->get_attribute( 'unit' ) ?: 'pc',
						$product->get_name()
					),
					409
				);
			}
			$order->add_product( $product, $qty );
		}

		$order->set_billing_phone( $phone );
		$order->set_billing_first_name( $name );
		if ( 'shop_delivery' === $how ) {
			$order->set_shipping_address_1( $where );
		}
		$order->update_meta_data( '_ah_fulfilment', 'shop_delivery' === $how ? 'delivery' : 'pickup' );
		$order->update_meta_data( '_ah_source', 'app' );
		$order->update_meta_data( '_ah_delivery_choice', $how );
		if ( $where ) {
			$order->update_meta_data( '_ah_location', $where );
		}
		$order->set_customer_note( self::delivery_note( $how, $where ) );
		$order->calculate_totals();
		$order->set_status( 'pending' );
		$order->save();

		AH_Flow::on_new_order( $order );
		$sms = AH_Sms::send( $phone, AH_Sms::order_placed_message( $order ) );

		return array(
			'order'    => AH_Shape::order( $order, true ),
			'token'    => AH_Auth::issue( $user->ID ),
			'user'     => AH_Shape::user( $user ),
			'smsSent'  => (bool) $sms['ok'],
		);
	}

	private static function delivery_note( $how, $where ) {
		switch ( $how ) {
			case 'own_transport':
				return "Collected from the shop by the customer's own delivery man"
					. ( $where ? " — going to {$where}" : '' );
			case 'pickup':
				return 'Customer is collecting from the shop';
			default:
				return 'Shop delivery — free';
		}
	}

	public static function my_orders( $req ) {
		$user   = AH_Auth::current();
		$orders = wc_get_orders(
			array(
				'customer_id' => $user->ID,
				'limit'       => 100,
				'orderby'     => 'date',
				'order'       => 'DESC',
			)
		);
		return array(
			'orders' => array_map(
				function ( $o ) {
					return AH_Shape::order( $o );
				},
				$orders
			),
		);
	}

	/** Can this person see this order at all? */
	private static function can_view( $user, $order ) {
		if ( AH_Roles::desk_of( $user ) ) {
			return true; // any desk sees any order
		}
		return (int) $order->get_customer_id() === (int) $user->ID;
	}

	public static function one_order( $req ) {
		$order = wc_get_order( (int) $req['id'] );
		if ( ! $order ) {
			return self::err( 'ah_not_found', 'Order not found', 404 );
		}
		if ( ! self::can_view( AH_Auth::current(), $order ) ) {
			return self::err( 'ah_forbidden', 'You do not have access to this', 403 );
		}
		return array( 'order' => AH_Shape::order( $order, true ) );
	}

	/** The five-step progress list the tracking screen draws. */
	public static function track( $req ) {
		$order = wc_get_order( (int) $req['id'] );
		if ( ! $order ) {
			return self::err( 'ah_not_found', 'Order not found', 404 );
		}
		if ( ! self::can_view( AH_Auth::current(), $order ) ) {
			return self::err( 'ah_forbidden', 'You do not have access to this', 403 );
		}

		$shaped = AH_Shape::order( $order, true );
		$status = $shaped['status'];
		$events = $shaped['events'];

		$at = function ( $action ) use ( $events ) {
			foreach ( $events as $e ) {
				if ( $e['action'] === $action ) {
					return $e['created_at'];
				}
			}
			return null;
		};

		$reached = array(
			'placed'   => true,
			'paid'     => in_array( $status, array( 'paid', 'payment_verified', 'released' ), true ),
			'verified' => in_array( $status, array( 'payment_verified', 'released' ), true ),
			'store'    => in_array( $status, array( 'payment_verified', 'released' ), true ),
			'released' => 'released' === $status,
		);

		$steps = array(
			array( 'key' => 'placed',   'label' => 'Order placed',               'at' => $at( 'placed' ) ),
			array( 'key' => 'paid',     'label' => 'Paid at Cashier',            'at' => $at( 'payment_received' ) ),
			array( 'key' => 'verified', 'label' => 'Accounts verifying payment', 'at' => $at( 'verified' ) ),
			array( 'key' => 'store',    'label' => 'Store preparing goods',      'at' => null ),
			array( 'key' => 'released', 'label' => 'Ready / Released',           'at' => $at( 'released' ) ),
		);
		foreach ( $steps as $i => $s ) {
			$steps[ $i ]['done'] = ! empty( $reached[ $s['key'] ] );
		}

		return array( 'order' => $shaped, 'progress' => $steps );
	}

	public static function cancel( $req ) {
		$order = wc_get_order( (int) $req['id'] );
		$user  = AH_Auth::current();
		if ( ! $order ) {
			return self::err( 'ah_not_found', 'Order not found', 404 );
		}
		if ( ! self::can_view( $user, $order ) ) {
			return self::err( 'ah_forbidden', 'You do not have access to this', 403 );
		}
		return self::wrap( AH_Flow::cancel_order( $order->get_id(), $req->get_param( 'reason' ), $user->ID ), 'order' );
	}

	// -----------------------------------------------------------------
	// Desk handlers
	// -----------------------------------------------------------------

	public static function take_payment( $req ) {
		$user = AH_Auth::current();
		return self::wrap(
			AH_Flow::receive_payment(
				(int) $req['id'],
				array(
					'method'          => $req->get_param( 'method' ),
					'amount_paid'     => $req->get_param( 'amountPaid' ),
					'transaction_ref' => $req->get_param( 'transactionRef' ),
				),
				$user->ID
			),
			'order'
		);
	}

	public static function verify( $req ) {
		$user    = AH_Auth::current();
		$approve = filter_var( $req->get_param( 'approve' ), FILTER_VALIDATE_BOOLEAN );
		return self::wrap(
			AH_Flow::verify_payment( (int) $req['id'], $approve, $req->get_param( 'remarks' ), $user->ID ),
			'order'
		);
	}

	public static function release( $req ) {
		$user = AH_Auth::current();
		return self::wrap(
			AH_Flow::release_order(
				(int) $req['id'],
				array(
					'collected_by'    => $req->get_param( 'collectedBy' ),
					'delivery_status' => $req->get_param( 'deliveryStatus' ),
				),
				$user->ID
			),
			'order'
		);
	}

	public static function cash_book( $req ) {
		global $wpdb;
		$table = AH_Install::table( 'cash_book' );
		$date  = $req->get_param( 'date' ) ? sanitize_text_field( $req->get_param( 'date' ) ) : current_time( 'Y-m-d' );

		if ( 'POST' === $req->get_method() ) {
			$user = AH_Auth::current();
			$wpdb->insert(
				$table,
				array(
					'entry_date'  => $date,
					'details'     => sanitize_text_field( $req->get_param( 'details' ) ),
					'cash_in'     => (int) $req->get_param( 'cashIn' ),
					'cash_out'    => (int) $req->get_param( 'cashOut' ),
					'method'      => sanitize_text_field( (string) $req->get_param( 'method' ) ) ?: null,
					'recorded_by' => $user->ID,
					'created_at'  => current_time( 'mysql' ),
				)
			);
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE entry_date = %s ORDER BY id ASC", $date ),
			ARRAY_A
		);

		$opening = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COALESCE(SUM(cash_in - cash_out), 0) FROM {$table} WHERE entry_date < %s", $date )
		);

		$balance = $opening;
		foreach ( $rows as $i => $row ) {
			$balance                  += (int) $row['cash_in'] - (int) $row['cash_out'];
			$rows[ $i ]['cash_in']     = (int) $row['cash_in'];
			$rows[ $i ]['cash_out']    = (int) $row['cash_out'];
			$rows[ $i ]['balance']     = $balance;
		}

		return array(
			'date'    => $date,
			'opening' => $opening,
			'closing' => $balance,
			'entries' => $rows,
		);
	}

	public static function dashboard() {
		global $wpdb;
		$today = current_time( 'Y-m-d' );
		$pay   = AH_Install::table( 'payments' );

		$sales_today = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COALESCE(SUM(amount_paid),0) FROM {$pay} WHERE DATE(created_at) = %s", $today )
		);
		$orders_today = count(
			wc_get_orders(
				array(
					'limit'        => -1,
					'date_created' => '>=' . $today,
					'return'       => 'ids',
				)
			)
		);

		$by_method = array();
		foreach ( array( 'cash', 'mobile_money', 'card' ) as $m ) {
			$by_method[ $m ] = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COALESCE(SUM(amount_paid),0) FROM {$pay} WHERE method = %s AND DATE(created_at) = %s",
					$m,
					$today
				)
			);
		}

		$by_stage = array();
		foreach ( array( 'cashier', 'accounts', 'store', 'done' ) as $stage ) {
			$by_stage[ $stage ] = count( AH_Flow::queue_for( $stage, 500 ) );
		}

		$last7 = $wpdb->get_results(
			"SELECT DATE(created_at) AS day, COALESCE(SUM(amount_paid),0) AS total
			   FROM {$pay}
			  WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND verified = 1
			  GROUP BY day ORDER BY day",
			ARRAY_A
		);
		foreach ( $last7 as $i => $row ) {
			$last7[ $i ]['total'] = (int) $row['total'];
		}

		$low = array();
		foreach ( wc_get_products( array( 'limit' => 200, 'status' => 'publish' ) ) as $p ) {
			if ( ! $p->get_manage_stock() ) {
				continue;
			}
			$reorder = (int) get_post_meta( $p->get_id(), '_ah_reorder_level', true );
			if ( (int) $p->get_stock_quantity() <= $reorder ) {
				$low[] = AH_Shape::product( $p );
			}
		}

		return array(
			'salesToday'     => $sales_today,
			'ordersToday'    => $orders_today,
			'byMethod'       => $by_method,
			'byStage'        => $by_stage,
			'last7Days'      => $last7,
			'lowStock'       => $low,
			'pendingRefunds' => array(),
		);
	}

	/** Turn a WP_Error from the flow into the `{error: "..."}` clients expect. */
	private static function wrap( $result, $key ) {
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return array( $key => $result );
	}
}

/**
 * WordPress answers a WP_Error as {code, message, data}. Both clients
 * read `error`, so one is added alongside — nothing is taken away, so
 * anything else reading this API is unaffected.
 */
add_filter(
	'rest_post_dispatch',
	function ( $response, $server, $request ) {
		if ( 0 !== strpos( $request->get_route(), '/' . AH_Rest::NS ) ) {
			return $response;
		}
		$data = $response->get_data();
		if ( is_array( $data ) && isset( $data['message'] ) && isset( $data['code'] ) && ! isset( $data['error'] ) ) {
			$data['error'] = $data['message'];
			$response->set_data( $data );
		}
		return $response;
	},
	10,
	3
);
