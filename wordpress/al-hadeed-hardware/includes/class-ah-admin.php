<?php
/**
 * The desks, inside wp-admin.
 *
 * Each member of staff signs into WordPress and sees one screen: their
 * own. A cashier gets the payment queue and nothing else — not the
 * dashboard, not the posts, not the plugins.
 *
 * These screens are a complete way to run the shop on their own, so a
 * counter with nothing but a browser can work. The Next.js panel and
 * the phone app are the same system seen from elsewhere; all three call
 * the same flow, so no desk can do something here that it could not do
 * there.
 *
 * The queue reloads itself every ten seconds. Shared hosting has no
 * websockets worth relying on, and a page that quietly goes stale at a
 * counter is worse than one that visibly refreshes.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Admin {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_action( 'admin_post_ah_action', array( __CLASS__, 'handle_action' ) );

		// Staff have no business on the dashboard or in the post list,
		// so they land on their desk when they sign in.
		add_action( 'admin_init', array( __CLASS__, 'redirect_staff' ) );
		add_filter( 'show_admin_bar', array( __CLASS__, 'hide_admin_bar' ) );

		// WooCommerce throws anyone without `edit_posts` out of
		// wp-admin and onto the shop's My Account page. Our desk roles
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

	private static function notice() {
		if ( ! empty( $_GET['ah_error'] ) ) {
			printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				esc_html( rawurldecode( wp_unslash( $_GET['ah_error'] ) ) )
			);
		}
		if ( ! empty( $_GET['ah_done'] ) ) {
			printf(
				'<div class="notice notice-success"><p>%s</p></div>',
				esc_html( rawurldecode( wp_unslash( $_GET['ah_done'] ) ) )
			);
		}
	}

	private static function form_start( $action, $id ) {
		printf(
			'<form method="post" action="%s" class="ah-form">',
			esc_url( admin_url( 'admin-post.php' ) )
		);
		echo '<input type="hidden" name="action" value="ah_action">';
		printf( '<input type="hidden" name="ah_do" value="%s">', esc_attr( $action ) );
		printf( '<input type="hidden" name="order_id" value="%d">', (int) $id );
		wp_nonce_field( 'ah_' . $action . '_' . $id );
	}

	private static function money( $n ) {
		return esc_html( AH_Sms::option( 'currency', 'UGX' ) . ' ' . number_format( (int) $n ) );
	}

	// -----------------------------------------------------------------
	// The desks
	// -----------------------------------------------------------------

	private static function cashier() {
		$orders = AH_Flow::queue_for( 'cashier' );
		echo '<h1>Cashier — Payment Queue</h1>';
		printf(
			'<p class="ah-sub">%d waiting for payment. This page refreshes itself.</p>',
			count( $orders )
		);

		if ( ! $orders ) {
			echo '<div class="ah-card ah-empty">Nothing waiting. Every order has been paid for.</div>';
			return;
		}

		foreach ( $orders as $o ) {
			echo '<div class="ah-card ah-order">';
			printf(
				'<div class="ah-order-head"><strong>%s</strong><span class="ah-chip ah-chip-amber">%s</span>'
				. '<span class="ah-total">%s</span></div>',
				esc_html( $o['order_no'] ),
				esc_html( $o['status_label'] ),
				self::money( $o['total'] )
			);
			printf(
				'<div class="ah-meta">%s · %d item(s) · %s</div>',
				esc_html( $o['ordered_by_name'] ),
				(int) $o['item_count'],
				esc_html( $o['created_at'] )
			);

			self::form_start( 'take_payment', $o['id'] );
			echo '<div class="ah-row">';
			echo '<select name="method" required>
					<option value="cash">Cash</option>
					<option value="mobile_money">Mobile Money</option>
					<option value="card">Card</option>
				  </select>';
			printf(
				'<input type="number" name="amount_paid" value="%d" min="0" step="1" required>',
				(int) $o['total']
			);
			echo '<input type="text" name="transaction_ref" placeholder="Transaction ref (mobile money / card)">';
			echo '<button class="button button-primary">Receive payment</button>';
			echo '</div></form></div>';
		}
	}

	private static function accounts() {
		$orders = AH_Flow::queue_for( 'accounts' );
		echo '<h1>Accounts — Verify Payments</h1>';
		printf( '<p class="ah-sub">%d awaiting verification.</p>', count( $orders ) );

		if ( ! $orders ) {
			echo '<div class="ah-card ah-empty">Nothing to verify.</div>';
		}

		foreach ( $orders as $o ) {
			$payment = AH_Flow::payment_for( $o['id'] );
			echo '<div class="ah-card ah-order">';
			printf(
				'<div class="ah-order-head"><strong>%s</strong><span class="ah-chip ah-chip-blue">Paid</span>'
				. '<span class="ah-total">%s</span></div>',
				esc_html( $o['order_no'] ),
				self::money( $o['total'] )
			);
			printf(
				'<div class="ah-meta">%s · receipt %s · %s%s</div>',
				esc_html( $o['ordered_by_name'] ),
				esc_html( $payment['receipt_no'] ?? '—' ),
				esc_html( str_replace( '_', ' ', $payment['method'] ?? '' ) ),
				$payment && $payment['transaction_ref'] ? ' · ' . esc_html( $payment['transaction_ref'] ) : ''
			);

			self::form_start( 'verify', $o['id'] );
			echo '<div class="ah-row">';
			echo '<input type="text" name="remarks" placeholder="Remarks (optional)">';
			echo '<button class="button button-primary">Verify</button>';
			echo '</div></form>';

			self::form_start( 'reject', $o['id'] );
			echo '<div class="ah-row">';
			echo '<input type="text" name="remarks" placeholder="Why it could not be matched" required>';
			echo '<button class="button ah-danger">Reject — back to cashier</button>';
			echo '</div></form>';
			echo '</div>';
		}

		self::cash_book_table();
	}

	private static function cash_book_table() {
		global $wpdb;
		$table = AH_Install::table( 'cash_book' );
		$today = current_time( 'Y-m-d' );

		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE entry_date = %s ORDER BY id", $today ),
			ARRAY_A
		);
		$balance = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COALESCE(SUM(cash_in - cash_out),0) FROM {$table} WHERE entry_date < %s", $today )
		);

		echo '<div class="ah-card"><h2>Cash Book — Today</h2>';
		echo '<table class="widefat striped"><thead><tr><th>Details</th><th>Cash in</th><th>Cash out</th><th>Balance</th></tr></thead><tbody>';
		printf( '<tr><td>Opening balance</td><td></td><td></td><td><strong>%s</strong></td></tr>', self::money( $balance ) );

		foreach ( $rows as $r ) {
			$balance += (int) $r['cash_in'] - (int) $r['cash_out'];
			printf(
				'<tr><td>%s</td><td class="ah-in">%s</td><td class="ah-out">%s</td><td><strong>%s</strong></td></tr>',
				esc_html( $r['details'] ),
				$r['cash_in'] ? self::money( $r['cash_in'] ) : '',
				$r['cash_out'] ? self::money( $r['cash_out'] ) : '',
				self::money( $balance )
			);
		}
		echo '</tbody></table></div>';
	}

	private static function store() {
		$orders = AH_Flow::queue_for( 'store' );
		echo '<h1>Store — Release Goods</h1>';
		printf( '<p class="ah-sub">%d approved and waiting to be picked.</p>', count( $orders ) );

		if ( ! $orders ) {
			echo '<div class="ah-card ah-empty">Nothing to release.</div>';
		}

		foreach ( $orders as $o ) {
			$full = AH_Shape::order( $o['id'], true );
			echo '<div class="ah-card ah-order">';
			printf(
				'<div class="ah-order-head"><strong>%s</strong><span class="ah-chip ah-chip-green">Verified</span>'
				. '<span class="ah-total">%s</span></div>',
				esc_html( $o['order_no'] ),
				self::money( $o['total'] )
			);
			printf(
				'<div class="ah-meta">%s · %s%s</div>',
				esc_html( $o['ordered_by_name'] ),
				esc_html( $o['fulfilment'] ),
				$o['delivery_address'] ? ' · ' . esc_html( $o['delivery_address'] ) : ''
			);

			echo '<ul class="ah-picklist">';
			foreach ( $full['items'] as $item ) {
				printf(
					'<li><strong>%d</strong> × %s <span class="ah-code">%s</span></li>',
					(int) $item['quantity'],
					esc_html( $item['product_name'] ),
					esc_html( $item['code'] )
				);
			}
			echo '</ul>';

			self::form_start( 'release', $o['id'] );
			echo '<div class="ah-row">';
			echo '<input type="text" name="collected_by" placeholder="Collected by (name)">';
			echo '<button class="button button-primary">Release goods</button>';
			echo '</div></form></div>';
		}
	}

	private static function manager() {
		$d = AH_Rest::dashboard();

		echo '<h1>Manager — Overview</h1>';
		echo '<div class="ah-tiles">';
		printf( '<div class="ah-tile"><span>Sales today</span><strong>%s</strong></div>', self::money( $d['salesToday'] ) );
		printf( '<div class="ah-tile"><span>Orders today</span><strong>%d</strong></div>', (int) $d['ordersToday'] );
		printf( '<div class="ah-tile"><span>Cash</span><strong>%s</strong></div>', self::money( $d['byMethod']['cash'] ) );
		printf( '<div class="ah-tile"><span>Mobile Money</span><strong>%s</strong></div>', self::money( $d['byMethod']['mobile_money'] ) );
		echo '</div>';

		echo '<div class="ah-card"><h2>Orders by stage</h2><div class="ah-tiles">';
		foreach ( array( 'cashier' => 'At Cashier', 'accounts' => 'At Accounts', 'store' => 'At Store', 'done' => 'Done' ) as $k => $label ) {
			printf( '<div class="ah-tile"><span>%s</span><strong>%d</strong></div>', esc_html( $label ), (int) $d['byStage'][ $k ] );
		}
		echo '</div></div>';

		if ( $d['lowStock'] ) {
			echo '<div class="ah-card"><h2>Low stock</h2><table class="widefat striped"><tbody>';
			foreach ( $d['lowStock'] as $p ) {
				printf(
					'<tr><td>%s</td><td><span class="ah-code">%s</span></td><td><strong>%d %s</strong> left · reorder at %d</td></tr>',
					esc_html( $p['name'] ),
					esc_html( $p['code'] ),
					(int) $p['stock_available'],
					esc_html( $p['unit'] ),
					(int) $p['reorder_level']
				);
			}
			echo '</tbody></table></div>';
		}

		self::cash_book_table();
	}
}
