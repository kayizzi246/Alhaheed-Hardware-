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
		add_filter( 'rest_post_dispatch', array( __CLASS__, 'cache_public' ), 20, 3 );

		// A product added, edited or sold out: the counts start again.
		foreach ( array( 'woocommerce_update_product', 'woocommerce_new_product', 'woocommerce_product_set_stock_status', 'woocommerce_variation_set_stock_status', 'trashed_post' ) as $hook ) {
			add_action( $hook, function () { delete_transient( 'ah_shelf_counts' ); } );
		}
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

	/**
	 * How many products, and how many in stock — for the sign-in page.
	 *
	 * The sign-in page used to download the whole product list to count
	 * it: every name, price and picture, to draw two numbers. With a real
	 * catalogue that is the slowest thing on a page whose only job is to
	 * let somebody type a password. Two counts, kept for five minutes.
	 */
	public static function shelf_counts() {
		$cached = get_transient( 'ah_shelf_counts' );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		global $wpdb;
		$counts = array(
			'products' => (int) $wpdb->get_var(
				"SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'product' AND post_status = 'publish'"
			),
			'inStock'  => (int) $wpdb->get_var(
				"SELECT COUNT(*) FROM {$wpdb->posts} p
				   JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = '_stock_status'
				  WHERE p.post_type = 'product' AND p.post_status = 'publish' AND m.meta_value = 'instock'"
			),
		);
		set_transient( 'ah_shelf_counts', $counts, 5 * MINUTE_IN_SECONDS );
		return $counts;
	}

	/**
	 * Let browsers keep the public lists for a minute.
	 *
	 * Every request to this server costs most of a second before it
	 * answers — WordPress and WooCommerce loading on shared hosting —
	 * however small the reply. The product list and the categories are
	 * the same for everybody and change a few times a day, so a phone
	 * or a browser that fetched them a minute ago can use that copy, and
	 * for ten minutes after can show it while quietly fetching a new
	 * one. Nothing signed-in or personal is ever marked this way.
	 */
	public static function cache_public( $response, $server, $request ) {
		if ( 'GET' !== $request->get_method() || ! ( $response instanceof WP_HTTP_Response ) || $response->is_error() ) {
			return $response;
		}
		$route = $request->get_route();
		$public = array( '/' . self::NS . '/health', '/' . self::NS . '/products', '/' . self::NS . '/products/categories' );
		if ( in_array( $route, $public, true ) ) {
			$response->header( 'Cache-Control', 'public, max-age=60, stale-while-revalidate=600' );
		}
		return $response;
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
					return array_merge(
						array(
							'ok'       => true,
							'shop'     => AH_Sms::shop_name(),
							'currency' => AH_Sms::option( 'currency', 'UGX' ),
							'time'     => gmdate( 'c' ),
						),
						self::shelf_counts()
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
		// A customer the shop already knows. The phone app posts here
		// whenever it holds a session, and posted into a 404 until this
		// existed — so a returning customer, who is the shop's best
		// kind, could not buy anything.
		register_rest_route(
			$ns, '/orders',
			array(
				'methods'             => $post,
				'permission_callback' => array( __CLASS__, 'signed_in' ),
				'callback'            => array( __CLASS__, 'place_order' ),
			)
		);
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
				'callback'            => array( __CLASS__, 'cashier_queue' ),
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
				'callback'            => array( __CLASS__, 'accounts_queue' ),
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
		// The rest of the desks' API lives in its own class.
		AH_Rest_Desks::routes();

		// Company accounts: the contractor who buys on account and the
		// people they let order on it. Only the phone app uses these.
		AH_Rest_Company::routes();

		// Pictures, spreadsheet import and export, from the web panel.
		AH_Catalogue::routes();

		// Hiring onto a desk, from the panel.
		AH_Staff::routes();

		// Internal spending: raised at a desk, approved by the manager,
		// paid by the cashier. No customer ever sees any of it.
		AH_Expenses::routes();

		// The whole month on one page: sales, spending, the book.
		AH_Monthly::routes();

		// The screenshot behind a mobile money reference, and the check
		// that a reference has not already paid for another order.
		AH_Proofs::routes();

		// Customers who walk in, added at the counter.
		AH_Customers::routes();

		// Writing to suppliers from inside the shop, instead of the
		// cashier opening a mail app and typing it out again.
		AH_Suppliers::routes();

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
	// The desk queues
	//
	// Each returns `orders` and a `summary`: the four numbers across the
	// top of the screen. They are part of the response rather than a
	// second request because a desk opening its queue always wants both,
	// and two round trips on a counter's connection is one too many.
	// -----------------------------------------------------------------

	public static function cashier_queue() {
		global $wpdb;
		$pay   = AH_Install::table( 'payments' );
		$today = current_time( 'Y-m-d' );

		$taken = function ( $method ) use ( $wpdb, $pay, $today ) {
			return (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COALESCE(SUM(amount_paid),0) FROM {$pay}
					  WHERE method = %s AND DATE(created_at) = %s",
					$method,
					$today
				)
			);
		};

		$orders = AH_Flow::queue_for( 'cashier' );

		return array(
			'orders'  => $orders,
			'summary' => array(
				'waiting'    => count( $orders ),
				'paid_today' => (int) $wpdb->get_var(
					$wpdb->prepare( "SELECT COUNT(*) FROM {$pay} WHERE DATE(created_at) = %s", $today )
				),
				'cash_today' => $taken( 'cash' ),
				'momo_today' => $taken( 'mobile_money' ),
			),
		);
	}

	public static function accounts_queue() {
		global $wpdb;
		$pay   = AH_Install::table( 'payments' );
		$book  = AH_Install::table( 'cash_book' );
		$today = current_time( 'Y-m-d' );

		$orders = AH_Flow::queue_for( 'accounts' );

		// Accounts is checking a payment, so the row has to carry the
		// payment: the receipt number, what was taken, how, and the
		// reference to look up on the statement. Without these the desk
		// showed a customer name and "UGX 0" and could verify nothing.
		foreach ( $orders as $i => $order ) {
			$payment = AH_Flow::payment_for( $order['id'] );
			if ( ! $payment ) {
				continue;
			}
			$cashier = $payment['cashier_id'] ? get_user_by( 'id', $payment['cashier_id'] ) : null;

			$orders[ $i ]['receipt_no']      = $payment['receipt_no'];
			$orders[ $i ]['method']          = $payment['method'];
			$orders[ $i ]['transaction_ref'] = $payment['transaction_ref'];
			$orders[ $i ]['amount_paid']     = (int) $payment['amount_paid'];
			$orders[ $i ]['cashier_name']    = $cashier ? $cashier->display_name : null;
			$orders[ $i ]['paid_at']         = $payment['created_at'];
			$orders[ $i ]['payment_id']      = (int) $payment['id'];
			$orders[ $i ]['has_proof']       = ! empty( $payment['proof_file'] );
		}

		return array(
			'orders'  => $orders,
			'summary' => array(
				'awaiting'       => count( $orders ),
				'verified_today' => (int) $wpdb->get_var(
					$wpdb->prepare(
						"SELECT COUNT(*) FROM {$pay} WHERE verified = 1 AND DATE(verified_at) = %s",
						$today
					)
				),
				'cash_in'        => (int) $wpdb->get_var(
					$wpdb->prepare( "SELECT COALESCE(SUM(cash_in),0) FROM {$book} WHERE entry_date = %s", $today )
				),
				'cash_out'       => (int) $wpdb->get_var(
					$wpdb->prepare( "SELECT COALESCE(SUM(cash_out),0) FROM {$book} WHERE entry_date = %s", $today )
				),
			),
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
			// Decoded, like every other name this API sends. A filter
			// chip reading "Iron &amp; Steel" is the same bug as the
			// products list had, in the one place it was missed.
			$out[] = array(
				'id'            => $t->term_id,
				'name'          => AH_Shape::text( $t->name ),
				'product_count' => (int) $t->count,
			);
		}

		// An empty category is a filter that leads nowhere. WordPress
		// always has "Uncategorized" whether anything is in it or not,
		// and it was the only chip on the shelf of a new shop.
		$out = array_values( array_filter( $out, function ( $c ) {
			return $c['product_count'] > 0;
		} ) );

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

		$order = self::build_order( $user, $items, $phone, $name, $how, $where );
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		$sms = AH_Sms::send( $phone, AH_Sms::order_placed_message( $order ) );

		return array(
			'order'    => AH_Shape::order( $order, true ),
			'token'    => AH_Auth::issue( $user->ID ),
			'user'     => AH_Shape::user( $user ),
			'smsSent'  => (bool) $sms['ok'],
		);
	}

	/**
	 * Place an order for a customer the shop already knows.
	 *
	 * Everything below the account is the same work as a guest order,
	 * which is why both go through build_order(). What differs is only
	 * where the name and number come from: here they are on the
	 * account rather than typed into the checkout each time.
	 */
	public static function place_order( $req ) {
		$user = AH_Auth::current();

		// Staff order as customers from their own phones often enough,
		// but an order filed against a desk account confuses every
		// report that counts customers, so it is refused plainly.
		if ( AH_Roles::desk_of( $user ) ) {
			return self::err(
				'ah_staff_account',
				'This is a staff account. Orders are placed from a customer account.',
				403
			);
		}

		$items = (array) $req->get_param( 'items' );
		if ( ! $items ) {
			return self::err( 'ah_empty', 'Your order is empty', 400 );
		}

		// The app sends 'fulfilment' here and 'delivery' on the guest
		// route. Both are accepted rather than made to match, because
		// an app already in somebody's hand cannot be changed today.
		$how = (string) ( $req->get_param( 'fulfilment' ) ?: $req->get_param( 'delivery' ) );
		if ( 'delivery' === $how ) {
			$how = 'shop_delivery';
		}
		if ( ! in_array( $how, array( 'shop_delivery', 'pickup', 'own_transport' ), true ) ) {
			$how = 'pickup';
		}

		$where = trim(
			(string) ( $req->get_param( 'deliveryAddress' ) ?: $req->get_param( 'location' ) )
		);
		if ( '' === $where ) {
			$where = (string) get_user_meta( $user->ID, 'ah_location', true );
		}

		if ( 'shop_delivery' === $how && '' === $where ) {
			return self::err( 'ah_no_address', 'Tell us where to deliver, so the driver can find you', 400 );
		}

		$phone = (string) get_user_meta( $user->ID, 'ah_phone', true );
		$name  = $user->display_name ? $user->display_name : trim( (string) $req->get_param( 'fullName' ) );

		$order = self::build_order( $user, $items, $phone, $name, $how, $where );
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		$note = trim( (string) $req->get_param( 'notes' ) );
		if ( '' !== $note ) {
			$order->set_customer_note( $order->get_customer_note() . "\n" . sanitize_textarea_field( $note ) );
			$order->save();
		}

		// A customer with no number on the account is not an error —
		// they are standing in the shop with the app open — but there
		// is nowhere to send the confirmation.
		$sms = $phone ? AH_Sms::send( $phone, AH_Sms::order_placed_message( $order ) ) : array( 'ok' => false );

		return array(
			'order'   => AH_Shape::order( $order, true ),
			'smsSent' => (bool) $sms['ok'],
		);
	}

	/**
	 * Turn a basket into a saved WooCommerce order.
	 *
	 * Built through WooCommerce rather than by hand so that stock,
	 * taxes and every other plugin on the site see an ordinary order.
	 * A half-built order is deleted rather than left behind: an order
	 * that failed on its third line must not sit in the cashier's
	 * queue holding two.
	 *
	 * @return WC_Order|WP_Error
	 */
	private static function build_order( $user, $items, $phone, $name, $how, $where ) {
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

		if ( $phone ) {
			$order->set_billing_phone( $phone );
		}
		if ( $name ) {
			$order->set_billing_first_name( $name );
		}
		if ( 'shop_delivery' === $how && $where ) {
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

		return $order;
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

		// The screenshot arrives in the same request as the payment, so
		// there is never a picture with no payment or a payment that lost
		// its picture on the way.
		$proof = '';
		$files = $req->get_file_params();
		if ( ! empty( $files['proof'] ) && UPLOAD_ERR_NO_FILE !== (int) $files['proof']['error'] ) {
			$proof = AH_Proofs::store( $files['proof'] );
			if ( is_wp_error( $proof ) ) {
				return $proof;
			}
		}

		$result = AH_Flow::receive_payment(
			(int) $req['id'],
			array(
				'method'          => $req->get_param( 'method' ),
				'amount_paid'     => $req->get_param( 'amountPaid' ),
				'transaction_ref' => $req->get_param( 'transactionRef' ),
				'proof_file'      => $proof,
			),
			$user->ID
		);

		// Refused — a duplicate reference, a short payment — so the
		// picture belongs to nothing and is not kept.
		if ( is_wp_error( $result ) && $proof ) {
			AH_Proofs::discard( $proof );
		}

		return self::wrap( $result, 'order' );
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

		// Counted, not loaded.
		//
		// This used to call queue_for() for each stage, which fetches up
		// to 500 orders AND shapes every one of them — several meta
		// reads apiece — so four integers cost up to two thousand
		// orders' worth of work. On a shop with a year of trading behind
		// it that is the dashboard timing out.
		$by_stage = array();
		foreach ( AH_Flow::stages() as $stage => $statuses ) {
			$total = 0;
			foreach ( $statuses as $status ) {
				$total += (int) wc_orders_count( substr( $status, 3 ) );
			}
			$by_stage[ $stage ] = $total;
		}

		$rows = $wpdb->get_results(
			"SELECT DATE(created_at) AS day,
			        COALESCE(SUM(amount_paid),0) AS total,
			        COUNT(*) AS receipts
			   FROM {$pay}
			  WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND verified = 1
			  GROUP BY day ORDER BY day",
			ARRAY_A
		);

		// Days with no sales are still days. A chart of seven bars with
		// three of them missing reads as a quiet week rather than a
		// week with three quiet days, and the gaps shift the ones that
		// are there into the wrong place.
		$by_day = array();
		foreach ( $rows as $r ) {
			$by_day[ $r['day'] ] = array(
				'day'      => $r['day'],
				'total'    => (int) $r['total'],
				'receipts' => (int) $r['receipts'],
			);
		}

		$last7 = array();
		for ( $i = 6; $i >= 0; $i-- ) {
			$day     = gmdate( 'Y-m-d', strtotime( current_time( 'Y-m-d' ) . " -{$i} days" ) );
			$last7[] = isset( $by_day[ $day ] )
				? $by_day[ $day ]
				: array( 'day' => $day, 'total' => 0, 'receipts' => 0 );
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
