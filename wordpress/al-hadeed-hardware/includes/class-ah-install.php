<?php
/**
 * The three tables WooCommerce does not already keep for us.
 *
 * WooCommerce holds the catalogue, the customers and the orders, so
 * none of that is duplicated here. What it has no concept of is the
 * shop's own paperwork:
 *
 *   payments  one receipt per payment taken at the counter, and whether
 *             Accounts has checked it against the till yet
 *   cash_book cash in and cash out with a running balance, which is the
 *             thing the shop actually reconciles at the end of the day
 *   events    who moved an order, from which status to which, and when
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Install {

	/** Bumped when the tables change, so an upgrade re-runs dbDelta. */
	const DB_VERSION = '1.0.0';

	public static function activate() {
		self::tables();
		AH_Roles::add();

		// The /api/... alias only exists once the rules are rebuilt.
		AH_Rest::rewrite_rules();
		flush_rewrite_rules();

		add_option( 'ah_db_version', self::DB_VERSION );
	}

	public static function deactivate() {
		// Roles and tables are left alone: deactivating a plugin should
		// not throw away the shop's receipts, and a staff member should
		// not lose their account because somebody was testing.
		flush_rewrite_rules();
	}

	/** Runs on activation, and again after an update changes DB_VERSION. */
	public static function tables() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();
		$p       = $wpdb->prefix;

		// Money is stored in whole shillings as BIGINT. UGX has no
		// sub-unit worth tracking, and integers cannot drift the way a
		// DECIMAL rounded in PHP eventually does.
		$sql = array();

		$sql[] = "CREATE TABLE {$p}ah_payments (
			id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			order_id        BIGINT UNSIGNED NOT NULL,
			receipt_no      VARCHAR(32)     NOT NULL,
			amount_due      BIGINT          NOT NULL DEFAULT 0,
			amount_paid     BIGINT          NOT NULL DEFAULT 0,
			method          VARCHAR(32)     NOT NULL,
			transaction_ref VARCHAR(191)    NULL,
			cashier_id      BIGINT UNSIGNED NOT NULL,
			cashier_name    VARCHAR(191)    NOT NULL,
			verified        TINYINT         NOT NULL DEFAULT 0,
			verified_by     BIGINT UNSIGNED NULL,
			verifier_name   VARCHAR(191)    NULL,
			verified_at     DATETIME        NULL,
			verify_remarks  TEXT            NULL,
			created_at      DATETIME        NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY receipt_no (receipt_no),
			KEY order_id (order_id),
			KEY verified (verified)
		) {$charset};";

		$sql[] = "CREATE TABLE {$p}ah_cash_book (
			id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			entry_date  DATE            NOT NULL,
			details     TEXT            NOT NULL,
			cash_in     BIGINT          NOT NULL DEFAULT 0,
			cash_out    BIGINT          NOT NULL DEFAULT 0,
			method      VARCHAR(32)     NULL,
			order_id    BIGINT UNSIGNED NULL,
			payment_id  BIGINT UNSIGNED NULL,
			recorded_by BIGINT UNSIGNED NOT NULL,
			created_at  DATETIME        NOT NULL,
			PRIMARY KEY (id),
			KEY entry_date (entry_date)
		) {$charset};";

		$sql[] = "CREATE TABLE {$p}ah_events (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			order_id     BIGINT UNSIGNED NOT NULL,
			stage        VARCHAR(32)     NOT NULL,
			action       VARCHAR(64)     NOT NULL,
			from_status  VARCHAR(64)     NULL,
			to_status    VARCHAR(64)     NULL,
			handled_by   BIGINT UNSIGNED NULL,
			handler_name VARCHAR(191)    NULL,
			notes        TEXT            NULL,
			created_at   DATETIME        NOT NULL,
			PRIMARY KEY (id),
			KEY order_id (order_id),
			KEY created_at (created_at)
		) {$charset};";

		// One-time codes for phone login, for customers who order on the
		// app rather than through the website checkout.
		$sql[] = "CREATE TABLE {$p}ah_otp (
			id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			phone      VARCHAR(32)     NOT NULL,
			code       VARCHAR(8)      NOT NULL,
			expires_at DATETIME        NOT NULL,
			consumed   TINYINT         NOT NULL DEFAULT 0,
			created_at DATETIME        NOT NULL,
			PRIMARY KEY (id),
			KEY phone (phone)
		) {$charset};";

		foreach ( $sql as $statement ) {
			dbDelta( $statement );
		}
	}

	/** Called on every load; cheap, and catches an upgrade by FTP. */
	public static function maybe_upgrade() {
		if ( get_option( 'ah_db_version' ) === self::DB_VERSION ) {
			return;
		}
		self::tables();
		AH_Roles::add();
		update_option( 'ah_db_version', self::DB_VERSION );
	}

	public static function table( $name ) {
		global $wpdb;
		return $wpdb->prefix . 'ah_' . $name;
	}
}

add_action( 'plugins_loaded', array( 'AH_Install', 'maybe_upgrade' ), 20 );
