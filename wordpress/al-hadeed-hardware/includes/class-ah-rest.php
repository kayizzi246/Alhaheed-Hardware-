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
		// The phone app's password sign-in: customers and staff both, one
		// form, the app opening whichever side the account belongs to.
		register_rest_route(
			$ns, '/auth/login',
			array(
				'methods'             => $post,
				'permission_callback' => array( __CLASS__, 'open' ),
				'callback'            => array( __CLASS__, 'password_login' ),
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
		// A sale at the counter: the cashier builds the basket for
		// somebody standing there, then takes payment the usual way.
		register_rest_route(
			$ns, '/cashier/orders',
			array(
				'methods'             => $post,
				'permission_callback' => self::desk( array( 'cashier', 'manager' ) ),
				'callback'            => array( __CLASS__, 'counter_sale' ),
			)
		);
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
		// The store types or scans an order number and gets the order,
		// with what was sold, what has gone and what is still to deliver.
		register_rest_route(
			$ns, '/store/lookup',
			array(
				'methods'             => $get,
				'permission_callback' => self::desk( array( 'store', 'manager' ) ),
				'callback'            => array( __CLASS__, 'store_lookup' ),
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
		AH_Export::routes();
		AH_Account::routes();
		AH_Stock::routes();
		AH_Workers::routes();
		AH_Ledger::routes();
		AH_Stocktake::routes();
		AH_Purchasing::routes();
		AH_Till::routes();

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
		return self::sign_in_with_password( $req, true );
	}

	public static function password_login( $req ) {
		return self::sign_in_with_password( $req, false );
	}

	private static function sign_in_with_password( $req, $staff_only ) {
		$identifier = trim( (string) $req->get_param( 'identifier' ) );
		$password   = (string) $req->get_param( 'password' );

		if ( ! $identifier || ! $password ) {
			return self::err( 'ah_bad_login', 'Enter your phone number and password', 400 );
		}

		// One spelling per account, so "0772..." and "+256772..." share a
		// count and cannot be alternated to get twice the tries.
		$who = is_email( $identifier ) ? strtolower( $identifier ) : ( AH_Sms::normalise_phone( $identifier ) ?: strtolower( $identifier ) );
		$ip  = AH_Limits::ip();
		foreach ( array( array( 'login_account', $who ), array( 'login_ip', $ip ) ) as $limit ) {
			$ok = AH_Limits::check( $limit[0], $limit[1] );
			if ( is_wp_error( $ok ) ) {
				return $ok;
			}
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
		if ( ! $user || ! wp_check_password( $password, $user->user_pass, $user->ID ) || ( $staff_only && ! AH_Roles::desk_of( $user ) ) ) {
			return self::wrong_login( $who, $ip );
		}
		if ( 'suspended' === get_user_meta( $user->ID, 'ah_status', true ) ) {
			return self::err( 'ah_suspended', 'This account has been suspended. Ask the manager.', 403 );
		}

		AH_Limits::clear( 'login_account', $who );

		return array(
			'user'  => AH_Shape::user( $user ),
			'token' => AH_Auth::issue( $user->ID ),
		);
	}

	/**
	 * A wrong password: counted, and the person told how many tries are
	 * left once they are running low, rather than finding out by being
	 * locked out.
	 *
	 * The same words whether the account exists or not, so the form
	 * cannot be used to find out who works here.
	 */
	private static function wrong_login( $who, $ip ) {
		AH_Limits::hit( 'login_account', $who );
		AH_Limits::hit( 'login_ip', $ip );

		$left    = AH_Limits::left( 'login_account', $who );
		$message = 'That phone number and password do not match.';
		if ( 0 === $left ) {
			$message .= ' That was the last try. Wait 15 minutes, or sign in with an SMS code.';
		} elseif ( $left <= 2 ) {
			$message .= sprintf( ' %d %s left before a 15-minute wait.', $left, 1 === $left ? 'try' : 'tries' );
		}
		return self::err( 'ah_bad_login', $message, 401 );
	}

	public static function otp_request( $req ) {
		$phone = AH_Sms::normalise_phone( $req->get_param( 'phone' ) );
		if ( ! $phone ) {
			return self::err( 'ah_bad_phone', 'Enter a phone number', 400 );
		}

		$ip = AH_Limits::ip();
		foreach ( array( array( 'otp_send', $phone ), array( 'otp_send_ip', $ip ) ) as $limit ) {
			$ok = AH_Limits::check( $limit[0], $limit[1] );
			if ( is_wp_error( $ok ) ) {
				return $ok;
			}
		}
		// Counted before it is known whether the number is registered,
		// so trying numbers to see which are customers costs the same.
		AH_Limits::hit( 'otp_send_ip', $ip );

		$user = AH_Auth::user_by_phone( $phone );
		$new_name = trim( sanitize_text_field( (string) $req->get_param( 'fullName' ) ) );
		if ( ! $user && mb_strlen( $new_name ) < 2 ) {
			return self::err( 'ah_unknown_phone', 'That number is new here. Add your name to create an account.', 400 );
		}
		if ( ! $user && ! preg_match( '/^\+\d{10,15}$/', $phone ) ) {
			return self::err( 'ah_bad_phone', 'Enter a full phone number, like 0772 123 456', 400 );
		}
		// In test mode every code is 123456. That must never open a desk
		// on a real site: it would be a till with a published key.
		if ( $user && AH_Roles::desk_of( $user ) && AH_Auth::dev_mode() && ! AH_Auth::is_local() ) {
			return self::err( 'ah_use_password', 'SMS codes are not switched on for staff yet. Sign in with your password.', 403 );
		}
		if ( $user && 'suspended' === get_user_meta( $user->ID, 'ah_status', true ) ) {
			return self::err( 'ah_suspended', 'This account has been suspended. Ask the manager.', 403 );
		}

		AH_Limits::hit( 'otp_send', $phone );
		// A new code means a fresh set of guesses for it.
		AH_Limits::clear( 'otp_guess', $phone );

		// "log" sends nothing and reports success, so a customer would wait
		// for a code that was never going to come.
		if ( ! AH_Auth::dev_mode() && 'log' === AH_Sms::option( 'sms_provider', 'log' ) ) {
			return self::err( 'ah_sms_off', 'SMS is not set up yet. Sign in with your password.', 503 );
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
			'role'    => ( $user ? AH_Roles::desk_of( $user ) : null ) ?: 'customer',
			'isNew'   => ! $user,
		);
		if ( AH_Auth::dev_mode() ) {
			$out['devCode'] = $code;
		}
		return $out;
	}

	public static function otp_verify( $req ) {
		$phone = AH_Sms::normalise_phone( $req->get_param( 'phone' ) );
		$code  = trim( (string) $req->get_param( 'code' ) );

		$ok = AH_Limits::check( 'otp_guess', $phone );
		if ( is_wp_error( $ok ) ) {
			return $ok;
		}

		if ( ! AH_Auth::check_otp( $phone, $code ) ) {
			// Five wrong guesses and the code is dead: a six-digit code
			// that accepts unlimited guesses for five minutes is not a
			// lock, it is a delay.
			if ( AH_Limits::hit( 'otp_guess', $phone ) >= 5 ) {
				AH_Auth::burn_otps( $phone );
				return AH_Limits::check( 'otp_guess', $phone );
			}
			$left = AH_Limits::left( 'otp_guess', $phone );
			return self::err(
				'ah_bad_code',
				'That code is wrong or has expired.' . ( $left <= 2 ? sprintf( ' %d %s left.', $left, 1 === $left ? 'try' : 'tries' ) : '' ),
				401
			);
		}
		AH_Limits::clear( 'otp_guess', $phone );
		$user = AH_Auth::user_by_phone( $phone );
		// The code proved the number is theirs, so this is the moment an
		// account may be made for it — not when the code was asked for.
		if ( ! $user ) {
			$name = trim( sanitize_text_field( (string) $req->get_param( 'fullName' ) ) );
			if ( mb_strlen( $name ) < 2 ) {
				return self::err( 'ah_no_account', 'Account not found', 401 );
			}
			$user = self::new_customer( $phone, $name );
			if ( is_wp_error( $user ) ) {
				return $user;
			}
		}
		if ( AH_Roles::desk_of( $user ) && AH_Auth::dev_mode() && ! AH_Auth::is_local() ) {
			return self::err( 'ah_use_password', 'SMS codes are not switched on for staff yet. Sign in with your password.', 403 );
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
			'limit'  => -1,
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
			// Not for sale until the manager gives it a price: an imported
			// list arrives without prices, and UGX 0 is not a price.
			if ( (float) $p->get_price() <= 0 ) {
				continue;
			}
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

		$known = (bool) $user;
		if ( ! $user ) {
			$user = self::new_customer( $phone, $name );
			if ( is_wp_error( $user ) ) {
				return $user;
			}
		}

		$order = self::build_order( $user, $items, $phone, $name, $how, $where );
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		$sms = AH_Sms::send( $phone, AH_Sms::order_placed_message( $order ) );

		return array(
			'order'    => AH_Shape::order( $order, true ),
			// Only for an account made just now. This used to hand out a
			// session for ANY number typed in — so ordering with somebody
			// else's number signed you in as them, with no code at all.
			'token'    => $known ? null : AH_Auth::issue( $user->ID ),
			'user'     => $known ? null : AH_Shape::user( $user ),
			'smsSent'  => (bool) $sms['ok'],
		);
	}

	/** A customer account for a phone number. @return WP_User|WP_Error */
	private static function new_customer( $phone, $name ) {
		$login = 'ah' . preg_replace( '/\D/', '', $phone );
		if ( username_exists( $login ) ) {
			$login .= wp_rand( 10, 99 );
		}
		$id = wp_insert_user(
			array(
				'user_login'   => $login,
				'user_pass'    => wp_generate_password( 24 ),
				'display_name' => $name,
				'first_name'   => $name,
				'role'         => 'customer',
			)
		);
		if ( is_wp_error( $id ) ) {
			return self::err( 'ah_user_failed', 'Could not create your account: ' . $id->get_error_message(), 400 );
		}
		update_user_meta( $id, 'ah_phone', $phone );
		update_user_meta( $id, 'billing_phone', $phone );
		update_user_meta( $id, 'ah_account_type', 'individual' );
		return get_user_by( 'id', $id );
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

		// Somebody who signed in by email may have no number on the
		// account, so the one typed in the cart is the order's contact. It
		// goes on the order only: saved on the account unchecked, it would
		// let anyone claim a number that is not theirs.
		$phone = (string) get_user_meta( $user->ID, 'ah_phone', true );
		if ( '' === $phone ) {
			$phone = AH_Sms::normalise_phone( (string) $req->get_param( 'phone' ) );
		}
		if ( ! $phone ) {
			return self::err( 'ah_bad_phone', 'The shop needs a number to reach you on', 400 );
		}
		$name  = $user->display_name ? $user->display_name : trim( (string) $req->get_param( 'fullName' ) );

		$order = self::build_order( $user, $items, $phone, $name, $how, $where );
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		// A company's buyer: over their limit the order is refused, under
		// it the order is filed in the company's name for the owner to see.
		$limit = get_user_meta( $user->ID, 'ah_spending_limit', true );
		if ( '' !== $limit && (int) $limit > 0 && AH_Shape::money( $order->get_total() ) > (int) $limit ) {
			$order->delete( true );
			return self::err( 'ah_over_limit', sprintf( 'This is over your spending limit of UGX %s per order.', number_format( (int) $limit ) ), 403 );
		}
		$company = (int) get_user_meta( $user->ID, 'ah_company_id', true );
		if ( $company ) {
			$order->update_meta_data( '_ah_company_id', $company );
			$order->update_meta_data( '_ah_company_name', (string) get_user_meta( $user->ID, 'ah_company_name', true ) );
			$order->save();
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
	 * A sale for somebody standing at the counter.
	 *
	 * Becomes an ordinary order waiting for payment, so everything after
	 * it — the receipt, Accounts checking it, the store releasing the
	 * goods, the reports — is exactly what an order from the app gets.
	 * Nothing about a counter sale is a separate system.
	 *
	 * Who it is for, in order of preference:
	 *   customerId     somebody already on the list
	 *   phone (+name)  found by number, or added there and then
	 *   neither        an anonymous walk-in — not everyone wants to give
	 *                  a name to buy a box of nails
	 */
	public static function counter_sale( $req ) {
		$items = (array) $req->get_param( 'items' );
		if ( ! $items ) {
			return self::err( 'ah_empty', 'Add at least one item to the sale', 400 );
		}

		$customer = null;
		$id       = (int) $req->get_param( 'customerId' );
		$phone    = trim( (string) $req->get_param( 'phone' ) );
		$name     = trim( sanitize_text_field( (string) $req->get_param( 'name' ) ) );

		if ( $id ) {
			$customer = get_user_by( 'id', $id );
			if ( ! $customer || AH_Roles::desk_of( $customer ) ) {
				return self::err( 'ah_no_customer', 'That customer is not on the list', 404 );
			}
		} elseif ( '' !== $phone ) {
			$customer = AH_Auth::user_by_phone( $phone );
			if ( $customer && AH_Roles::desk_of( $customer ) ) {
				return self::err( 'ah_staff_number', 'That number belongs to a member of staff', 400 );
			}
			if ( ! $customer ) {
				if ( mb_strlen( $name ) < 2 ) {
					return self::err( 'ah_need_name', 'That number is new. Add their name too, or leave the number blank for a walk-in.', 400 );
				}
				// The same checks and the same record as adding a customer
				// from the Customers screen — one way to make a customer.
				$add = new WP_REST_Request( 'POST', '/' . self::NS . '/customers' );
				$add->set_param( 'fullName', $name );
				$add->set_param( 'phone', $phone );
				$add->set_param( 'welcome', (bool) $req->get_param( 'welcome' ) );
				$made = AH_Customers::create( $add );
				if ( is_wp_error( $made ) ) {
					return $made;
				}
				$customer = get_user_by( 'id', (int) $made['customer']['id'] );
			}
		}

		$how   = 'delivery' === $req->get_param( 'fulfilment' ) ? 'shop_delivery' : 'pickup';
		$where = trim( (string) $req->get_param( 'address' ) );
		if ( 'shop_delivery' === $how && '' === $where ) {
			return self::err( 'ah_no_address', 'Say where to deliver it', 400 );
		}

		$bill_name  = $customer ? $customer->display_name : 'Walk-in customer';
		$bill_phone = $customer ? (string) get_user_meta( $customer->ID, 'ah_phone', true ) : '';

		$order = self::build_order( $customer, $items, $bill_phone, $bill_name, $how, $where, 'counter', trim( sanitize_textarea_field( (string) $req->get_param( 'override' ) ) ) );
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		$staff = AH_Auth::current();
		$order->update_meta_data( '_ah_taken_by', $staff->ID );
		$note = trim( sanitize_textarea_field( (string) $req->get_param( 'notes' ) ) );
		// Kept beside the delivery note, which the driver needs.
		$order->set_customer_note( 'Sold at the counter by ' . $staff->display_name . ' · ' . $order->get_customer_note() . ( $note ? "\n" . $note : '' ) );
		$order->save();

		AH_Flow::log_event( $order->get_id(), 'cashier', 'counter_sale', null, 'pending_payment', $staff->ID, $order->get_item_count() . ' item(s)' );

		return array( 'order' => AH_Shape::order( $order, true ) );
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
	private static function build_order( $user, $items, $phone, $name, $how, $where, $source = 'app', $override = '' ) {
		$checked = self::check_sale( $items, $source, $override );
		if ( is_wp_error( $checked ) ) {
			return $checked;
		}

		// No account at all is allowed: a walk-in who would rather not
		// give a name or number. WooCommerce calls that a guest order.
		$order = wc_create_order( array( 'customer_id' => $user ? $user->ID : 0 ) );

		foreach ( $checked['lines'] as $line ) {
			$item_id = $order->add_product( $line['product'], $line['qty'] );
			// The latest purchase cost, stamped on the line as it is sold.
			// Nobody types it, so margins cannot be made up afterwards.
			if ( $item_id ) {
				wc_update_order_item_meta( $item_id, '_ah_unit_cost', $line['cost'] );
			}
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
		$order->update_meta_data( '_ah_source', $source );
		$order->update_meta_data( '_ah_delivery_choice', $how );
		if ( $where ) {
			$order->update_meta_data( '_ah_location', $where );
		}

		$order->set_customer_note( self::delivery_note( $how, $where ) );
		$order->calculate_totals();
		$order->set_status( 'pending' );
		$order->save();

		// The manager's reasons, now there is an order to pin them to.
		foreach ( $checked['overrides'] as $o ) {
			AH_Ledger::override( $o['rule'], $checked['reason'], array(
				'product_id' => $o['productId'],
				'order_id'   => $order->get_id(),
				'detail'     => AH_Shape::order_no( $order ) . ' · ' . $o['detail'],
			) );
		}

		AH_Flow::on_new_order( $order, false );

		return $order;
	}

	/**
	 * The rules a sale has to pass before it becomes an order.
	 *
	 * Refused outright: a line with no item, no quantity or no price.
	 * Refused unless the manager overrides it with a reason: selling
	 * more than the book holds (less what is sold and waiting to be
	 * released), and selling below the latest purchase cost. A customer
	 * on the app is simply told; only a manager at a desk can override.
	 *
	 * @return array|WP_Error [ 'lines', 'overrides', 'reason' ]
	 */
	public static function check_sale( $items, $source = 'app', $override = '' ) {
		if ( ! is_array( $items ) || ! $items ) {
			return self::err( 'ah_empty', 'Add at least one item to the sale', 400 );
		}

		// The same item on two lines counts as one, against the book.
		$want = array();
		foreach ( $items as $i => $line ) {
			$product_id = isset( $line['productId'] ) ? (int) $line['productId'] : 0;
			$qty        = isset( $line['quantity'] ) ? (float) $line['quantity'] : 0;
			$product    = $product_id ? wc_get_product( $product_id ) : null;
			if ( ! $product || 'trash' === $product->get_status() ) {
				return self::err( 'ah_bad_product', 'Line ' . ( $i + 1 ) . ' has no item, or the item is no longer sold', 400 );
			}
			if ( $qty <= 0 ) {
				return self::err( 'ah_bad_qty', sprintf( 'Enter how many %s', $product->get_name() ), 400 );
			}
			if ( (int) round( (float) $product->get_price() ) <= 0 ) {
				return self::err( 'ah_no_price', sprintf( '%s has no selling price yet. The manager sets it on Products.', $product->get_name() ), 400 );
			}
			if ( ! isset( $want[ $product_id ] ) ) {
				$want[ $product_id ] = array( 'product' => $product, 'qty' => 0 );
			}
			$want[ $product_id ]['qty'] += $qty;
		}

		$problems = array();
		$lines    = array();
		foreach ( $want as $id => $w ) {
			$product  = $w['product'];
			$unit     = get_post_meta( $id, '_ah_unit', true ) ?: 'pc';
			$book     = AH_Ledger::book( $id );
			$reserved = AH_Ledger::reserved( $id );
			$reserved = isset( $reserved[ $id ] ) ? $reserved[ $id ] : 0;
			$price    = (int) round( (float) $product->get_price() );
			$cost     = (int) get_post_meta( $id, '_ah_cost', true );

			foreach ( AH_Stock_Math::sale_problems( $book, $reserved, $w['qty'], $price, $cost ) as $rule ) {
				$free       = max( 0, $book - $reserved );
				$problems[] = array(
					'rule'      => $rule,
					'productId' => $id,
					'name'      => $product->get_name(),
					'detail'    => 'negative_stock' === $rule
						? sprintf( '%d %s wanted, %d in stock%s', $w['qty'], $unit, $free, $reserved ? " ({$reserved} more sold, waiting to be released)" : '' )
						: sprintf( 'Price UGX %s is below the buy price UGX %s', number_format( $price ), number_format( $cost ) ),
				);
			}
			// The line carries the average cost: what the goods cost the
			// shop. The floor checked above is the latest buy price.
			$lines[] = array( 'product' => $product, 'qty' => $w['qty'], 'cost' => AH_Stock::cost_of( $id ) );
		}

		if ( ! $problems ) {
			return array( 'lines' => $lines, 'overrides' => array(), 'reason' => '' );
		}

		$is_manager = 'manager' === AH_Roles::desk_of( AH_Auth::current() );
		if ( 'app' === $source || ! $is_manager || mb_strlen( $override ) < 5 ) {
			$first = $problems[0];
			$say   = 'negative_stock' === $first['rule']
				? sprintf( 'Not enough %s in stock: %s.', $first['name'], $first['detail'] )
				: sprintf( '%s would be sold below cost: %s.', $first['name'], $first['detail'] );
			if ( 'app' !== $source ) {
				$say .= $is_manager
					? ' To sell anyway, give a reason for overriding.'
					: ' Only the manager can override this.';
			}
			return new WP_Error( 'ah_sale_blocked', $say, array(
				'status'      => 409,
				'problems'    => 'app' === $source ? array() : $problems,
				'canOverride' => $is_manager && 'app' !== $source,
			) );
		}

		return array( 'lines' => $lines, 'overrides' => $problems, 'reason' => $override );
	}

	private static function delivery_note( $how, $where ) {
		switch ( $how ) {
			case 'own_transport':
				return "Collected from the shop by the customer's own delivery man"
					. ( $where ? ", going to {$where}" : '' );
			case 'pickup':
				return 'Customer is collecting from the shop';
			default:
				return 'Shop delivery, free';
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

	public static function store_lookup( $req ) {
		$raw = strtoupper( trim( (string) $req->get_param( 'no' ) ) );
		$id  = (int) preg_replace( '/\D/', '', $raw );
		$order = $id ? wc_get_order( $id ) : null;
		if ( ! $order || ! in_array( $order->get_type(), array( 'shop_order' ), true ) ) {
			return self::err( 'ah_not_found', 'No order with that number. Check it against the receipt.', 404 );
		}
		$row    = AH_Shape::order( $order, true );
		$status = $row['status'];
		$say    = array(
			'pending_payment'  => 'Not paid yet. Send the customer to the cashier.',
			'paid'             => 'Paid, but Accounts has not checked the payment yet. Do not release.',
			'rejected'         => 'The payment was rejected. Do not release.',
			'payment_verified' => 'Paid and checked. Ready to deliver.',
			'released'         => 'Everything on this order has already been delivered.',
			'cancelled'        => 'This order was cancelled. Do not release.',
			'refunded'         => 'This order was refunded. Do not release.',
		);
		$row['canRelease'] = 'payment_verified' === $status;
		$row['advice']     = $say[ $status ] ?? '';
		foreach ( $row['items'] as &$it ) {
			$it['qty_to_deliver'] = max( 0, (float) $it['quantity'] - (float) $it['qty_released'] );
		}
		unset( $it );
		AH_Flow::log_event( $order->get_id(), 'store', 'looked_up', null, null, AH_Auth::current()->ID, 'Order opened at the store' );
		return array( 'order' => $row );
	}

	public static function release( $req ) {
		$user = AH_Auth::current();
		return self::wrap(
			AH_Flow::release_order(
				(int) $req['id'],
				array(
					'collected_by'    => $req->get_param( 'collectedBy' ),
					'delivery_status' => $req->get_param( 'deliveryStatus' ),
					// { itemId: qty } for a part delivery; absent means all of it.
					'lines'           => is_array( $req->get_param( 'lines' ) ) ? $req->get_param( 'lines' ) : null,
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
