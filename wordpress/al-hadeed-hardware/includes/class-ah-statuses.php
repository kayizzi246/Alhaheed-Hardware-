<?php
/**
 * The order's journey, as WooCommerce order statuses.
 *
 * WooCommerce ships with pending / processing / completed, which cannot
 * tell "the cashier has the money" apart from "accounts have checked
 * it" apart from "the store has released the goods". Those are three
 * different desks and three different people's work, so they get three
 * statuses.
 *
 *   pending       waiting at the CASHIER        (WooCommerce's own)
 *   ah-paid       paid, waiting at ACCOUNTS
 *   ah-verified   verified, waiting at the STORE
 *   completed     released to the customer      (WooCommerce's own)
 *   ah-rejected   Accounts could not match it — back to the cashier
 *   cancelled     cancelled
 *   refunded      refunded
 *
 * Using WooCommerce's own pending and completed at the two ends means
 * emails, reports and any other plugin the shop installs still
 * understand the beginning and the end of the journey.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Statuses {

	/** The statuses this plugin adds, slug => label. */
	public static function custom() {
		return array(
			'wc-ah-paid'     => 'Paid, at Accounts',
			'wc-ah-verified' => 'Verified, at Store',
			'wc-ah-rejected' => 'Payment rejected',
		);
	}

	/**
	 * WooCommerce status  ->  the vocabulary the apps already speak.
	 *
	 * The Next.js panel and the phone app were written against the old
	 * Node API, so they know `pending_payment`, `paid`,
	 * `payment_verified` and `released`. Translating here means neither
	 * client had to change.
	 */
	public static function to_api( $wc_status ) {
		$wc_status = (string) $wc_status;
		// Not ltrim(): that strips any of w, c and - from the left, so
		// "completed" quietly becomes "ompleted" and every comparison
		// against it fails.
		if ( 0 === strpos( $wc_status, 'wc-' ) ) {
			$wc_status = substr( $wc_status, 3 );
		}
		$map       = array(
			'pending'     => 'pending_payment',
			'ah-paid'     => 'paid',
			'ah-verified' => 'payment_verified',
			'processing'  => 'payment_verified',
			'completed'   => 'released',
			'ah-rejected' => 'rejected',
			'cancelled'   => 'cancelled',
			'refunded'    => 'refunded',
			'failed'      => 'rejected',
			'on-hold'     => 'pending_payment',
		);
		return isset( $map[ $wc_status ] ) ? $map[ $wc_status ] : $wc_status;
	}

	/** The other direction, for clients that send our vocabulary back. */
	public static function to_wc( $api_status ) {
		$map = array(
			'pending_payment'  => 'pending',
			'paid'             => 'ah-paid',
			'payment_verified' => 'ah-verified',
			'released'         => 'completed',
			'rejected'         => 'ah-rejected',
			'cancelled'        => 'cancelled',
			'refunded'         => 'refunded',
		);
		return isset( $map[ $api_status ] ) ? $map[ $api_status ] : $api_status;
	}

	/** Which desk an order is sitting at right now. */
	public static function stage_of( $wc_status ) {
		switch ( self::to_api( $wc_status ) ) {
			case 'pending_payment':
			case 'rejected':
				return 'cashier';
			case 'paid':
				return 'accounts';
			case 'payment_verified':
				return 'store';
			default:
				return 'done';
		}
	}

	/** What a customer should read on screen. */
	public static function label_of( $wc_status ) {
		$labels = array(
			'pending_payment'  => 'Pending payment',
			'paid'             => 'Paid',
			// The payment has been checked; what is still to happen is
			// the packing. "Verifying" read as though accounts were
			// still looking at it, which is the wrong desk and the
			// wrong worry — for staff and for the customer.
			'payment_verified' => 'Being packed',
			'released'         => 'Released / Completed',
			'rejected'         => 'Payment rejected',
			'cancelled'        => 'Cancelled',
			'refunded'         => 'Refunded',
		);
		$api = self::to_api( $wc_status );
		return isset( $labels[ $api ] ) ? $labels[ $api ] : ucfirst( str_replace( '_', ' ', $api ) );
	}

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register' ) );
		add_filter( 'wc_order_statuses', array( __CLASS__, 'add_to_list' ) );

		// Orders at our custom statuses still count as "needing work",
		// so WooCommerce shows them in its own order-count badges.
		add_filter( 'woocommerce_order_is_paid_statuses', array( __CLASS__, 'paid_statuses' ) );
		add_filter( 'woocommerce_reports_order_statuses', array( __CLASS__, 'report_statuses' ) );
	}

	public static function register() {
		foreach ( self::custom() as $slug => $label ) {
			register_post_status(
				$slug,
				array(
					'label'                     => $label,
					'public'                    => true,
					'exclude_from_search'       => false,
					'show_in_admin_all_list'    => true,
					'show_in_admin_status_list' => true,
					/* translators: %s: order count */
					'label_count'               => _n_noop(
						$label . ' <span class="count">(%s)</span>',
						$label . ' <span class="count">(%s)</span>'
					),
				)
			);
		}
	}

	public static function add_to_list( $statuses ) {
		$out = array();
		foreach ( $statuses as $slug => $label ) {
			$out[ $slug ] = $label;
			// Slot the new ones in where they belong in the journey,
			// rather than at the end where nobody looks.
			if ( 'wc-pending' === $slug ) {
				foreach ( self::custom() as $s => $l ) {
					$out[ $s ] = $l;
				}
			}
		}
		return $out;
	}

	/**
	 * Money has changed hands by the time an order is at Accounts, so
	 * WooCommerce should treat these as paid for its own reporting.
	 */
	public static function paid_statuses( $statuses ) {
		$statuses[] = 'ah-paid';
		$statuses[] = 'ah-verified';
		return $statuses;
	}

	public static function report_statuses( $statuses ) {
		return array_merge( $statuses, array( 'ah-paid', 'ah-verified' ) );
	}
}
