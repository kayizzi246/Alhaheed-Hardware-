<?php
/**
 * The desks, inside wp-admin.
 *
 * Each member of staff signs into WordPress and sees one screen: their
 * own. A cashier gets the payment queue and nothing else — not the
 * dashboard, not the posts, not the plugins.
 *
 * These screens are a complete way to run the shop on their own, so a
 * counter with nothing but a browser can work. The phone app and the
 * Next.js panel are the same system seen from elsewhere; all three call
 * AH_Flow, so no desk can do something here it could not do there.
 *
 * ── How they are designed ──
 * Every screen answers one question at the top and offers one action
 * per row. The order number and the amount are the two things readable
 * across a desk, set in tabular figures. Colour does one job: orange
 * marks the thing to press, and the status chips carry a dot as well as
 * a hue because colour alone is not a signal everybody can read.
 *
 * The queue reloads itself every ten seconds — shared hosting has no
 * websocket worth relying on — so nothing else on the page animates. A
 * screen that twitches all day is one people stop watching.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Admin {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_action( 'admin_post_ah_action', array( __CLASS__, 'handle_action' ) );

		add_action( 'admin_init', array( __CLASS__, 'redirect_staff' ) );
		add_filter( 'show_admin_bar', array( __CLASS__, 'hide_admin_bar' ) );

		// WooCommerce throws anyone without `edit_posts` out of wp-admin
		// and onto the shop's My Account page. Our desk roles
		// deliberately have no such capability — a cashier is at a
		// counter, not writing posts — so without this they could never
		// reach the screen they exist to use.
		add_filter( 'woocommerce_prevent_admin_access', array( __CLASS__, 'allow_desk_admin' ) );
		add_filter( 'woocommerce_disable_admin_bar', array( __CLASS__, 'allow_desk_admin' ) );
	}

	public static function menu() {
		$cap = 'ah_desk_cashier';
		foreach ( array( 'cashier', 'accounts', 'store', 'manager' ) as $d ) {
			if ( current_user_can( 'ah_desk_' . $d ) ) {
				$cap = 'ah_desk_' . $d;
				break;
			}
		}

		add_menu_page(
			'Al Hadeed',
			'Al Hadeed',
			$cap,
			'al-hadeed',
			array( __CLASS__, 'route' ),
			'dashicons-store',
			3
		);

		$pages = array(
			'cashier'  => array( 'Cashier', 'ah_desk_cashier' ),
			'accounts' => array( 'Accounts', 'ah_desk_accounts' ),
			'store'    => array( 'Store', 'ah_desk_store' ),
			'manager'  => array( 'Manager', 'ah_desk_manager' ),
		);
		foreach ( $pages as $slug => $spec ) {
			add_submenu_page(
				'al-hadeed',
				$spec[0],
				$spec[0],
				$spec[1],
				'al-hadeed-' . $slug,
				array( __CLASS__, 'route' )
			);
		}

		add_submenu_page(
			'al-hadeed',
			'Settings',
			'Settings',
			'ah_desk_manager',
			'al-hadeed-settings',
			array( 'AH_Settings', 'render' )
		);
	}

	/** Sends each person to their own desk on sign-in. */
	public static function redirect_staff() {
		if ( wp_doing_ajax() || ! is_admin() ) {
			return;
		}
		global $pagenow;
		if ( 'index.php' !== $pagenow ) {
			return;
		}
		$desk = AH_Roles::desk_of();
		if ( ! $desk || current_user_can( 'manage_options' ) ) {
			return;
		}
		wp_safe_redirect( admin_url( 'admin.php?page=al-hadeed-' . $desk ) );
		exit;
	}

	/** Shop staff keep their wp-admin access; customers do not. */
	public static function allow_desk_admin( $prevent ) {
		return AH_Roles::desk_of() ? false : $prevent;
	}

	public static function hide_admin_bar( $show ) {
		$desk = AH_Roles::desk_of();
		return ( $desk && ! current_user_can( 'manage_options' ) ) ? false : $show;
	}

	public static function assets( $hook ) {
		if ( false === strpos( $hook, 'al-hadeed' ) ) {
			return;
		}
		wp_enqueue_style( 'ah-admin', AH_URL . 'assets/admin.css', array(), AH_VERSION );
		wp_enqueue_script( 'ah-admin', AH_URL . 'assets/admin.js', array(), AH_VERSION, true );
	}

	// -----------------------------------------------------------------
	// Routing
	// -----------------------------------------------------------------

	public static function route() {
		$page = isset( $_GET['page'] ) ? sanitize_text_field( wp_unslash( $_GET['page'] ) ) : '';
		$desk = str_replace( 'al-hadeed-', '', $page );
		if ( 'al-hadeed' === $page ) {
			$desk = AH_Roles::desk_of() ?: 'cashier';
		}

		if ( ! current_user_can( 'ah_desk_' . $desk ) ) {
			wp_die( 'You do not have access to this desk.' );
		}

		echo '<div class="wrap ah-wrap">';
		self::notice();

		switch ( $desk ) {
			case 'accounts':
				self::accounts();
				break;
			case 'store':
				self::store();
				break;
			case 'manager':
				self::manager();
				break;
			default:
				self::cashier();
		}
		echo '</div>';
	}

	// -----------------------------------------------------------------
	// Shared furniture
	// -----------------------------------------------------------------

	/** The band at the top of every desk: who, where, when. */
	private static function head( $title, $sub, $live = true ) {
		$user = wp_get_current_user();
		printf(
			'<header class="ah-head">
				<div>
					<h1>%s</h1>
					<p class="ah-sub">%s</p>
				</div>
				<div class="ah-who">
					<span class="ah-who-name">%s</span>
					<span class="ah-who-meta">%s</span>
					%s
				</div>
			</header>',
			esc_html( $title ),
			esc_html( $sub ),
			esc_html( $user->display_name ),
			esc_html( wp_date( 'D j M Y' ) ),
			$live ? '<span class="ah-live"><i></i>refreshing</span>' : ''
		);
	}

	private static function tiles( $tiles ) {
		echo '<div class="ah-tiles">';
		foreach ( $tiles as $t ) {
			printf(
				'<div class="ah-tile"><span>%s</span><strong class="%s">%s</strong>%s</div>',
				esc_html( $t[0] ),
				esc_attr( isset( $t[2] ) ? 'ah-' . $t[2] : '' ),
				esc_html( $t[1] ),
				isset( $t[3] ) ? '<em>' . esc_html( $t[3] ) . '</em>' : ''
			);
		}
		echo '</div>';
	}

	private static function empty_state( $icon, $title, $line ) {
		printf(
			'<div class="ah-card ah-empty"><span class="dashicons dashicons-%s"></span><strong>%s</strong><p>%s</p></div>',
			esc_attr( $icon ),
			esc_html( $title ),
			esc_html( $line )
		);
	}

	private static function form_start( $action, $id ) {
		printf( '<form method="post" action="%s" class="ah-form">', esc_url( admin_url( 'admin-post.php' ) ) );
		echo '<input type="hidden" name="action" value="ah_action">';
		printf( '<input type="hidden" name="ah_do" value="%s">', esc_attr( $action ) );
		printf( '<input type="hidden" name="order_id" value="%d">', (int) $id );
		wp_nonce_field( 'ah_' . $action . '_' . $id );
	}

	private static function money( $n ) {
		return esc_html( AH_Sms::option( 'currency', 'UGX' ) . ' ' . number_format( (int) $n ) );
	}

	/** "9:26 AM" from a stored timestamp — the bit a desk cares about. */
	private static function at( $stamp ) {
		$t = strtotime( (string) $stamp );
		return $t ? wp_date( 'H:i', $t ) : '';
	}

	private static function notice() {
		if ( ! empty( $_GET['ah_error'] ) ) {
			printf(
				'<div class="ah-flash ah-flash-bad"><span class="dashicons dashicons-warning"></span><p>%s</p></div>',
				esc_html( rawurldecode( wp_unslash( $_GET['ah_error'] ) ) )
			);
		}
		if ( ! empty( $_GET['ah_done'] ) ) {
			printf(
				'<div class="ah-flash ah-flash-ok"><span class="dashicons dashicons-yes-alt"></span><p>%s</p></div>',
				esc_html( rawurldecode( wp_unslash( $_GET['ah_done'] ) ) )
			);
		}
	}

	// -----------------------------------------------------------------
	// Actions — every one nonce-checked and capability-checked
	// -----------------------------------------------------------------

	public static function handle_action() {
		$action = isset( $_POST['ah_do'] ) ? sanitize_text_field( wp_unslash( $_POST['ah_do'] ) ) : '';
		$id     = isset( $_POST['order_id'] ) ? (int) $_POST['order_id'] : 0;

		check_admin_referer( 'ah_' . $action . '_' . $id );

		$user   = wp_get_current_user();
		$result = null;
		$back   = 'cashier';

		switch ( $action ) {
			case 'take_payment':
				if ( ! current_user_can( 'ah_desk_cashier' ) ) {
					wp_die( 'Not your desk.' );
				}
				$result = AH_Flow::receive_payment(
					$id,
					array(
						'method'          => sanitize_text_field( wp_unslash( $_POST['method'] ?? '' ) ),
						'amount_paid'     => (int) ( $_POST['amount_paid'] ?? 0 ),
						'transaction_ref' => sanitize_text_field( wp_unslash( $_POST['transaction_ref'] ?? '' ) ),
					),
					$user->ID
				);
				break;

			case 'verify':
			case 'reject':
				if ( ! current_user_can( 'ah_desk_accounts' ) ) {
					wp_die( 'Not your desk.' );
				}
				$back   = 'accounts';
				$result = AH_Flow::verify_payment(
					$id,
					'verify' === $action,
					sanitize_text_field( wp_unslash( $_POST['remarks'] ?? '' ) ),
					$user->ID
				);
				break;

			case 'release':
				if ( ! current_user_can( 'ah_desk_store' ) ) {
					wp_die( 'Not your desk.' );
				}
				$back   = 'store';
				$result = AH_Flow::release_order(
					$id,
					array( 'collected_by' => sanitize_text_field( wp_unslash( $_POST['collected_by'] ?? '' ) ) ),
					$user->ID
				);
				break;

			default:
				wp_die( 'Unknown action.' );
		}

		$args = array( 'page' => 'al-hadeed-' . $back );
		if ( is_wp_error( $result ) ) {
			$args['ah_error'] = rawurlencode( $result->get_error_message() );
		} else {
			$args['ah_done'] = rawurlencode( 'Order ' . $result['order_no'] . ' — ' . $result['status_label'] );
		}

		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php' ) ) );
		exit;
	}

	// =================================================================
	// CASHIER
	// =================================================================

	private static function cashier() {
		$data    = AH_Rest::cashier_queue();
		$orders  = $data['orders'];
		$s       = $data['summary'];

		self::head(
			'Cashier',
			$s['waiting'] ? sprintf( '%d waiting for payment', $s['waiting'] ) : 'Nothing waiting',
		);

		self::tiles(
			array(
				array( 'Waiting for payment', (string) $s['waiting'] ),
				array( 'Paid today', (string) $s['paid_today'] ),
				array( 'Cash taken', self::money( $s['cash_today'] ), 'green' ),
				array( 'Mobile Money', self::money( $s['momo_today'] ) ),
			)
		);

		if ( ! $orders ) {
			self::empty_state( 'yes-alt', 'The queue is clear', 'Every order has been paid for. New ones appear here on their own.' );
			return;
		}

		echo '<h2 class="ah-section">Orders waiting</h2>';

		foreach ( $orders as $o ) {
			$full  = AH_Shape::order( $o['id'], true );
			$items = $full['items'];

			echo '<article class="ah-card ah-order">';

			printf(
				'<div class="ah-order-head">
					<strong>%s</strong>
					<span class="ah-chip ah-chip-amber">Pending payment</span>
					<span class="ah-total">%s</span>
				</div>
				<div class="ah-meta">%s · %d item%s · placed %s%s</div>',
				esc_html( $o['order_no'] ),
				self::money( $o['total'] ),
				esc_html( $o['company_name'] ?: $o['ordered_by_name'] ),
				(int) $o['item_count'],
				1 === (int) $o['item_count'] ? '' : 's',
				esc_html( self::at( $o['created_at'] ) ),
				$o['ordered_by_phone'] ? ' · ' . esc_html( $o['ordered_by_phone'] ) : ''
			);

			// What they are paying for, so the cashier can check the
			// trolley against the screen without opening anything.
			echo '<ul class="ah-lines">';
			foreach ( $items as $i ) {
				printf(
					'<li><span class="ah-qty">%d</span> %s <span class="ah-code">%s</span><span class="ah-line-total">%s</span></li>',
					(int) $i['quantity'],
					esc_html( $i['product_name'] ),
					esc_html( $i['code'] ),
					self::money( $i['line_total'] )
				);
			}
			echo '</ul>';

			self::form_start( 'take_payment', $o['id'] );
			echo '<div class="ah-pay">';

			// Method as a segmented control: three taps' worth of
			// choices should not be hidden in a dropdown.
			echo '<div class="ah-seg" role="radiogroup" aria-label="Payment method">';
			foreach ( array( 'cash' => 'Cash', 'mobile_money' => 'Mobile Money', 'card' => 'Card' ) as $v => $l ) {
				printf(
					'<label class="ah-seg-opt"><input type="radio" name="method" value="%s" %s required><span>%s</span></label>',
					esc_attr( $v ),
					checked( $v, 'cash', false ),
					esc_html( $l )
				);
			}
			echo '</div>';

			printf(
				'<div class="ah-pay-row">
					<label class="ah-amount">
						<span>Amount received</span>
						<input type="number" name="amount_paid" value="%d" min="0" step="500" required inputmode="numeric">
					</label>
					<label class="ah-ref">
						<span>Transaction reference</span>
						<input type="text" name="transaction_ref" placeholder="Needed for mobile money and card">
					</label>
					<button class="button button-primary ah-go">Receive payment</button>
				</div>',
				(int) $o['total']
			);

			echo '</div></form></article>';
		}
	}

	// =================================================================
	// ACCOUNTS
	// =================================================================

	private static function accounts() {
		$data   = AH_Rest::accounts_queue();
		$orders = $data['orders'];
		$s      = $data['summary'];

		self::head(
			'Accounts',
			$s['awaiting'] ? sprintf( '%d payment%s to check', $s['awaiting'], 1 === $s['awaiting'] ? '' : 's' ) : 'Everything is verified'
		);

		self::tiles(
			array(
				array( 'Awaiting verification', (string) $s['awaiting'] ),
				array( 'Verified today', (string) $s['verified_today'] ),
				array( 'Cash in', self::money( $s['cash_in'] ), 'green' ),
				array( 'Cash out', self::money( $s['cash_out'] ), 'red' ),
			)
		);

		if ( ! $orders ) {
			self::empty_state( 'yes-alt', 'Nothing to verify', 'Every payment the cashier has taken has been checked against the till.' );
		} else {
			echo '<h2 class="ah-section">Payments to check</h2>';

			foreach ( $orders as $o ) {
				$p = AH_Flow::payment_for( $o['id'] );

				echo '<article class="ah-card ah-order">';
				printf(
					'<div class="ah-order-head">
						<strong>%s</strong>
						<span class="ah-chip ah-chip-blue">Paid</span>
						<span class="ah-total">%s</span>
					</div>',
					esc_html( $o['order_no'] ),
					self::money( $o['total'] )
				);

				// The three facts Accounts needs to match this against a
				// statement, stated plainly rather than buried in prose.
				printf(
					'<dl class="ah-facts">
						<div><dt>Receipt</dt><dd>%s</dd></div>
						<div><dt>Method</dt><dd>%s</dd></div>
						<div><dt>Reference</dt><dd>%s</dd></div>
						<div><dt>Taken by</dt><dd>%s, %s</dd></div>
					</dl>',
					esc_html( $p['receipt_no'] ?? '—' ),
					esc_html( ucwords( str_replace( '_', ' ', $p['method'] ?? '' ) ) ),
					$p && $p['transaction_ref'] ? '<code>' . esc_html( $p['transaction_ref'] ) . '</code>' : '—',
					esc_html( $p['cashier_name'] ?? '—' ),
					esc_html( self::at( $p['created_at'] ?? '' ) )
				);

				echo '<div class="ah-decide">';

				self::form_start( 'verify', $o['id'] );
				echo '<div class="ah-row">';
				echo '<input type="text" name="remarks" placeholder="Remarks (optional)">';
				echo '<button class="button button-primary">Verify &amp; send to store</button>';
				echo '</div></form>';

				self::form_start( 'reject', $o['id'] );
				echo '<div class="ah-row">';
				echo '<input type="text" name="remarks" placeholder="Why it could not be matched" required>';
				echo '<button class="button ah-danger">Reject — back to cashier</button>';
				echo '</div></form>';

				echo '</div></article>';
			}
		}

		self::cash_book_table();
	}

	private static function cash_book_table() {
		global $wpdb;
		$table = AH_Install::table( 'cash_book' );
		$today = current_time( 'Y-m-d' );

		$rows    = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE entry_date = %s ORDER BY id", $today ),
			ARRAY_A
		);
		$opening = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COALESCE(SUM(cash_in - cash_out),0) FROM {$table} WHERE entry_date < %s", $today )
		);

		echo '<h2 class="ah-section">Cash book — today</h2>';
		echo '<div class="ah-card ah-flush">';
		echo '<table class="ah-table"><thead><tr>
				<th>Details</th><th class="ah-r">Cash in</th><th class="ah-r">Cash out</th><th class="ah-r">Balance</th>
			  </tr></thead><tbody>';

		$balance = $opening;
		printf(
			'<tr class="ah-opening"><td>Opening balance</td><td></td><td></td><td class="ah-r"><strong>%s</strong></td></tr>',
			self::money( $balance )
		);

		foreach ( $rows as $r ) {
			$balance += (int) $r['cash_in'] - (int) $r['cash_out'];
			printf(
				'<tr><td>%s<span class="ah-t">%s</span></td><td class="ah-r ah-in">%s</td><td class="ah-r ah-out">%s</td><td class="ah-r"><strong>%s</strong></td></tr>',
				esc_html( $r['details'] ),
				esc_html( self::at( $r['created_at'] ) ),
				$r['cash_in'] ? self::money( $r['cash_in'] ) : '',
				$r['cash_out'] ? self::money( $r['cash_out'] ) : '',
				self::money( $balance )
			);
		}

		if ( ! $rows ) {
			echo '<tr><td colspan="4" class="ah-none">Nothing has moved through the till today.</td></tr>';
		}

		printf(
			'</tbody><tfoot><tr><td>Closing balance</td><td></td><td></td><td class="ah-r"><strong>%s</strong></td></tr></tfoot></table></div>',
			self::money( $balance )
		);
	}

	// =================================================================
	// STORE
	// =================================================================

	private static function store() {
		$orders = AH_Flow::queue_for( 'store' );

		self::head(
			'Store',
			$orders ? sprintf( '%d order%s to pick and release', count( $orders ), 1 === count( $orders ) ? '' : 's' ) : 'Nothing to release'
		);

		// What the store is short of is the store's business, so it is
		// on the store's screen rather than only the manager's.
		$low = array();
		foreach ( wc_get_products( array( 'limit' => 200, 'status' => 'publish' ) ) as $p ) {
			if ( ! $p->get_manage_stock() ) {
				continue;
			}
			if ( (int) $p->get_stock_quantity() <= (int) get_post_meta( $p->get_id(), '_ah_reorder_level', true ) ) {
				$low[] = $p;
			}
		}

		self::tiles(
			array(
				array( 'To release', (string) count( $orders ) ),
				array( 'Low on stock', (string) count( $low ), count( $low ) ? 'red' : '' ),
			)
		);

		if ( ! $orders ) {
			self::empty_state( 'yes-alt', 'Nothing to release', 'Approved orders appear here once Accounts have verified the payment.' );
		}

		foreach ( $orders as $o ) {
			$full = AH_Shape::order( $o['id'], true );

			echo '<article class="ah-card ah-order">';
			printf(
				'<div class="ah-order-head">
					<strong>%s</strong>
					<span class="ah-chip ah-chip-green">Paid &amp; verified</span>
					<span class="ah-total">%s</span>
				</div>
				<div class="ah-meta">%s · %s%s</div>',
				esc_html( $o['order_no'] ),
				self::money( $o['total'] ),
				esc_html( $o['company_name'] ?: $o['ordered_by_name'] ),
				'delivery' === $o['fulfilment'] ? 'Delivery' : 'Collection',
				$o['delivery_address'] ? ' · ' . esc_html( $o['delivery_address'] ) : ''
			);

			// The pick list is the point of this screen, so it is the
			// largest thing on the card.
			echo '<ul class="ah-picklist">';
			foreach ( $full['items'] as $i ) {
				printf(
					'<li><span class="ah-qty">%d</span><span class="ah-pick-name">%s</span><span class="ah-code">%s</span></li>',
					(int) $i['quantity'],
					esc_html( $i['product_name'] ),
					esc_html( $i['code'] )
				);
			}
			echo '</ul>';

			self::form_start( 'release', $o['id'] );
			echo '<div class="ah-row">';
			echo '<input type="text" name="collected_by" placeholder="Collected by (name)">';
			echo '<button class="button button-primary ah-go">Release goods</button>';
			echo '</div></form>';
			echo '<p class="ah-fine">Releasing takes the stock off the shelf and tells the customer.</p>';
			echo '</article>';
		}

		if ( $low ) {
			echo '<h2 class="ah-section">Running low</h2>';
			echo '<div class="ah-card ah-flush"><table class="ah-table"><tbody>';
			foreach ( $low as $p ) {
				$qty     = (int) $p->get_stock_quantity();
				$reorder = (int) get_post_meta( $p->get_id(), '_ah_reorder_level', true );
				printf(
					'<tr><td><strong>%s</strong><span class="ah-t">%s</span></td><td class="ah-r"><span class="%s">%d %s left</span></td><td class="ah-r ah-t">reorder at %d</td></tr>',
					esc_html( $p->get_name() ),
					esc_html( $p->get_sku() ),
					0 === $qty ? 'ah-out' : 'ah-low',
					$qty,
					esc_html( get_post_meta( $p->get_id(), '_ah_unit', true ) ?: 'pc' ),
					$reorder
				);
			}
			echo '</tbody></table></div>';
		}
	}

	// =================================================================
	// MANAGER
	// =================================================================

	private static function manager() {
		$d = AH_Rest::dashboard();

		self::head( 'Manager', 'The whole shop, at a glance' );

		// 1 ── What have we taken today?
		$days     = $d['last7Days'];
		$previous = array_slice( $days, 0, -1 );
		$average  = $previous ? (int) round( array_sum( wp_list_pluck( $previous, 'total' ) ) / count( $previous ) ) : 0;
		$delta    = $average ? (int) round( ( ( $d['salesToday'] - $average ) / $average ) * 100 ) : null;

		$methods = array(
			array( 'Cash', $d['byMethod']['cash'], 'a' ),
			array( 'Mobile Money', $d['byMethod']['mobile_money'], 'b' ),
			array( 'Card', $d['byMethod']['card'], 'c' ),
		);
		$mix_total = array_sum( wp_list_pluck( $methods, 1 ) );

		echo '<section class="ah-hero">';

		printf(
			'<div class="ah-hero-main">
				<span class="ah-k">Sales today</span>
				<strong class="ah-hero-value">%s</strong>
				<span class="ah-hero-sub">%d order%s%s</span>
			</div>',
			self::money( $d['salesToday'] ),
			(int) $d['ordersToday'],
			1 === (int) $d['ordersToday'] ? '' : 's',
			null === $delta ? '' : sprintf(
				' · <span class="%s">%s %d%%</span> vs the daily average',
				$delta >= 0 ? 'ah-up' : 'ah-down',
				$delta >= 0 ? '▲' : '▼',
				abs( $delta )
			)
		);

		echo '<div class="ah-hero-side"><span class="ah-k">How it was paid</span>';
		if ( ! $mix_total ) {
			echo '<p class="ah-none">Nothing taken yet today.</p>';
		} else {
			echo '<div class="ah-mix">';
			foreach ( $methods as $m ) {
				if ( $m[1] > 0 ) {
					printf( '<span class="ah-mix-%s" style="flex-grow:%d"></span>', esc_attr( $m[2] ), (int) $m[1] );
				}
			}
			echo '</div><ul class="ah-mix-key">';
			foreach ( $methods as $m ) {
				printf(
					'<li><span class="ah-dot ah-mix-%s"></span>%s<b>%s</b></li>',
					esc_attr( $m[2] ),
					esc_html( $m[0] ),
					self::money( $m[1] )
				);
			}
			echo '</ul>';
		}
		echo '</div></section>';

		// 2 ── Where is the work stuck?
		$waiting = $d['byStage']['cashier'] + $d['byStage']['accounts'] + $d['byStage']['store'];
		printf(
			'<h2 class="ah-section">Where the work is <em>%s</em></h2>',
			$waiting ? esc_html( sprintf( '%d still moving through the shop', $waiting ) ) : 'everything is done'
		);

		$stages = array(
			array( 'cashier', 'At the cashier', 'waiting to pay' ),
			array( 'accounts', 'At accounts', 'to verify' ),
			array( 'store', 'At the store', 'to pick &amp; release' ),
			array( 'done', 'Completed', 'released' ),
		);

		echo '<div class="ah-pipeline">';
		$step = 0;
		foreach ( $stages as $s ) {
			$n = (int) $d['byStage'][ $s[0] ];
			$step++;
			printf(
				'<a class="ah-pipe %s" href="%s">
					<span class="ah-pipe-step">%d</span>
					<strong>%d</strong>
					<span class="ah-pipe-label">%s</span>
					<span class="ah-pipe-hint">%s</span>
				</a>',
				$n > 0 && 'done' !== $s[0] ? 'ah-pipe-busy' : '',
				esc_url( admin_url( 'admin.php?page=al-hadeed-' . ( 'done' === $s[0] ? 'manager' : $s[0] ) ) ),
				$step,
				$n,
				esc_html( $s[1] ),
				wp_kses_post( $s[2] )
			);
		}
		echo '</div>';

		// 3 ── Is anything about to run out?
		if ( $d['lowStock'] ) {
			printf( '<h2 class="ah-section">Low stock <em>%d product%s</em></h2>', count( $d['lowStock'] ), 1 === count( $d['lowStock'] ) ? '' : 's' );
			echo '<div class="ah-card ah-flush"><table class="ah-table"><tbody>';
			foreach ( $d['lowStock'] as $p ) {
				printf(
					'<tr><td><strong>%s</strong><span class="ah-t">%s</span></td><td class="ah-r"><span class="%s">%d %s left</span></td><td class="ah-r ah-t">reorder at %d</td></tr>',
					esc_html( $p['name'] ),
					esc_html( $p['code'] ),
					0 === (int) $p['stock_available'] ? 'ah-out' : 'ah-low',
					(int) $p['stock_available'],
					esc_html( $p['unit'] ),
					(int) $p['reorder_level']
				);
			}
			echo '</tbody></table></div>';
		}

		// Supporting ── is today normal?
		echo '<h2 class="ah-section">Sales <em>last 7 days</em></h2>';
		echo '<div class="ah-card ah-chart">';

		$max = max( 1, max( wp_list_pluck( $days, 'total' ) ) );
		echo '<div class="ah-bars">';
		if ( $average > 0 ) {
			printf(
				'<div class="ah-avg" style="bottom:%s%%"><span>avg %s</span></div>',
				esc_attr( (string) round( ( $average / $max ) * 100, 2 ) ),
				self::money( $average )
			);
		}
		foreach ( $days as $day ) {
			// A floor of 3% so a day with no sales is still visibly a day.
			printf(
				'<div class="ah-bar-col"><span class="ah-bar-amt">%s</span><span class="ah-bar" style="height:%s%%"></span><span class="ah-bar-day">%s</span></div>',
				$day['total'] ? esc_html( number_format( (int) $day['total'] / 1000 ) . 'k' ) : '',
				esc_attr( (string) ( 3 + ( $day['total'] / $max ) * 97 ) ),
				esc_html( wp_date( 'D', strtotime( $day['day'] ) ) )
			);
		}
		echo '</div><p class="ah-fine">Verified sales only.</p></div>';

		self::cash_book_table();
	}
}
