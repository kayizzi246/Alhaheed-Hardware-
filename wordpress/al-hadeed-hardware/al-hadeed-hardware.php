<?php
/**
 * Plugin Name:       Al Hadeed Hardware — Ordering & Cash Booking
 * Description:       The shop's order flow inside WordPress: a website order goes Cashier → Accounts → Store Manager, with receipts, a cash book, stock and an audit trail. Runs on the hosting you already pay for.
 * Version:           1.23.1
 * Requires at least: 6.2
 * Requires PHP:      7.4
 * Author:            Kayizzi Badru
 * Text Domain:       al-hadeed
 *
 * ---------------------------------------------------------------------
 * WHY THIS EXISTS AS A PLUGIN
 *
 * The same system was first built as a Node API with its own web panel.
 * It works, but it needs a server that stays awake and a database that
 * does not expire, and every free tier offering those turns out to be a
 * trial with a deadline attached.
 *
 * WordPress hosting is already paid for, already on 24/7, already has
 * MySQL, and already runs the shop's website. So the desks move here:
 * one plugin, no second bill, nothing to keep alive.
 *
 * ---------------------------------------------------------------------
 * HOW AN ORDER MOVES
 *
 *   CUSTOMER     orders in the mobile app              → pending
 *        ▼
 *   CASHIER      takes the money, issues a receipt     → ah-paid
 *        ▼
 *   ACCOUNTS     checks it against the till / MM       → ah-verified
 *        ▼
 *   STORE        picks, packs, reduces stock, releases → completed
 *        ▼
 *   MANAGER      watches all of it, refunds, reports
 *
 * The customer is texted at every one of those steps.
 *
 * ---------------------------------------------------------------------
 * WHO USES WHAT
 *
 *   Customer       mobile app only
 *   Cashier        mobile app and web panel
 *   Accounts       mobile app and web panel
 *   Store Manager  mobile app only
 *   Manager        mobile app and web panel
 *
 * WooCommerce holds the catalogue, the customers and the orders — the
 * app reads the shelf from it and writes orders back to it — but the
 * customer never sees a WooCommerce checkout. They order in the app.
 * An order placed through the website, if the shop ever opens one,
 * joins the same queue at the same first desk.
 *
 * ---------------------------------------------------------------------
 * THIS PLUGIN IS THE WHOLE BACK END
 *
 * The Next.js panel in web/ and the FlutterFlow app both talk to it, so
 * there is one system and one database, not three:
 *
 *   FlutterFlow app ─┐
 *   Next.js panel  ──┼──►  this plugin  ──►  WooCommerce + MySQL
 *   wp-admin desks ──┘       (REST API)
 *
 * The REST API answers the same paths and the same JSON shapes the old
 * Node API did, and a rewrite rule puts it on `/api/...` as well as
 * `/wp-json/alhadeed/v1/...`. So the clients need one line changed —
 * their base URL — and nothing else.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

define( 'AH_VERSION', '1.23.1' );
define( 'AH_FILE', __FILE__ );
define( 'AH_PATH', plugin_dir_path( __FILE__ ) );
define( 'AH_URL', plugin_dir_url( __FILE__ ) );

require_once AH_PATH . 'includes/class-ah-install.php';
require_once AH_PATH . 'includes/class-ah-roles.php';
require_once AH_PATH . 'includes/class-ah-statuses.php';
require_once AH_PATH . 'includes/class-ah-sms.php';
require_once AH_PATH . 'includes/class-ah-shape.php';
require_once AH_PATH . 'includes/class-ah-auth.php';
require_once AH_PATH . 'includes/class-ah-flow.php';
require_once AH_PATH . 'includes/class-ah-admin.php';
require_once AH_PATH . 'includes/class-ah-rest.php';
require_once AH_PATH . 'includes/class-ah-rest-desks.php';
require_once AH_PATH . 'includes/class-ah-rest-company.php';
require_once AH_PATH . 'includes/class-ah-catalogue.php';
require_once AH_PATH . 'includes/class-ah-staff.php';
require_once AH_PATH . 'includes/class-ah-expenses.php';
require_once AH_PATH . 'includes/class-ah-monthly.php';
require_once AH_PATH . 'includes/class-ah-export.php';
require_once AH_PATH . 'includes/class-ah-account.php';
require_once AH_PATH . 'includes/class-ah-stock.php';
require_once AH_PATH . 'includes/class-ah-workers.php';
require_once AH_PATH . 'includes/class-ah-stock-math.php';
require_once AH_PATH . 'includes/class-ah-ledger.php';
require_once AH_PATH . 'includes/class-ah-stocktake.php';
require_once AH_PATH . 'includes/class-ah-purchasing.php';
require_once AH_PATH . 'includes/class-ah-till.php';
require_once AH_PATH . 'includes/class-ah-suppliers.php';
require_once AH_PATH . 'includes/class-ah-proofs.php';
require_once AH_PATH . 'includes/class-ah-customers.php';
require_once AH_PATH . 'includes/class-ah-order-delete.php';
require_once AH_PATH . 'includes/class-ah-tracker.php';
require_once AH_PATH . 'includes/class-ah-push.php';
require_once AH_PATH . 'includes/class-ah-credit.php';
require_once AH_PATH . 'includes/class-ah-books.php';
require_once AH_PATH . 'includes/class-ah-approvals.php';
require_once AH_PATH . 'includes/class-ah-pdf.php';
require_once AH_PATH . 'includes/class-ah-docs.php';
require_once AH_PATH . 'includes/class-ah-limits.php';
require_once AH_PATH . 'includes/class-ah-settings.php';
require_once AH_PATH . 'includes/class-ah-import.php';

/**
 * WooCommerce has to be active: the catalogue, the cart and the customer
 * accounts are all its work. Without it this plugin has nothing to move
 * between desks, so it says so plainly instead of throwing errors.
 */
function ah_woocommerce_missing_notice() {
	echo '<div class="notice notice-error"><p><strong>Al Hadeed Hardware</strong> needs WooCommerce. '
		. 'Install and activate WooCommerce, then the Cashier, Accounts, Store and Manager desks will appear.</p></div>';
}

add_action(
	'plugins_loaded',
	function () {
		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action( 'admin_notices', 'ah_woocommerce_missing_notice' );
			return;
		}

		AH_Statuses::init();
		AH_Flow::init();
		AH_Push::init();
		AH_Credit::init();
		AH_Stock::init();
		AH_Admin::init();
		AH_Rest::init();
		AH_Settings::init();
		AH_Import::init();
		AH_Staff::init();
	}
);

/**
 * WooCommerce can store orders in its own tables rather than as posts.
 * Everything here goes through the CRUD API, which works either way, so
 * the plugin declares itself compatible instead of forcing the shop back
 * onto the slower storage.
 */
add_action(
	'before_woocommerce_init',
	function () {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
				'custom_order_tables',
				__FILE__,
				true
			);
		}
	}
);

register_activation_hook( __FILE__, array( 'AH_Install', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'AH_Install', 'deactivate' ) );
