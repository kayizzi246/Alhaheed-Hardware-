<?php
/**
 * Company accounts.
 *
 * A contractor buys on account: one company, several people allowed to
 * order on it, each with a limit on what they may spend. The owner adds
 * and removes those people themselves, from the phone app, rather than
 * ringing the shop.
 *
 * There is no companies table. A company is the set of WordPress users
 * sharing an `ah_company_id`, and that id is the owner's own user id —
 * so creating a company is making one user a `company_owner`, and
 * joining one is pointing at them. One less table to keep in step, and
 * every company is a real account that can sign in.
 *
 *   ah_account_type   individual | company_owner | company_staff
 *   ah_company_id     the owner's user id
 *   ah_company_name   the trading name, copied onto every order
 *   ah_staff_role     free text: "Site foreman", "Driver"
 *   ah_spending_limit shillings per order, or '' for no limit
 *   ah_status         active | suspended
 *
 * The FlutterFlow company widget is the only thing that calls these,
 * and it calls them at exactly these paths and shapes. They were
 * written against a Node API that no longer exists; this is the same
 * contract, kept.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Rest_Company {

	public static function routes() {
		$ns   = AH_Rest::NS;
		$get  = WP_REST_Server::READABLE;
		$post = WP_REST_Server::CREATABLE;
		$edit = WP_REST_Server::EDITABLE;

		$mine  = array( __CLASS__, 'in_a_company' );
		$owner = array( __CLASS__, 'owns_a_company' );

		register_rest_route( $ns, '/company', array(
			'methods'             => $get,
			'permission_callback' => $mine,
			'callback'            => array( __CLASS__, 'company' ),
		) );

		register_rest_route( $ns, '/company/staff', array(
			array(
				'methods'             => $get,
				'permission_callback' => $mine,
				'callback'            => array( __CLASS__, 'staff' ),
			),
			array(
				'methods'             => $post,
				'permission_callback' => $owner,
				'callback'            => array( __CLASS__, 'add_staff' ),
			),
		) );

		register_rest_route( $ns, '/company/staff/(?P<id>\d+)', array(
			'methods'             => $edit,
			'permission_callback' => $owner,
			'callback'            => array( __CLASS__, 'update_staff' ),
		) );

		register_rest_route( $ns, '/company/orders', array(
			'methods'             => $get,
			'permission_callback' => $mine,
			'callback'            => array( __CLASS__, 'orders' ),
		) );
	}

	// -----------------------------------------------------------------
	// Guards
	// -----------------------------------------------------------------

	/** The company this caller belongs to, or 0. */
	public static function company_id( $user = null ) {
		$user = $user ? $user : AH_Auth::current();
		if ( ! $user ) {
			return 0;
		}
		return (int) get_user_meta( $user->ID, 'ah_company_id', true );
	}

	public static function in_a_company() {
		if ( ! AH_Auth::current() ) {
			return new WP_Error( 'ah_unauthorised', 'Not signed in', array( 'status' => 401 ) );
		}
		if ( ! self::company_id() ) {
			return new WP_Error(
				'ah_no_company',
				'This account is not on a company. Ask the shop to set one up.',
				array( 'status' => 403 )
			);
		}
		return true;
	}

	/**
	 * Adding and suspending people is the owner's job alone.
	 *
	 * A foreman with a spending limit who could lift his own limit does
	 * not have a spending limit.
	 */
	public static function owns_a_company() {
		$ok = self::in_a_company();
		if ( true !== $ok ) {
			return $ok;
		}
		$user = AH_Auth::current();
		if ( 'company_owner' !== get_user_meta( $user->ID, 'ah_account_type', true ) ) {
			return new WP_Error(
				'ah_not_owner',
				'Only the account owner can change who may order.',
				array( 'status' => 403 )
			);
		}
		return true;
	}

	// -----------------------------------------------------------------
	// Reading
	// -----------------------------------------------------------------

	public static function company() {
		$id    = self::company_id();
		$owner = get_user_by( 'id', $id );

		$name = $owner ? get_user_meta( $id, 'ah_company_name', true ) : '';

		return array(
			'company' => array(
				'id'           => $id,
				'company_name' => $name ? $name : ( $owner ? $owner->display_name : 'Company account' ),
				'owner_name'   => $owner ? $owner->display_name : null,
				'phone'        => $owner ? ( get_user_meta( $id, 'ah_phone', true ) ?: null ) : null,
				'credit_limit' => (int) get_user_meta( $id, 'ah_credit_limit', true ),
				'status'       => get_user_meta( $id, 'ah_status', true ) ?: 'active',
				'spent'        => self::spent( $id ),
				'staff_count'  => count( self::members( $id ) ),
			),
		);
	}

	public static function staff() {
		$out = array();
		foreach ( self::members( self::company_id() ) as $user ) {
			$out[] = AH_Shape::user( $user );
		}
		return array( 'staff' => $out );
	}

	public static function orders() {
		$id     = self::company_id();
		$orders = wc_get_orders( array(
			'limit'      => 100,
			'orderby'    => 'date',
			'order'      => 'DESC',
			'meta_key'   => '_ah_company_id',
			'meta_value' => $id,
		) );

		return array(
			'orders' => array_map(
				function ( $o ) {
					return AH_Shape::order( $o );
				},
				$orders
			),
		);
	}

	// -----------------------------------------------------------------
	// Writing
	// -----------------------------------------------------------------

	/**
	 * Put somebody on the account.
	 *
	 * Keyed on the phone number, like every other person in this system:
	 * if they have ordered from the shop before, that account joins the
	 * company rather than becoming a second one with the same number.
	 */
	public static function add_staff( $req ) {
		$company = self::company_id();
		$name    = trim( (string) $req->get_param( 'fullName' ) );
		$phone   = AH_Sms::normalise_phone( $req->get_param( 'phone' ) );

		if ( strlen( $name ) < 2 ) {
			return new WP_Error( 'ah_bad_name', 'Enter their name', array( 'status' => 400 ) );
		}
		if ( ! $phone ) {
			return new WP_Error( 'ah_bad_phone', 'Enter the phone number they will order from', array( 'status' => 400 ) );
		}

		$user = AH_Auth::user_by_phone( $phone );

		if ( $user && AH_Roles::desk_of( $user ) ) {
			return new WP_Error(
				'ah_staff_number',
				'That number belongs to a shop account and cannot be added here.',
				array( 'status' => 400 )
			);
		}

		$existing = $user ? (int) get_user_meta( $user->ID, 'ah_company_id', true ) : 0;
		if ( $existing && $existing !== $company ) {
			return new WP_Error(
				'ah_other_company',
				'That number is already on another company account.',
				array( 'status' => 409 )
			);
		}

		if ( ! $user ) {
			$user_id = wp_insert_user( array(
				'user_login'   => 'ah' . preg_replace( '/\D/', '', $phone ),
				'user_pass'    => wp_generate_password( 24 ),
				'display_name' => $name,
				'first_name'   => $name,
				'role'         => 'customer',
			) );
			if ( is_wp_error( $user_id ) ) {
				return new WP_Error( 'ah_user_failed', 'Could not add them: ' . $user_id->get_error_message(), array( 'status' => 400 ) );
			}
			update_user_meta( $user_id, 'ah_phone', $phone );
			update_user_meta( $user_id, 'billing_phone', $phone );
			$user = get_user_by( 'id', $user_id );
		}

		update_user_meta( $user->ID, 'ah_account_type', 'company_staff' );
		update_user_meta( $user->ID, 'ah_company_id', $company );
		update_user_meta( $user->ID, 'ah_company_name', get_user_meta( $company, 'ah_company_name', true ) );
		update_user_meta( $user->ID, 'ah_status', 'active' );
		self::apply_fields( $user->ID, $req );

		AH_Sms::send(
			$phone,
			sprintf(
				'%s: you can now order on the %s account in the app. Sign in with this number.',
				AH_Sms::shop_name(),
				get_user_meta( $company, 'ah_company_name', true ) ?: 'company'
			)
		);

		return array( 'staff' => AH_Shape::user( $user ) );
	}

	public static function update_staff( $req ) {
		$company = self::company_id();
		$id      = (int) $req['id'];
		$user    = get_user_by( 'id', $id );

		if ( ! $user || (int) get_user_meta( $id, 'ah_company_id', true ) !== $company ) {
			return new WP_Error( 'ah_not_found', 'That person is not on this account', array( 'status' => 404 ) );
		}

		// The owner cannot suspend or limit themselves — it would lock
		// the account with nobody able to unlock it.
		$me = AH_Auth::current();
		if ( $id === (int) $me->ID ) {
			return new WP_Error(
				'ah_self',
				'You cannot change your own access. Ask the shop if you need to.',
				array( 'status' => 400 )
			);
		}

		$status = $req->get_param( 'status' );
		if ( null !== $status ) {
			$status = 'suspended' === $status ? 'suspended' : 'active';
			update_user_meta( $id, 'ah_status', $status );

			$phone = get_user_meta( $id, 'ah_phone', true );
			if ( $phone ) {
				AH_Sms::send(
					$phone,
					sprintf(
						'%s: your ordering on the %s account has been %s.',
						AH_Sms::shop_name(),
						get_user_meta( $company, 'ah_company_name', true ) ?: 'company',
						'suspended' === $status ? 'stopped' : 'turned back on'
					)
				);
			}
		}

		self::apply_fields( $id, $req );

		return array( 'staff' => AH_Shape::user( $id ) );
	}

	/** The fields an owner may set on one of their people. */
	private static function apply_fields( $id, $req ) {
		$name = $req->get_param( 'fullName' );
		if ( null !== $name && '' !== trim( (string) $name ) ) {
			wp_update_user( array( 'ID' => $id, 'display_name' => sanitize_text_field( $name ) ) );
		}

		$role = $req->get_param( 'staffRole' );
		if ( null !== $role ) {
			update_user_meta( $id, 'ah_staff_role', sanitize_text_field( (string) $role ) );
		}

		$limit = $req->get_param( 'spendingLimit' );
		if ( null !== $limit ) {
			// An empty limit is "no limit", which is not the same as a
			// limit of zero — zero would stop them ordering at all.
			update_user_meta( $id, 'ah_spending_limit', '' === $limit || null === $limit ? '' : (int) $limit );
		}
	}

	// -----------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------

	/** Everybody on a company, the owner included. */
	private static function members( $company_id ) {
		if ( ! $company_id ) {
			return array();
		}
		return get_users( array(
			'meta_key'   => 'ah_company_id',
			'meta_value' => $company_id,
			'orderby'    => 'display_name',
			'order'      => 'ASC',
			'number'     => 200,
		) );
	}

	/** What the company has spent on orders that were actually paid. */
	private static function spent( $company_id ) {
		$total  = 0;
		$orders = wc_get_orders( array(
			'limit'      => -1,
			'status'     => array( 'wc-ah-paid', 'wc-ah-verified', 'wc-completed' ),
			'meta_key'   => '_ah_company_id',
			'meta_value' => $company_id,
		) );
		foreach ( $orders as $order ) {
			$total += (int) round( (float) $order->get_total() );
		}
		return $total;
	}
}
