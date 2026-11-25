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
	const DB_VERSION = '1.6.0';

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
			proof_file      VARCHAR(191)    NULL,
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
			KEY verified (verified),
			KEY transaction_ref (transaction_ref)
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


		// Money going OUT of the shop that is not a customer refund:
		// transport, fuel, a part for the grinder, lunch for the crew.
		//
		// It is not the cash book. The cash book is a record of what
		// happened; this is a request that has not happened yet and may
		// never. Only when the manager approves it and the cashier pays
		// does a cash_book row appear — so the book keeps meaning
		// "money that actually moved".
		$sql[] = "CREATE TABLE {$p}ah_expenses (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			ref          VARCHAR(20)     NOT NULL,
			kind         VARCHAR(32)     NOT NULL DEFAULT 'expense',
			details      TEXT            NOT NULL,
			amount       BIGINT          NOT NULL DEFAULT 0,
			method       VARCHAR(32)     NULL,
			payee        VARCHAR(191)    NULL,
			pay_number   VARCHAR(64)     NULL,
			pay_ref      VARCHAR(64)     NULL,
			status       VARCHAR(24)     NOT NULL DEFAULT 'raised',
			raised_by    BIGINT UNSIGNED NOT NULL,
			raised_desk  VARCHAR(16)     NOT NULL,
			decided_by   BIGINT UNSIGNED NULL,
			decided_at   DATETIME        NULL,
			decision_note TEXT           NULL,
			paid_by      BIGINT UNSIGNED NULL,
			paid_at      DATETIME        NULL,
			cash_book_id BIGINT UNSIGNED NULL,
			worker_id    BIGINT UNSIGNED NULL,
			payslip_id   BIGINT UNSIGNED NULL,
			created_at   DATETIME        NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY ref (ref),
			KEY worker_id (worker_id),
			KEY status (status),
			KEY created_at (created_at)
		) {$charset};";

		// Who the shop buys from, and every message sent to them.
		//
		// The address lives here rather than on the product because a
		// supplier sells more than one thing, and because an address
		// typed into twenty products is an address corrected in
		// nineteen of them.
		$sql[] = "CREATE TABLE {$p}ah_suppliers (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name         VARCHAR(191)    NOT NULL,
			contact_name VARCHAR(191)    NULL,
			email        VARCHAR(191)    NOT NULL,
			phone        VARCHAR(32)     NULL,
			supplies     VARCHAR(191)    NULL,
			notes        TEXT            NULL,
			active       TINYINT         NOT NULL DEFAULT 1,
			last_mail_at DATETIME        NULL,
			created_by   BIGINT UNSIGNED NOT NULL,
			created_at   DATETIME        NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY email (email),
			KEY active (active)
		) {$charset};";

		// The record of what was actually sent, kept whether it
		// succeeded or not. A failed send that leaves no trace is how a
		// shop waits three weeks for cement that was never ordered.
		$sql[] = "CREATE TABLE {$p}ah_supplier_mail (
			id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			supplier_id BIGINT UNSIGNED NOT NULL,
			to_email    VARCHAR(191)    NOT NULL,
			subject     VARCHAR(255)    NOT NULL,
			body        LONGTEXT        NOT NULL,
			item_count  INT             NOT NULL DEFAULT 0,
			sent_by     BIGINT UNSIGNED NOT NULL,
			sent_name   VARCHAR(191)    NOT NULL,
			status      VARCHAR(16)     NOT NULL DEFAULT 'sent',
			error       TEXT            NULL,
			created_at  DATETIME        NOT NULL,
			PRIMARY KEY (id),
			KEY supplier_id (supplier_id),
			KEY created_at (created_at)
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

		// The stock book: every change to a product's count, and why.
		$sql[] = "CREATE TABLE {$p}ah_stock_moves (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			product_id   BIGINT UNSIGNED NOT NULL,
			kind         VARCHAR(20)     NOT NULL,
			qty          INT             NOT NULL DEFAULT 0,
			stock_before INT             NOT NULL DEFAULT 0,
			stock_after  INT             NOT NULL DEFAULT 0,
			unit_cost    BIGINT          NOT NULL DEFAULT 0,
			unit_price   BIGINT          NOT NULL DEFAULT 0,
			order_id     BIGINT UNSIGNED NOT NULL DEFAULT 0,
			supplier     VARCHAR(191)    NULL,
			ref          VARCHAR(64)     NULL,
			note         TEXT            NULL,
			user_id      BIGINT UNSIGNED NOT NULL DEFAULT 0,
			user_name    VARCHAR(191)    NULL,
			created_at   DATETIME        NOT NULL,
			PRIMARY KEY (id),
			KEY product_id (product_id),
			KEY kind (kind),
			KEY created_at (created_at)
		) {$charset};";

		// Everyone who works at the shop, whether or not they have a desk
		// login: the loaders, the driver and the guard are paid too.
		$sql[] = "CREATE TABLE {$p}ah_workers (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			full_name    VARCHAR(191)    NOT NULL,
			phone        VARCHAR(32)     NULL,
			job          VARCHAR(120)    NULL,
			id_number    VARCHAR(64)     NULL,
			started_on   DATE            NULL,
			pay_basis    VARCHAR(16)     NOT NULL DEFAULT 'monthly',
			base_pay     BIGINT          NOT NULL DEFAULT 0,
			allowance    BIGINT          NOT NULL DEFAULT 0,
			pay_method   VARCHAR(32)     NULL,
			pay_number   VARCHAR(64)     NULL,
			bank_name    VARCHAR(120)    NULL,
			kin_name     VARCHAR(191)    NULL,
			kin_phone    VARCHAR(32)     NULL,
			address      VARCHAR(255)    NULL,
			notes        TEXT            NULL,
			status       VARCHAR(16)     NOT NULL DEFAULT 'active',
			left_on      DATE            NULL,
			user_id      BIGINT UNSIGNED NULL,
			created_at   DATETIME        NOT NULL,
			updated_at   DATETIME        NULL,
			PRIMARY KEY (id),
			KEY status (status)
		) {$charset};";

		// One payslip per worker per month. The name and job are copied
		// in, so a slip still reads right after the worker is deleted.
		$sql[] = "CREATE TABLE {$p}ah_payslips (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			period       CHAR(7)         NOT NULL,
			worker_id    BIGINT UNSIGNED NOT NULL,
			worker_name  VARCHAR(191)    NOT NULL,
			job          VARCHAR(120)    NULL,
			pay_basis    VARCHAR(16)     NOT NULL DEFAULT 'monthly',
			rate         BIGINT          NOT NULL DEFAULT 0,
			days_worked  INT             NOT NULL DEFAULT 0,
			base_pay     BIGINT          NOT NULL DEFAULT 0,
			allowance    BIGINT          NOT NULL DEFAULT 0,
			overtime     BIGINT          NOT NULL DEFAULT 0,
			bonus        BIGINT          NOT NULL DEFAULT 0,
			deductions   BIGINT          NOT NULL DEFAULT 0,
			deduction_note VARCHAR(255)  NULL,
			advance_recovered BIGINT     NOT NULL DEFAULT 0,
			gross        BIGINT          NOT NULL DEFAULT 0,
			net          BIGINT          NOT NULL DEFAULT 0,
			status       VARCHAR(16)     NOT NULL DEFAULT 'draft',
			expense_id   BIGINT UNSIGNED NULL,
			note         TEXT            NULL,
			created_by   BIGINT UNSIGNED NOT NULL DEFAULT 0,
			created_at   DATETIME        NOT NULL,
			approved_at  DATETIME        NULL,
			paid_at      DATETIME        NULL,
			PRIMARY KEY (id),
			UNIQUE KEY period_worker (period, worker_id),
			KEY worker_id (worker_id)
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
