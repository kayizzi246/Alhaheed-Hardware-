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
			'methods'             => WP_REST_Server::EDITABLE,
			'permission_callback' => $manager,
			'callback'            => array( __CLASS__, 'update' ),
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
	 * Put somebody on a desk.
	 *
	 * The password is generated and never chosen here. A manager typing
	 * a password for somebody else means two people know it, and the
	 * first thing that person does is keep using it. They get a code by
	 * SMS instead, which is how the desks are meant to be opened
	 * anyway, and they can set a password later from WordPress if they
	 * want one.
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

		$login = 'ah' . preg_replace( '/\D/', '', $phone );
		if ( username_exists( $login ) ) {
			$login .= wp_rand( 10, 99 );
		}

		$user_id = wp_insert_user( array(
			'user_login'   => $login,
			'user_pass'    => wp_generate_password( 24 ),
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

		AH_Sms::send(
			$phone,
			sprintf(
				'%s: you have been set up on the %s desk. Open the staff panel and sign in with this number — it will text you a code.',
				AH_Sms::shop_name(),
				$desks[ $desk ][1]
			)
		);

		AH_Flow::log_event( 0, 'manager', 'staff_added', get_current_user_id(), $name . ' added to ' . $desks[ $desk ][1] );

		return array( 'staff' => AH_Shape::user( $user_id ) );
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
			AH_Flow::log_event(
				0, 'manager', 'staff_' . ( 'suspended' === $status ? 'suspended' : 'restored' ),
				get_current_user_id(), $user->display_name
			);
		}

		$desk  = $req->get_param( 'desk' );
		$desks = self::desks();
		if ( $desk && isset( $desks[ $desk ] ) ) {
			$user->set_role( $desks[ $desk ][0] );
			AH_Flow::log_event( 0, 'manager', 'staff_moved', get_current_user_id(), $user->display_name . ' → ' . $desks[ $desk ][1] );
		}

		if ( $req->get_param( 'fullName' ) ) {
			wp_update_user( array( 'ID' => $id, 'display_name' => sanitize_text_field( $req->get_param( 'fullName' ) ) ) );
		}

		return array( 'staff' => AH_Shape::user( $id ) );
	}
}
