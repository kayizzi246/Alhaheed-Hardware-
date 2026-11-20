<?php
/**
 * The four desks, as WordPress roles.
 *
 * Each one can see its own screen and nothing else — a cashier cannot
 * open the manager's reports by typing the URL, because the capability
 * is checked on the page and again on every action and every REST call.
 *
 * None of them get `edit_posts` or anything else WordPress-ish. A
 * cashier is at a counter, not writing blog posts, and an account that
 * can only do its job is one that cannot be used for anything else if
 * the password walks out of the building.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Roles {

	/** role slug => [display name, capability] */
	public static function map() {
		return array(
			'ah_cashier'  => array( 'Cashier', 'ah_desk_cashier' ),
			'ah_accounts' => array( 'Accounts', 'ah_desk_accounts' ),
			'ah_store'    => array( 'Store Manager', 'ah_desk_store' ),
			'ah_manager'  => array( 'Shop Manager', 'ah_desk_manager' ),
		);
	}

	public static function add() {
		foreach ( self::map() as $slug => $spec ) {
			list( $name, $cap ) = $spec;

			// read: so they can load wp-admin at all.
			$caps = array( 'read' => true, $cap => true );

			// The manager oversees every desk, so holds all four.
			if ( 'ah_manager' === $slug ) {
				foreach ( self::map() as $other ) {
					$caps[ $other[1] ] = true;
				}
			}

			remove_role( $slug );          // so a changed capability set applies
			add_role( $slug, $name, $caps );
		}

		// Whoever administers the site can always reach every desk,
		// otherwise a misconfigured shop locks everybody out.
		$admin = get_role( 'administrator' );
		if ( $admin ) {
			foreach ( self::map() as $spec ) {
				$admin->add_cap( $spec[1] );
			}
		}
	}

	/** The desk a user belongs to: cashier | accounts | store | manager. */
	public static function desk_of( $user = null ) {
		$user = $user ? $user : wp_get_current_user();
		if ( ! $user || ! $user->ID ) {
			return null;
		}

		// Checked most-privileged first: a manager holds every
		// capability, and should land on the manager's screen.
		foreach ( array( 'manager', 'store', 'accounts', 'cashier' ) as $desk ) {
			if ( user_can( $user, 'ah_desk_' . $desk ) ) {
				return $desk;
			}
		}
		return null;
	}

	/** True when this account is a customer rather than shop staff. */
	public static function is_customer( $user ) {
		return ! self::desk_of( $user );
	}
}
