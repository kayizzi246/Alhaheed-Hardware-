<?php
/**
 * The rest of the API: receipts, end of day, reconciliation, reports,
 * notifications, the order register and the manager's lists.
 *
 * Split from class-ah-rest.php because that file was already carrying
 * the whole order flow, and a 1,500-line class is a file nobody opens
 * willingly. Same namespace, same conventions, same `{"error": "..."}`
 * on failure.
 *
 * Every shape here was taken from what the Next.js panel actually
 * reads, field by field, so the pages work untouched.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Rest_Desks {

	public static function routes() {
		$ns   = AH_Rest::NS;
		$get  = WP_REST_Server::READABLE;
		$post = WP_REST_Server::CREATABLE;

		$cashier  = AH_Rest::desk( array( 'cashier', 'manager' ) );
		$accounts = AH_Rest::desk( array( 'accounts', 'manager' ) );
		$books    = AH_Rest::desk( array( 'accounts', 'cashier', 'manager' ) );
		$manager  = AH_Rest::desk( array( 'manager' ) );
		$any_desk = AH_Rest::desk( array( 'cashier', 'accounts', 'store', 'manager' ) );

		$route = function ( $path, $methods, $perm, $cb ) use ( $ns ) {
			register_rest_route(
				$ns,
				$path,
				array(
					'methods'             => $methods,
					'permission_callback' => $perm,
					'callback'            => $cb,
				)
			);
		};

		// ── Cashier ───────────────────────────────────────────────────
		$route( '/cashier/receipts', $get, $cashier, array( __CLASS__, 'receipts' ) );
		$route( '/cashier/receipts/(?P<no>[A-Za-z0-9\-]+)', $get, $cashier, array( __CLASS__, 'receipt' ) );
		$route( '/cashier/end-of-day', $get, $cashier, array( __CLASS__, 'end_of_day' ) );

		// ── Accounts ──────────────────────────────────────────────────
		$route( '/accounts/reconciliation', $get, $accounts, array( __CLASS__, 'reconciliation' ) );

		// ── Reports (Accounts and the Manager both) ───────────────────
		$route( '/reports/sales', $get, $books, array( __CLASS__, 'sales' ) );
		$route( '/reports/best-sellers', $get, $books, array( __CLASS__, 'best_sellers' ) );
		$route( '/reports/stock-movement', $get, $books, array( __CLASS__, 'stock_movement' ) );
		$route( '/reports/orders-by-stage', $get, $books, array( __CLASS__, 'orders_by_stage' ) );
		$route( '/reports/staff-activity', $get, $books, array( __CLASS__, 'staff_activity' ) );

		// ── Notifications ─────────────────────────────────────────────
		$route( '/notifications', $get, AH_Rest::class . '::signed_in', array( __CLASS__, 'notifications' ) );
		$route( '/notifications/read-all', $post, AH_Rest::class . '::signed_in', array( __CLASS__, 'read_all' ) );
		$route( '/notifications/delete', $post, AH_Rest::class . '::signed_in', array( __CLASS__, 'delete_alerts' ) );

		// ── The order register, and the manager's lists ───────────────
		$route( '/orders', $get, $any_desk, array( __CLASS__, 'register' ) );

		// Tapping a stage on the manager's phone opens what is sitting
		// in it. The app has asked for this since it was written; the
		// route was never registered, so every tap showed an error.
		$route(
			'/orders/queue/(?P<stage>[a-z_]+)',
			$get,
			$any_desk,
			array( __CLASS__, 'stage_queue' )
		);
		$route( '/manager/staff', $get, $manager, array( __CLASS__, 'staff' ) );
		$route( '/manager/customers', $get, $manager, array( __CLASS__, 'customers' ) );
		$route( '/customers/walk-ins', $get, AH_Rest::desk( array( 'cashier', 'accounts', 'manager' ) ), array( __CLASS__, 'walk_in_sales' ) );
		$route( '/manager/audit', $get, $manager, array( __CLASS__, 'audit' ) );
		// Products and their stock: AH_Stock.
	}

	/**
	 * What is sitting at one desk.
	 *
	 * The counting and the listing are deliberately separate jobs —
	 * the dashboard counts without loading, this loads because
	 * somebody is about to read it.
	 */
	public static function stage_queue( $req ) {
		$stage = sanitize_key( $req->get_param( 'stage' ) );

		if ( ! isset( AH_Flow::stages()[ $stage ] ) ) {
			return new WP_Error(
				'ah_bad_stage',
				'There is no such desk',
				array( 'status' => 404 )
			);
		}

		return array(
			'stage'  => $stage,
			'orders' => AH_Flow::queue_for( $stage, 100 ),
		);
	}

	// -----------------------------------------------------------------
	// Dates
	// -----------------------------------------------------------------

	/** `?period=daily|weekly|monthly` or `?from=&to=`, as the panel sends. */
	public static function range( $req ) {
		$to   = $req->get_param( 'to' ) ? sanitize_text_field( $req->get_param( 'to' ) ) : current_time( 'Y-m-d' );
		$from = $req->get_param( 'from' ) ? sanitize_text_field( $req->get_param( 'from' ) ) : null;

		if ( ! $from ) {
			switch ( $req->get_param( 'period' ) ) {
				case 'daily':
					$from = $to;
					break;
				case 'monthly':
					$from = gmdate( 'Y-m-d', strtotime( $to . ' -29 days' ) );
					break;
				case 'weekly':
				default:
					$from = gmdate( 'Y-m-d', strtotime( $to . ' -6 days' ) );
			}
		}
		return array( $from, $to );
	}

	// -----------------------------------------------------------------
	// Receipts
	// -----------------------------------------------------------------

	public static function receipts( $req ) {
		global $wpdb;
		$t    = AH_Install::table( 'payments' );
		$date = $req->get_param( 'date' ) ? sanitize_text_field( $req->get_param( 'date' ) ) : current_time( 'Y-m-d' );

		$sql    = "SELECT * FROM {$t} WHERE DATE(created_at) = %s";
		$params = array( $date );

		// "mine" is the cashier checking their own till, not the shop's.
		if ( $req->get_param( 'mine' ) && '0' !== (string) $req->get_param( 'mine' ) ) {
			$sql     .= ' AND cashier_id = %d';
			$params[] = AH_Auth::current()->ID;
		}
		$sql .= ' ORDER BY id DESC';

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );
		$out  = array();

		foreach ( $rows as $r ) {
			$order   = wc_get_order( (int) $r['order_id'] );
			$out[]   = array(
				'id'              => (int) $r['id'],
				'receipt_no'      => $r['receipt_no'],
				'order_no'        => $order ? AH_Shape::order_no( $order ) : '',
				'customer_name'   => $order ? trim( $order->get_formatted_billing_full_name() ) : '',
				'company_name'    => $order ? ( $order->get_meta( '_ah_company_name' ) ?: null ) : null,
				'method'          => $r['method'],
				'transaction_ref' => $r['transaction_ref'],
				'amount_paid'     => (int) $r['amount_paid'],
				'created_at'      => $r['created_at'],
			);
		}
		return array( 'receipts' => $out, 'date' => $date );
	}

	/** One receipt, laid out the way the printed slip is. */
	public static function receipt( $req ) {
		global $wpdb;
		$t   = AH_Install::table( 'payments' );
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$t} WHERE receipt_no = %s", sanitize_text_field( $req['no'] ) ),
			ARRAY_A
		);
		if ( ! $row ) {
			return new WP_Error( 'ah_not_found', 'Receipt not found', array( 'status' => 404 ) );
		}

		$order = wc_get_order( (int) $row['order_id'] );
		if ( ! $order ) {
			return new WP_Error( 'ah_not_found', 'The order for this receipt is gone', array( 'status' => 404 ) );
		}

		return array(
			'receipt' => array(
				'receiptNo'      => $row['receipt_no'],
				'orderNo'        => AH_Shape::order_no( $order ),
				'shop'           => AH_Sms::shop_name(),
				'customer'       => $order->get_meta( '_ah_company_name' ) ?: trim( $order->get_formatted_billing_full_name() ),
				'orderedBy'      => trim( $order->get_formatted_billing_full_name() ),
				'dateTime'       => $row['created_at'],
				'method'         => $row['method'],
				'transactionRef' => $row['transaction_ref'],
				'items'          => AH_Shape::items( $order ),
				'subtotal'       => AH_Shape::money( $order->get_subtotal() ),
				'deliveryFee'    => AH_Shape::money( $order->get_shipping_total() ),
				'total'          => (int) $row['amount_due'],
				'amountPaid'     => (int) $row['amount_paid'],
				'change'         => max( 0, (int) $row['amount_paid'] - (int) $row['amount_due'] ),
				'cashier'        => $row['cashier_name'],
			),
		);
	}

	/** The till hand-over: what this cashier took today, by method. */
	public static function end_of_day( $req ) {
		global $wpdb;
		$t    = AH_Install::table( 'payments' );
		$date = $req->get_param( 'date' ) ? sanitize_text_field( $req->get_param( 'date' ) ) : current_time( 'Y-m-d' );
		$me   = AH_Auth::current();

		$totals = array( 'cash' => 0, 'mobile_money' => 0, 'card' => 0 );
		foreach ( array_keys( $totals ) as $m ) {
			$totals[ $m ] = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COALESCE(SUM(amount_paid),0) FROM {$t}
					  WHERE method = %s AND DATE(created_at) = %s AND cashier_id = %d",
					$m,
					$date,
					$me->ID
				)
			);
		}
		$count = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$t} WHERE DATE(created_at) = %s AND cashier_id = %d",
				$date,
				$me->ID
			)
		);

		return array(
			'date'         => $date,
			'cashier'      => $me->display_name,
			'cash'         => $totals['cash'],
			'mobile_money' => $totals['mobile_money'],
			'card'         => $totals['card'],
			'total'        => array_sum( $totals ),
			'receipts'     => $count,
		);
	}

	// -----------------------------------------------------------------
	// Reconciliation
	// -----------------------------------------------------------------

	/**
	 * What was collected, against what Accounts has verified, against
	 * what the cash book says. The three should agree; the point of the
	 * screen is the day they do not.
	 */
	public static function reconciliation( $req ) {
		global $wpdb;
		$t    = AH_Install::table( 'payments' );
		$cb   = AH_Install::table( 'cash_book' );
		$date = $req->get_param( 'date' ) ? sanitize_text_field( $req->get_param( 'date' ) ) : current_time( 'Y-m-d' );

		$by_method = array();
		foreach ( array( 'cash', 'mobile_money', 'card' ) as $m ) {
			$row = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT COUNT(*) AS c,
					        COALESCE(SUM(amount_paid),0) AS collected,
					        COALESCE(SUM(CASE WHEN verified = 1  THEN amount_paid END),0) AS verified,
					        COALESCE(SUM(CASE WHEN verified = 0  THEN amount_paid END),0) AS pending,
					        COALESCE(SUM(CASE WHEN verified = -1 THEN amount_paid END),0) AS rejected
					   FROM {$t} WHERE method = %s AND DATE(created_at) = %s",
					$m,
					$date
				),
				ARRAY_A
			);
			$by_method[] = array(
				'method'    => $m,
				'count'     => (int) $row['c'],
				'collected' => (int) $row['collected'],
				'verified'  => (int) $row['verified'],
				'pending'   => (int) $row['pending'],
				'rejected'  => (int) $row['rejected'],
			);
		}

		$cash_in_book = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COALESCE(SUM(cash_in - cash_out),0) FROM {$cb} WHERE entry_date = %s AND method = 'cash'",
				$date
			)
		);
		$cash_taken = 0;
		foreach ( $by_method as $m ) {
			if ( 'cash' === $m['method'] ) {
				$cash_taken = $m['collected'];
			}
		}

		return array(
			'date'       => $date,
			'byMethod'   => $by_method,
			'cashBook'   => array( 'cash' => $cash_in_book ),
			'difference' => $cash_in_book - $cash_taken,
		);
	}

	// -----------------------------------------------------------------
	// Reports
	// -----------------------------------------------------------------

	public static function sales( $req ) {
		global $wpdb;
		$t = AH_Install::table( 'payments' );
		list( $from, $to ) = self::range( $req );

		// Verified only: money Accounts has matched is the only money
		// the shop should report as earned.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT DATE(created_at) AS day,
				        COALESCE(SUM(amount_paid),0) AS total,
				        COUNT(*) AS receipts
				   FROM {$t}
				  WHERE verified = 1 AND DATE(created_at) BETWEEN %s AND %s
				  GROUP BY day ORDER BY day",
				$from,
				$to
			),
			ARRAY_A
		);
		foreach ( $rows as $i => $r ) {
			$rows[ $i ]['total']    = (int) $r['total'];
			$rows[ $i ]['receipts'] = (int) $r['receipts'];
		}

		$by_method = array();
		foreach ( array( 'cash', 'mobile_money', 'card' ) as $m ) {
			$r = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT COALESCE(SUM(amount_paid),0) AS total, COUNT(*) AS receipts
					   FROM {$t}
					  WHERE verified = 1 AND method = %s AND DATE(created_at) BETWEEN %s AND %s",
					$m,
					$from,
					$to
				),
				ARRAY_A
			);
			$by_method[] = array(
				'method'   => $m,
				'total'    => (int) $r['total'],
				'receipts' => (int) $r['receipts'],
			);
		}

		return array(
			'from'     => $from,
			'to'       => $to,
			'currency' => AH_Sms::option( 'currency', 'UGX' ),
			'totals'   => array(
				'gross'    => array_sum( wp_list_pluck( $rows, 'total' ) ),
				'receipts' => array_sum( wp_list_pluck( $rows, 'receipts' ) ),
			),
			'byDay'    => $rows,
			'byMethod' => $by_method,
		);
	}

	public static function best_sellers( $req ) {
		list( $from, $to ) = self::range( $req );
		$orders = self::orders_between( $from, $to );

		$tally = array();
		foreach ( $orders as $order ) {
			if ( ! in_array( AH_Statuses::to_api( $order->get_status() ), array( 'payment_verified', 'released' ), true ) ) {
				continue;
			}
			foreach ( $order->get_items() as $item ) {
				$product = $item->get_product();
				$id      = $product ? $product->get_id() : 0;
				if ( ! isset( $tally[ $id ] ) ) {
					$tally[ $id ] = array(
						'product_id'   => $id,
						'product_name' => $item->get_name(),
						'unit'         => $product ? ( $product->get_attribute( 'unit' ) ?: 'pc' ) : 'pc',
						'qty_sold'     => 0,
						'revenue'      => 0,
						'orders'       => 0,
					);
				}
				$tally[ $id ]['qty_sold'] += (int) $item->get_quantity();
				$tally[ $id ]['revenue']  += AH_Shape::money( $item->get_total() );
				$tally[ $id ]['orders']++;
			}
		}

		$list = array_values( $tally );
		usort(
			$list,
			function ( $a, $b ) {
				return $b['revenue'] <=> $a['revenue'];
			}
		);

		return array( 'from' => $from, 'to' => $to, 'products' => $list );
	}

	public static function stock_movement( $req ) {
		list( $from, $to ) = self::range( $req );
		$orders = self::orders_between( $from, $to );

		$released = array();
		foreach ( $orders as $order ) {
			if ( 'released' !== AH_Statuses::to_api( $order->get_status() ) ) {
				continue;
			}
			foreach ( $order->get_items() as $item ) {
				$product = $item->get_product();
				if ( ! $product ) {
					continue;
				}
				$released[ $product->get_id() ] = ( $released[ $product->get_id() ] ?? 0 ) + (int) $item->get_quantity();
			}
		}

		$out = array();
		foreach ( wc_get_products( array( 'limit' => 300, 'status' => 'publish' ) ) as $p ) {
			$out[] = array(
				'code'            => $p->get_sku(),
				'name'            => $p->get_name(),
				'unit'            => $p->get_attribute( 'unit' ) ?: 'pc',
				// WooCommerce does not keep a goods-received ledger, so
				// this reports what left the shelf and what is on it.
				// Receipts and adjustments are a stock plugin's job.
				'received'        => 0,
				'released'        => (int) ( $released[ $p->get_id() ] ?? 0 ),
				'adjusted'        => 0,
				'stock_available' => $p->get_manage_stock() ? (int) $p->get_stock_quantity() : 0,
			);
		}
		return array( 'from' => $from, 'to' => $to, 'movements' => $out );
	}

	public static function orders_by_stage( $req ) {
		list( $from, $to ) = self::range( $req );
		$orders = self::orders_between( $from, $to );

		$tally = array();
		foreach ( $orders as $order ) {
			$status = AH_Statuses::to_api( $order->get_status() );
			if ( ! isset( $tally[ $status ] ) ) {
				$tally[ $status ] = array( 'status' => $status, 'orders' => 0, 'value' => 0 );
			}
			$tally[ $status ]['orders']++;
			$tally[ $status ]['value'] += AH_Shape::money( $order->get_total() );
		}
		return array( 'from' => $from, 'to' => $to, 'stages' => array_values( $tally ) );
	}

	public static function staff_activity( $req ) {
		global $wpdb;
		$t = AH_Install::table( 'events' );
		list( $from, $to ) = self::range( $req );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT handler_name AS full_name, stage AS role, action, COUNT(*) AS count
				   FROM {$t}
				  WHERE handled_by IS NOT NULL AND DATE(created_at) BETWEEN %s AND %s
				  GROUP BY handler_name, stage, action
				  ORDER BY full_name",
				$from,
				$to
			),
			ARRAY_A
		);
		foreach ( $rows as $i => $r ) {
			$rows[ $i ]['count'] = (int) $r['count'];
		}
		return array( 'from' => $from, 'to' => $to, 'staff' => $rows );
	}

	private static function orders_between( $from, $to ) {
		return wc_get_orders(
			array(
				'limit'        => -1,
				'date_created' => $from . '...' . $to,
				'status'       => array_merge(
					array( 'wc-pending', 'wc-completed', 'wc-cancelled', 'wc-refunded' ),
					array_keys( AH_Statuses::custom() )
				),
			)
		);
	}

	// -----------------------------------------------------------------
	// Notifications
	// -----------------------------------------------------------------

	/**
	 * What has happened that this person should know about.
	 *
	 * There is no separate notifications table: an order's audit trail
	 * already records every move, and a second copy of the same facts
	 * would only be a second thing to keep in step. A customer sees
	 * their own order's events; a desk sees recent activity, and the
	 * unread count is how many orders are waiting at that desk — which
	 * is the number a badge should actually show.
	 */
	public static function notifications() {
		global $wpdb;
		$user = AH_Auth::current();
		$desk = AH_Roles::desk_of( $user );
		$t    = AH_Install::table( 'events' );

		// What this person has deleted from their alerts. Only their list:
		// the audit trail keeps every record.
		$cleared = (int) get_user_meta( $user->ID, 'ah_alerts_cleared', true );
		$hidden  = array_map( 'intval', (array) get_user_meta( $user->ID, 'ah_alerts_hidden', true ) );
		$not_in  = $hidden ? ' AND id NOT IN (' . implode( ',', $hidden ) . ')' : '';

		if ( $desk ) {
			$rows   = $wpdb->get_results(
				$wpdb->prepare( "SELECT * FROM {$t} WHERE id > %d{$not_in} ORDER BY id DESC LIMIT 100", $cleared ),
				ARRAY_A
			);
			$unread = count( AH_Flow::queue_for( 'manager' === $desk ? 'cashier' : $desk, 200 ) );
		} else {
			$rows   = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT e.* FROM {$t} e
					  JOIN {$wpdb->prefix}wc_orders o ON o.id = e.order_id
					 WHERE o.customer_id = %d
					 ORDER BY e.id DESC LIMIT 40",
					$user->ID
				),
				ARRAY_A
			);
			// A site still on post storage has no wc_orders table; fall
			// back to walking this customer's own orders.
			if ( $wpdb->last_error ) {
				$rows = array();
				foreach ( wc_get_orders( array( 'customer_id' => $user->ID, 'limit' => 10 ) ) as $o ) {
					$rows = array_merge( $rows, AH_Flow::events_for( $o->get_id() ) );
				}
				$rows = array_slice( array_reverse( $rows ), 0, 40 );
			}
			$unread = 0;
		}

		$seen = (int) get_user_meta( $user->ID, 'ah_notifications_seen', true );
		$out  = array();
		foreach ( $rows as $r ) {
			if ( (int) $r['id'] <= $cleared || in_array( (int) $r['id'], $hidden, true ) ) {
				continue;
			}
			$order = wc_get_order( (int) $r['order_id'] );
			$out[] = array(
				'id'         => (int) $r['id'],
				'title'      => self::event_title( $r, $order ),
				'body'       => $r['notes'],
				'order_id'   => $order ? $order->get_id() : null,
				'order_no'   => $order ? AH_Shape::order_no( $order ) : null,
				'read'       => (int) $r['id'] <= $seen ? 1 : 0,
				'created_at' => $r['created_at'],
			);
		}

		return array( 'notifications' => $out, 'unread' => $unread );
	}

	/**
	 * Delete alerts from this person's list: some, or all of them. The
	 * record stays in the audit trail, so nothing that happened can be
	 * made to disappear by deleting its alert.
	 */
	public static function delete_alerts( $req ) {
		global $wpdb;
		$user = AH_Auth::current();
		if ( $req->get_param( 'all' ) ) {
			$max = (int) $wpdb->get_var( 'SELECT COALESCE(MAX(id),0) FROM ' . AH_Install::table( 'events' ) );
			update_user_meta( $user->ID, 'ah_alerts_cleared', $max );
			update_user_meta( $user->ID, 'ah_notifications_seen', max( $max, (int) get_user_meta( $user->ID, 'ah_notifications_seen', true ) ) );
			delete_user_meta( $user->ID, 'ah_alerts_hidden' );
			return array( 'ok' => true, 'deleted' => 'all' );
		}
		$ids = array_filter( array_map( 'intval', (array) $req->get_param( 'ids' ) ) );
		if ( ! $ids ) {
			return new WP_Error( 'ah_nothing_chosen', 'Choose the alerts to delete', array( 'status' => 400 ) );
		}
		$cleared = (int) get_user_meta( $user->ID, 'ah_alerts_cleared', true );
		$hidden  = array_map( 'intval', (array) get_user_meta( $user->ID, 'ah_alerts_hidden', true ) );
		// Anything already below the "all cleared" line need not be kept.
		$hidden = array_values( array_filter( array_unique( array_merge( $hidden, $ids ) ), function ( $id ) use ( $cleared ) { return $id > $cleared; } ) );
		update_user_meta( $user->ID, 'ah_alerts_hidden', array_slice( $hidden, -2000 ) );
		return array( 'ok' => true, 'deleted' => count( $ids ) );
	}

	/** What happened, in words; an order number only when there is one. */
	private static function event_title( $event, $order ) {
		$no    = $order ? AH_Shape::order_no( $order ) : 'an order';
		$plain = array(
			'products_deleted'     => 'Products deleted',
			'orders_deleted'       => 'Orders deleted',
			'customers_deleted'    => 'Customers deleted',
			'customer_added'       => 'Customer added',
			'price_changed'        => 'Price changed',
			'stock_count_approved' => 'Stock count approved',
			'stock_count_deleted'  => 'Stock count deleted',
			'category_added'       => 'Category added',
			'category_changed'     => 'Category changed',
			'category_deleted'     => 'Category deleted',
			'till_closed'          => 'Till closed',
			'po_created'           => 'Purchase order made',
			'po_received'          => 'Goods received from a supplier',
			'po_closed'            => 'Purchase order closed',
			'po_cancelled'         => 'Purchase order cancelled',
			'po_deleted'           => 'Purchase order deleted',
			'bill_added'           => 'Supplier bill recorded',
			'bill_paid'            => 'Supplier paid',
			'bill_deleted'         => 'Supplier bill deleted',
			'supplier_return'      => 'Goods sent back to a supplier',
			'staff_deleted'        => 'Desk login deleted',
			'staff_suspended'      => 'Desk login suspended',
			'staff_restored'       => 'Desk login let back in',
			'staff_moved'          => 'Moved to another desk',
			'worker_added'         => 'Worker added',
			'worker_updated'       => 'Worker changed',
			'workers_deleted'      => 'Workers deleted',
			'payroll_started'      => 'Payroll drafted',
			'payroll_approved'     => 'Payroll approved',
			'data_exported'        => 'Data exported',
			'part_released'        => $order ? "Part of {$no} delivered" : 'Part delivered',
			'looked_up'            => $order ? "{$no} opened at the store" : 'Order opened at the store',
		);
		if ( isset( $plain[ $event['action'] ] ) ) {
			return $plain[ $event['action'] ];
		}
		switch ( $event['action'] ) {
			case 'placed':
				return "New order {$no}";
			case 'payment_received':
				return "Payment received for {$no}";
			case 'verified':
				return "Payment verified for {$no}";
			case 'rejected':
				return "Payment rejected on {$no}";
			case 'released':
				return "{$no} released to the customer";
			case 'cancelled':
				return "{$no} cancelled";
			default:
				$what = ucfirst( str_replace( '_', ' ', $event['action'] ) );
				return $order ? "{$what} · {$no}" : $what;
		}
	}

	public static function read_all() {
		global $wpdb;
		$t    = AH_Install::table( 'events' );
		$user = AH_Auth::current();
		$max  = (int) $wpdb->get_var( "SELECT COALESCE(MAX(id),0) FROM {$t}" );
		update_user_meta( $user->ID, 'ah_notifications_seen', $max );
		return array( 'ok' => true );
	}

	// -----------------------------------------------------------------
	// The order register and the manager's lists
	// -----------------------------------------------------------------

	public static function register( $req ) {
		$args = array( 'limit' => (int) ( $req->get_param( 'limit' ) ?: 100 ), 'orderby' => 'date', 'order' => 'DESC' );

		if ( $req->get_param( 'status' ) && 'all' !== $req->get_param( 'status' ) ) {
			$args['status'] = AH_Statuses::to_wc( sanitize_text_field( $req->get_param( 'status' ) ) );
		}
		if ( $req->get_param( 'search' ) ) {
			$args['s'] = sanitize_text_field( $req->get_param( 'search' ) );
		}

		return array(
			'orders' => array_map(
				function ( $o ) {
					return AH_Shape::order( $o );
				},
				wc_get_orders( $args )
			),
		);
	}

	public static function staff() {
		$out = array();
		foreach ( array_keys( AH_Roles::map() ) as $role ) {
			foreach ( get_users( array( 'role' => $role ) ) as $u ) {
				$row            = AH_Shape::user( $u );
				$row['lastSeen'] = get_user_meta( $u->ID, 'ah_last_seen', true ) ?: null;
				$out[]          = $row;
			}
		}
		return array( 'staff' => $out );
	}


	/**
	 * What each of these customers has spent, in one query.
	 *
	 * WooCommerce can store orders in its own table or as posts, and
	 * the shop may be on either, so both are handled. Cancelled and
	 * rejected orders are left out — a customer has not spent money on
	 * an order that never completed.
	 */
	private static function spend_by_customer( $ids, $with_guests = false ) {
		global $wpdb;
		$ids = array_filter( array_map( 'intval', (array) $ids ) );
		if ( $with_guests ) {
			// Customer 0: counter sales to somebody who gave no name.
			$ids[] = 0;
		}
		if ( ! $ids ) {
			return array();
		}

		$in     = implode( ',', $ids );
		$skip   = "'wc-cancelled','wc-ah-rejected','wc-refunded','trash'";
		$hpos   = class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' )
			&& \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();

		// Alongside the totals: how much of it was bought in person at
		// the counter, and when they last bought anything.
		if ( $hpos ) {
			$rows = $wpdb->get_results(
				"SELECT o.customer_id AS customer_id, COUNT(*) AS orders,
				        COALESCE(SUM(o.total_amount),0) AS spent,
				        SUM(CASE WHEN src.meta_value = 'counter' THEN 1 ELSE 0 END) AS shop_orders,
				        COALESCE(SUM(CASE WHEN src.meta_value = 'counter' THEN o.total_amount ELSE 0 END),0) AS shop_spent,
				        MAX(o.date_created_gmt) AS last_at
				   FROM {$wpdb->prefix}wc_orders o
				   LEFT JOIN {$wpdb->prefix}wc_orders_meta src ON src.order_id = o.id AND src.meta_key = '_ah_source'
				  WHERE o.customer_id IN ({$in}) AND o.type = 'shop_order' AND o.status NOT IN ({$skip})
				  GROUP BY o.customer_id",
				ARRAY_A
			);
		} else {
			$rows = $wpdb->get_results(
				"SELECT cust.meta_value AS customer_id,
				        COUNT(*) AS orders,
				        COALESCE(SUM(tot.meta_value),0) AS spent,
				        SUM(CASE WHEN src.meta_value = 'counter' THEN 1 ELSE 0 END) AS shop_orders,
				        COALESCE(SUM(CASE WHEN src.meta_value = 'counter' THEN tot.meta_value ELSE 0 END),0) AS shop_spent,
				        MAX(p.post_date_gmt) AS last_at
				   FROM {$wpdb->posts} p
				   JOIN {$wpdb->postmeta} cust ON cust.post_id = p.ID AND cust.meta_key = '_customer_user'
				   LEFT JOIN {$wpdb->postmeta} tot ON tot.post_id = p.ID AND tot.meta_key = '_order_total'
				   LEFT JOIN {$wpdb->postmeta} src ON src.post_id = p.ID AND src.meta_key = '_ah_source'
				  WHERE p.post_type = 'shop_order'
				    AND p.post_status NOT IN ({$skip})
				    AND cust.meta_value IN ({$in})
				  GROUP BY cust.meta_value",
				ARRAY_A
			);
		}

		$out = array();
		foreach ( (array) $rows as $r ) {
			$out[ (int) $r['customer_id'] ] = array(
				'orders'     => (int) $r['orders'],
				'spent'      => (int) round( (float) $r['spent'] ),
				'shopOrders' => (int) $r['shop_orders'],
				'shopSpent'  => (int) round( (float) $r['shop_spent'] ),
				'lastAt'     => $r['last_at'] ? get_date_from_gmt( $r['last_at'], 'Y-m-d H:i:s' ) : null,
			);
		}
		return $out;
	}

	public static function customers( $req ) {
		$args = array( 'role' => 'customer', 'number' => 200 );
		$q    = trim( sanitize_text_field( (string) $req->get_param( 'q' ) ) );
		if ( '' !== $q ) {
			$args['search']         = '*' . $q . '*';
			$args['search_columns'] = array( 'display_name', 'user_email', 'user_login' );
		}

		$users = get_users( $args );

		// By phone too. The box has always said "Name, phone or email",
		// but the number lives in user meta, which a user search does not
		// look at — so typing a number found nobody. Matched on the last
		// nine digits, so "0772 123 456" finds "+256772123456".
		$digits = preg_replace( '/\D/', '', $q );
		if ( strlen( $digits ) >= 6 ) {
			$tail = substr( $digits, -9 );
			$by_phone = get_users(
				array(
					'role'       => 'customer',
					'number'     => 50,
					'meta_query' => array(
						array(
							'key'     => 'ah_phone',
							'value'   => $tail,
							'compare' => 'LIKE',
						),
					),
				)
			);
			$seen = wp_list_pluck( $users, 'ID' );
			foreach ( $by_phone as $u ) {
				if ( ! in_array( $u->ID, $seen, true ) ) {
					$users[] = $u;
				}
			}
		}
		// One aggregate for everybody, rather than a pair of queries per
		// customer and then a full order load for each of their orders.
		// Two hundred customers with ten orders each used to be two
		// thousand order loads to draw one table. Customer 0 rides along:
		// the counter sales to people who gave no name.
		$totals = self::spend_by_customer( wp_list_pluck( $users, 'ID' ), true );
		$none   = array( 'orders' => 0, 'spent' => 0, 'shopOrders' => 0, 'shopSpent' => 0, 'lastAt' => null );

		$out = array();
		foreach ( $users as $u ) {
			$t                 = isset( $totals[ $u->ID ] ) ? $totals[ $u->ID ] : $none;
			$row               = AH_Shape::user( $u );
			$row['orderCount'] = $t['orders'];
			$row['totalSpent'] = $t['spent'];
			$row['shopOrders'] = $t['shopOrders'];
			$row['shopSpent']  = $t['shopSpent'];
			$row['lastBought'] = $t['lastAt'];
			$out[]             = $row;
		}

		$guests = isset( $totals[0] ) ? $totals[0] : $none;
		return array(
			'customers' => $out,
			// Bought at the counter without giving a name or number.
			'walkIns'   => array(
				'sales' => $guests['shopOrders'],
				'spent' => $guests['shopSpent'],
				'last'  => $guests['lastAt'],
			),
		);
	}

	/**
	 * Counter sales to people who gave no name, newest first, with what
	 * each one bought.
	 */
	public static function walk_in_sales( $req ) {
		$orders = wc_get_orders(
			array(
				'customer_id' => 0,
				'limit'       => min( 300, max( 1, (int) ( $req->get_param( 'limit' ) ?: 100 ) ) ),
				'orderby'     => 'date',
				'order'       => 'DESC',
				'meta_key'    => '_ah_source',
				'meta_value'  => 'counter',
			)
		);
		$out = array();
		foreach ( $orders as $o ) {
			$row          = AH_Shape::order( $o );
			$row['items'] = AH_Shape::items( $o );
			$out[]        = $row;
		}
		return array( 'orders' => $out );
	}

	public static function audit( $req ) {
		global $wpdb;
		$t     = AH_Install::table( 'events' );
		$limit = min( 500, max( 1, (int) ( $req->get_param( 'limit' ) ?: 300 ) ) );

		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$t} ORDER BY id DESC LIMIT %d", $limit ),
			ARRAY_A
		);
		foreach ( $rows as $i => $r ) {
			$order                = wc_get_order( (int) $r['order_id'] );
			$rows[ $i ]['order_no'] = $order ? AH_Shape::order_no( $order ) : null;
		}
		return array( 'events' => $rows );
	}
}
