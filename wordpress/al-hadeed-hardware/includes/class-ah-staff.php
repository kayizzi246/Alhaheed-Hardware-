<?php
/**
 * Staff: hiring them, and keeping customers out of the way.
 *
 * Two jobs that belong together because they are the same mistake seen
 * from both ends — the Users screen in WordPress treats a customer who
 * once bought a bag of cement and the cashier who sold it as the same
 * kind of record, and they are not.
 *
 * A customer is a WooCommerce customer. They arrive by ordering, there
 * will eventually be thousands of them, and nobody administers them
 * one at a time from the Users screen. Staff are a handful of people
 * who need an account made for them on purpose.
 *
 * So customers are hidden from Users (they are still there, still
 * WooCommerce customers, still visible under WooCommerce → Customers
 * and on the panel's own Customers screen), and the manager can hire
 * somebody from the panel without going into WordPress at all.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Staff {

	public static function init() {
		// Keep customers off the Users screen.
		add_action( 'pre_get_users', array( __CLASS__, 'hide_customers' ) );
		add_filter( 'views_users', array( __CLASS__, 'fix_counts' ) );
	}

	public static function routes() {
		$ns      = AH_Rest::NS;
		$post    = WP_REST_Server::CREATABLE;
		$manager = AH_Rest::desk( array( 'manager' ) );

		register_rest_route( $ns, '/manager/staff/create', array(
			'methods'             => $post,
			'permission_callback' => $manager,
			'callback'            => array( __CLASS__, 'create' ),
		) );

		register_rest_route( $ns, '/manager/staff/(?P<id>\d+)', array(
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'permission_callback' => $manager,
				'callback'            => array( __CLASS__, 'update' ),
			),
			// One person: who they are, and what they have been doing.
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => $manager,
				'callback'            => array( __CLASS__, 'activity' ),
			),
			array(
				'methods'             => WP_REST_Server::DELETABLE,
				'permission_callback' => $manager,
				'callback'            => array( __CLASS__, 'remove' ),
			),
		) );

		// The same, from a POST, for hosts that refuse DELETE.
		register_rest_route( $ns, '/manager/staff/(?P<id>\d+)/delete', array(
			'methods'             => $post,
			'permission_callback' => $manager,
			'callback'            => array( __CLASS__, 'remove' ),
		) );

		register_rest_route( $ns, '/manager/staff/(?P<id>\d+)/password', array(
			'methods'             => $post,
			'permission_callback' => $manager,
			'callback'            => array( __CLASS__, 'set_password' ),
		) );
	}

	// -----------------------------------------------------------------
	// Customers belong to WooCommerce, not to Users
	// -----------------------------------------------------------------

	/**
	 * Drop customers from the Users list.
	 *
	 * Only the list — a customer is still a user, still signs in, still
	 * appears under WooCommerce → Customers and on the panel's own
	 * Customers screen. This is about what the Users screen is *for*:
	 * the people who work here.
	 *
	 * Somebody who deliberately filters to the Customer role still gets
	 * them, because then they have asked.
	 */
	public static function hide_customers( $query ) {
		if ( ! is_admin() || ! function_exists( 'get_current_screen' ) ) {
			return;
		}
		$screen = get_current_screen();
		if ( ! $screen || 'users' !== $screen->id ) {
			return;
		}
		// They asked for customers by name; give them customers.
		if ( ! empty( $_GET['role'] ) ) {
			return;
		}

		$exclude = $query->get( 'role__not_in' );
		$exclude = is_array( $exclude ) ? $exclude : array();
		$query->set( 'role__not_in', array_merge( $exclude, array( 'customer' ) ) );
	}

	/**
	 * The "All (n)" count above the list counts everybody, including the
	 * customers that are no longer shown. A count that does not match
	 * the rows under it is worse than no count, so it is relabelled for
	 * what the screen now holds.
	 */
	public static function fix_counts( $views ) {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || 'users' !== $screen->id ) {
			return $views;
		}

		$staff = count_users();
		$total = 0;
		foreach ( $staff['avail_roles'] as $role => $n ) {
			if ( 'customer' !== $role && 'none' !== $role ) {
				$total += $n;
			}
		}

		if ( isset( $views['all'] ) ) {
			$views['all'] = preg_replace( '/\(\d+\)/', '(' . $total . ')', $views['all'] );
			$views['all'] = str_replace( '>All', '>Staff', $views['all'] );
		}

		$customers = isset( $staff['avail_roles']['customer'] ) ? (int) $staff['avail_roles']['customer'] : 0;
		if ( $customers && class_exists( 'WooCommerce' ) ) {
			$views['ah_customers'] = sprintf(
				'<a href="%s">%s <span class="count">(%d)</span></a>',
				esc_url( admin_url( 'admin.php?page=wc-admin&path=/customers' ) ),
				'Customers in WooCommerce',
				$customers
			);
		}

		return $views;
	}

	// -----------------------------------------------------------------
	// Hiring, from the panel
	// -----------------------------------------------------------------

	/** The desks a manager may hire into, and the role behind each. */
	public static function desks() {
		return array(
			'cashier'  => array( 'ah_cashier', 'Cashier' ),
			'accounts' => array( 'ah_accounts', 'Accounts' ),
			'store'    => array( 'ah_store', 'Store Manager' ),
			'manager'  => array( 'ah_manager', 'Manager' ),
		);
	}

	/**
	 * Whether a password is good enough to open a desk with the till on it.
	 *
	 * Eight characters with a letter and a number. Not stricter: a rule
	 * nobody can remember ends up on a sticky note on the till.
	 *
	 * @return true|WP_Error
	 */
	public static function check_password( $password ) {
		$password = (string) $password;
		if ( strlen( $password ) < 8 ) {
			return new WP_Error( 'ah_weak_password', 'The password needs at least 8 characters.', array( 'status' => 400 ) );
		}
		if ( ! preg_match( '/[A-Za-z]/', $password ) || ! preg_match( '/\d/', $password ) ) {
			return new WP_Error( 'ah_weak_password', 'Use at least one letter and one number in the password.', array( 'status' => 400 ) );
		}
		if ( preg_match( '/^(?:password|cashier|manager|store|alhadeed)\d*$/i', $password ) ) {
			return new WP_Error( 'ah_weak_password', 'That password is too easy to guess. Pick another.', array( 'status' => 400 ) );
		}
		return true;
	}

	/**
	 * Put somebody on a desk.
	 *
	 * The manager sets their password, so they can hand it over in person
	 * and sign in to the account themselves to see what it sees. Left
	 * blank, one is generated and the person signs in with a code sent to
	 * their phone instead.
	 *
	 * The password is never sent by SMS: a text message sits on the
	 * phone in plain sight for as long as nobody deletes it.
	 */
	public static function create( $req ) {
		$name  = trim( (string) $req->get_param( 'fullName' ) );
		$phone = AH_Sms::normalise_phone( $req->get_param( 'phone' ) );
		$email = sanitize_email( (string) $req->get_param( 'email' ) );
		$desk  = (string) $req->get_param( 'desk' );

		$desks = self::desks();
		if ( ! isset( $desks[ $desk ] ) ) {
			return new WP_Error( 'ah_bad_desk', 'Pick a desk for them', array( 'status' => 400 ) );
		}
		if ( strlen( $name ) < 2 ) {
			return new WP_Error( 'ah_bad_name', 'Enter their name', array( 'status' => 400 ) );
		}
		if ( ! $phone ) {
			return new WP_Error( 'ah_bad_phone', 'Enter the phone number they will sign in with', array( 'status' => 400 ) );
		}
		if ( AH_Auth::user_by_phone( $phone ) ) {
			return new WP_Error(
				'ah_phone_taken',
				'That number already has an account. Change the existing one instead of making a second.',
				array( 'status' => 409 )
			);
		}
		if ( $email && email_exists( $email ) ) {
			return new WP_Error( 'ah_email_taken', 'That email already has an account', array( 'status' => 409 ) );
		}

		$password = (string) $req->get_param( 'password' );
		if ( '' !== $password ) {
			$ok = self::check_password( $password );
			if ( is_wp_error( $ok ) ) {
				return $ok;
			}
		}

		$login = 'ah' . preg_replace( '/\D/', '', $phone );
		if ( username_exists( $login ) ) {
			$login .= wp_rand( 10, 99 );
		}

		$user_id = wp_insert_user( array(
			'user_login'   => $login,
			'user_pass'    => '' !== $password ? $password : wp_generate_password( 24 ),
			'user_email'   => $email ? $email : '',
			'display_name' => $name,
			'first_name'   => $name,
			'role'         => $desks[ $desk ][0],
		) );

		if ( is_wp_error( $user_id ) ) {
			return new WP_Error( 'ah_failed', 'Could not add them: ' . $user_id->get_error_message(), array( 'status' => 400 ) );
		}

		update_user_meta( $user_id, 'ah_phone', $phone );
		update_user_meta( $user_id, 'billing_phone', $phone );
		update_user_meta( $user_id, 'ah_status', 'active' );

		update_user_meta( $user_id, 'ah_hired_by', get_current_user_id() );

		AH_Sms::send(
			$phone,
			'' !== $password
				? sprintf(
					'%s: you have been set up on the %s desk. Sign in to the staff panel with this number and the password your manager gives you.',
					AH_Sms::shop_name(),
					$desks[ $desk ][1]
				)
				: sprintf(
					'%s: you have been set up on the %s desk. Open the staff panel and sign in with this number. It will text you a code.',
					AH_Sms::shop_name(),
					$desks[ $desk ][1]
				)
		);

		self::audit( 'staff_added', $name . ' added to ' . $desks[ $desk ][1] . ( '' !== $password ? ', password set by the manager' : '' ) );

		return array(
			'staff'       => AH_Shape::user( $user_id ),
			'signInWith'  => $phone,
			'passwordSet' => '' !== $password,
		);
	}

	/** Suspend somebody, put them back, or move them to another desk. */
	public static function update( $req ) {
		$id   = (int) $req['id'];
		$user = get_user_by( 'id', $id );

		if ( ! $user || ! AH_Roles::desk_of( $user ) ) {
			return new WP_Error( 'ah_not_found', 'That is not a member of staff', array( 'status' => 404 ) );
		}
		if ( $id === get_current_user_id() ) {
			return new WP_Error(
				'ah_self',
				'You cannot change your own desk or suspend yourself.',
				array( 'status' => 400 )
			);
		}

		$status = $req->get_param( 'status' );
		if ( null !== $status ) {
			update_user_meta( $id, 'ah_status', 'suspended' === $status ? 'suspended' : 'active' );
			self::audit( 'staff_' . ( 'suspended' === $status ? 'suspended' : 'restored' ), $user->display_name );
			// Suspending somebody also signs them out, now, rather than
			// whenever their session happens to run out.
			if ( 'suspended' === $status ) {
				AH_Auth::end_sessions( $id );
			}
		}

		$desk  = $req->get_param( 'desk' );
		$desks = self::desks();
		if ( $desk && isset( $desks[ $desk ] ) ) {
			$user->set_role( $desks[ $desk ][0] );
			self::audit( 'staff_moved', $user->display_name . ' → ' . $desks[ $desk ][1] );
		}

		if ( $req->get_param( 'fullName' ) ) {
			wp_update_user( array( 'ID' => $id, 'display_name' => sanitize_text_field( $req->get_param( 'fullName' ) ) ) );
		}

		return array( 'staff' => AH_Shape::user( $id ) );
	}

	/**
	 * Take somebody off the desks for good.
	 *
	 * Their login goes: no desk, a password nobody knows, every session
	 * ended, and their phone number and email freed so they can be given
	 * to somebody else. The record itself stays behind with their name,
	 * because receipts, expenses and the audit trail all say who did
	 * what by pointing at it. Deleting it outright would turn every one
	 * of those into a blank.
	 */
	public static function remove( $req ) {
		$id   = (int) $req['id'];
		$user = get_user_by( 'id', $id );

		if ( ! $user || ! AH_Roles::desk_of( $user ) ) {
			return new WP_Error( 'ah_not_found', 'That is not a member of staff', array( 'status' => 404 ) );
		}
		if ( $id === get_current_user_id() ) {
			return new WP_Error( 'ah_self', 'You cannot delete yourself.', array( 'status' => 400 ) );
		}
		if ( user_can( $user, 'manage_options' ) ) {
			return new WP_Error( 'ah_owner', 'That is the owner\'s account. It cannot be deleted from here.', array( 'status' => 403 ) );
		}

		$name  = $user->display_name;
		$desk  = AH_Roles::desk_of( $user );
		$phone = (string) get_user_meta( $id, 'ah_phone', true );

		AH_Auth::end_sessions( $id );
		$user->set_role( '' );
		wp_set_password( wp_generate_password( 40, true, true ), $id );
		wp_update_user( array( 'ID' => $id, 'user_email' => '' ) );

		update_user_meta( $id, 'ah_status', 'suspended' );
		update_user_meta( $id, 'ah_deleted', current_time( 'mysql' ) );
		update_user_meta( $id, 'ah_deleted_by', get_current_user_id() );
		if ( $phone ) {
			update_user_meta( $id, 'ah_phone_was', $phone );
		}
		delete_user_meta( $id, 'ah_phone' );
		delete_user_meta( $id, 'billing_phone' );

		self::audit( 'staff_deleted', $name . ( $desk ? ' · ' . ucfirst( $desk ) : '' ) );

		return array( 'ok' => true, 'name' => $name );
	}

	/**
	 * Write a staff change to the audit trail.
	 *
	 * The earlier calls passed the manager's ID where the "from" status
	 * goes and the note where the "to" status goes, so the trail said a
	 * staff member was added but never who added them.
	 */
	private static function audit( $action, $note ) {
		AH_Flow::log_event( 0, 'manager', $action, null, null, get_current_user_id(), $note );
	}

	/**
	 * Set a new password for somebody on a desk.
	 *
	 * For the person who has forgotten theirs, and for the account of
	 * somebody who has left. Every session they had open ends at once.
	 *
	 * Only for the desks below the manager: a manager who could reset
	 * another manager's password could take over that account, and the
	 * owner's administrator account is not this screen's to touch.
	 */
	public static function set_password( $req ) {
		$id   = (int) $req['id'];
		$user = get_user_by( 'id', $id );
		$desk = $user ? AH_Roles::desk_of( $user ) : null;

		if ( ! $user || ! $desk ) {
			return new WP_Error( 'ah_not_found', 'That is not a member of staff', array( 'status' => 404 ) );
		}
		if ( $id === get_current_user_id() ) {
			return new WP_Error( 'ah_self', 'Change your own password from your profile, not from here.', array( 'status' => 400 ) );
		}
		if ( 'manager' === $desk || user_can( $user, 'manage_options' ) ) {
			return new WP_Error(
				'ah_not_yours',
				'A manager\'s password can only be changed by that manager or the site owner.',
				array( 'status' => 403 )
			);
		}

		$password = (string) $req->get_param( 'password' );
		$ok       = self::check_password( $password );
		if ( is_wp_error( $ok ) ) {
			return $ok;
		}

		// wp_set_password() also ends the person's wp-admin sessions;
		// end_sessions() ends the panel's and the app's.
		wp_set_password( $password, $id );
		AH_Auth::end_sessions( $id );

		self::audit( 'staff_password_set', $user->display_name );

		return array( 'ok' => true, 'signInWith' => get_user_meta( $id, 'ah_phone', true ) );
	}

	/**
	 * One member of staff: who they are, and what they have done.
	 *
	 * Built from the records the work already leaves behind: receipts for
	 * a cashier, verifications for Accounts, releases for the store, and
	 * the audit trail for everybody. Nothing extra is tracked to make
	 * this page; it reads what was there.
	 */
	public static function activity( $req ) {
		global $wpdb;
		$id   = (int) $req['id'];
		$user = get_user_by( 'id', $id );
		$desk = $user ? AH_Roles::desk_of( $user ) : null;

		if ( ! $user || ! $desk ) {
			return new WP_Error( 'ah_not_found', 'That is not a member of staff', array( 'status' => 404 ) );
		}

		$pay    = AH_Install::table( 'payments' );
		$events = AH_Install::table( 'events' );
		$spend  = AH_Install::table( 'expenses' );
		$today  = current_time( 'Y-m-d' );
		$month  = current_time( 'Y-m' ) . '-01';

		$span = function ( $sql, $from ) use ( $wpdb, $id ) {
			return $wpdb->get_row( $wpdb->prepare( $sql, $id, $from ), ARRAY_A );
		};

		// ── Money they took (cashier) ──
		$takings = array();
		foreach ( array( 'today' => $today, 'month' => $month ) as $key => $from ) {
			$row = $span(
				"SELECT COUNT(*) AS receipts, COALESCE(SUM(amount_paid),0) AS total,
				        SUM(method = 'cash') AS cash_n, COALESCE(SUM(IF(method = 'cash', amount_paid, 0)),0) AS cash,
				        COALESCE(SUM(IF(method = 'mobile_money', amount_paid, 0)),0) AS momo,
				        COALESCE(SUM(IF(method = 'card', amount_paid, 0)),0) AS card,
				        SUM(verified = -1) AS sent_back
				   FROM {$pay} WHERE cashier_id = %d AND DATE(created_at) >= %s",
				$from
			);
			$takings[ $key ] = array_map( 'intval', $row );
		}

		// ── What they checked (accounts) ──
		$checks = array();
		foreach ( array( 'today' => $today, 'month' => $month ) as $key => $from ) {
			$row = $span(
				"SELECT SUM(verified = 1) AS verified, SUM(verified = -1) AS rejected
				   FROM {$pay} WHERE verified_by = %d AND DATE(verified_at) >= %s",
				$from
			);
			$checks[ $key ] = array_map( 'intval', $row );
		}

		// ── Everything they did, by kind ──
		$actions = array();
		foreach ( array( 'today' => $today, 'month' => $month ) as $key => $from ) {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT action, COUNT(*) AS n FROM {$events}
					  WHERE handled_by = %d AND DATE(created_at) >= %s GROUP BY action",
					$id,
					$from
				),
				ARRAY_A
			);
			$actions[ $key ] = array();
			foreach ( (array) $rows as $r ) {
				$actions[ $key ][ $r['action'] ] = (int) $r['n'];
			}
		}

		// ── The latest of it, in order ──
		$recent = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT order_id, stage, action, to_status, notes, created_at FROM {$events}
				  WHERE handled_by = %d ORDER BY id DESC LIMIT 40",
				$id
			),
			ARRAY_A
		);
		$recent = array_map(
			function ( $r ) {
				$order = (int) $r['order_id'] ? wc_get_order( (int) $r['order_id'] ) : null;
				return array(
					'at'      => $r['created_at'],
					'action'  => $r['action'],
					'orderNo' => $order ? AH_Shape::order_no( $order ) : null,
					'orderId' => $order ? $order->get_id() : null,
					'notes'   => $r['notes'],
				);
			},
			(array) $recent
		);

		// ── Their receipts, with what Accounts made of each ──
		$receipts = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, order_id, receipt_no, amount_paid, method, transaction_ref, verified,
				        verifier_name, verify_remarks, proof_file, created_at
				   FROM {$pay} WHERE cashier_id = %d ORDER BY id DESC LIMIT 30",
				$id
			),
			ARRAY_A
		);
		$receipts = array_map(
			function ( $r ) {
				$order = wc_get_order( (int) $r['order_id'] );
				return array(
					'paymentId' => (int) $r['id'],
					'receiptNo' => $r['receipt_no'],
					'orderNo'   => $order ? AH_Shape::order_no( $order ) : '#' . $r['order_id'],
					'amount'    => (int) $r['amount_paid'],
					'method'    => $r['method'],
					'ref'       => $r['transaction_ref'],
					'state'     => 1 === (int) $r['verified'] ? 'verified' : ( -1 === (int) $r['verified'] ? 'rejected' : 'waiting' ),
					'checkedBy' => $r['verifier_name'],
					'remarks'   => $r['verify_remarks'],
					'hasProof'  => ! empty( $r['proof_file'] ),
					'at'        => $r['created_at'],
				);
			},
			(array) $receipts
		);

		// ── Money they asked for ──
		$requests = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT ref, kind, details, amount, status, created_at FROM {$spend}
				  WHERE raised_by = %d ORDER BY id DESC LIMIT 15",
				$id
			),
			ARRAY_A
		);

		$hired_by = (int) get_user_meta( $id, 'ah_hired_by', true );
		$hirer    = $hired_by ? get_user_by( 'id', $hired_by ) : null;

		return array(
			'staff'    => array_merge(
				AH_Shape::user( $user ),
				array(
					'desk'      => $desk,
					'status'    => get_user_meta( $id, 'ah_status', true ) ?: 'active',
					'lastSeen'  => get_user_meta( $id, 'ah_last_seen', true ) ?: null,
					'joined'    => $user->user_registered,
					'hiredBy'   => $hirer ? $hirer->display_name : null,
					'canResetPassword' => 'manager' !== $desk && ! user_can( $user, 'manage_options' ) && get_current_user_id() !== $id,
				)
			),
			'takings'  => $takings,
			'checks'   => $checks,
			'actions'  => $actions,
			'recent'   => $recent,
			'receipts' => $receipts,
			'requests' => array_map(
				function ( $r ) {
					$r['amount'] = (int) $r['amount'];
					return $r;
				},
				(array) $requests
			),
		);
	}
}
