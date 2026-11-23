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
		$route( '/reports/export/(?P<report>[a-z\-]+)\.csv', $get, $books, array( __CLASS__, 'export_csv' ) );

		// ── Notifications ─────────────────────────────────────────────
		$route( '/notifications', $get, AH_Rest::class . '::signed_in', array( __CLASS__, 'notifications' ) );
		$route( '/notifications/read-all', $post, AH_Rest::class . '::signed_in', array( __CLASS__, 'read_all' ) );

		// ── The order register, and the manager's lists ───────────────
		$route( '/orders', $get, $any_desk, array( __CLASS__, 'register' ) );
		$route( '/manager/staff', $get, $manager, array( __CLASS__, 'staff' ) );
		$route( '/manager/customers', $get, $manager, array( __CLASS__, 'customers' ) );
		$route( '/manager/audit', $get, $manager, array( __CLASS__, 'audit' ) );
		$route( '/manager/products', array( $get, $post ), $manager, array( __CLASS__, 'products' ) );
		$route( '/manager/products/(?P<id>\d+)', $post, $manager, array( __CLASS__, 'update_product' ) );
	}

	// -----------------------------------------------------------------
	// Dates
	// -----------------------------------------------------------------

	/** `?period=daily|weekly|monthly` or `?from=&to=`, as the panel sends. */
	private static function range( $req ) {
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

	/** Reports as a spreadsheet, which is how they get used. */
	public static function export_csv( $req ) {
		$report = sanitize_text_field( $req['report'] );
		list( $from, $to ) = self::range( $req );
		$rows = array();

		switch ( $report ) {
			case 'sales':
				$data   = self::sales( $req );
				$rows[] = array( 'Day', 'Receipts', 'Total' );
				foreach ( $data['byDay'] as $d ) {
					$rows[] = array( $d['day'], $d['receipts'], $d['total'] );
				}
				break;

			case 'orders':
				$rows[] = array( 'Order', 'Status', 'Customer', 'Items', 'Total', 'Placed' );
				foreach ( self::orders_between( $from, $to ) as $o ) {
					$s      = AH_Shape::order( $o );
					$rows[] = array(
						$s['order_no'], $s['status_label'], $s['ordered_by_name'],
						$s['item_count'], $s['total'], $s['created_at'],
					);
				}
				break;

			case 'cash-book':
				global $wpdb;
				$cb     = AH_Install::table( 'cash_book' );
				$rows[] = array( 'Date', 'Details', 'Cash in', 'Cash out' );
				$res    = $wpdb->get_results(
					$wpdb->prepare( "SELECT * FROM {$cb} WHERE entry_date BETWEEN %s AND %s ORDER BY id", $from, $to ),
					ARRAY_A
				);
				foreach ( $res as $r ) {
					$rows[] = array( $r['entry_date'], $r['details'], $r['cash_in'], $r['cash_out'] );
				}
				break;

			case 'stock':
				$rows[] = array( 'Code', 'Product', 'Unit', 'Released', 'In stock' );
				foreach ( self::stock_movement( $req )['movements'] as $m ) {
					$rows[] = array( $m['code'], $m['name'], $m['unit'], $m['released'], $m['stock_available'] );
				}
				break;

			default:
				return new WP_Error( 'ah_unknown_report', 'No such report', array( 'status' => 404 ) );
		}

		$out = fopen( 'php://temp', 'r+' );
		foreach ( $rows as $row ) {
			fputcsv( $out, $row );
		}
		rewind( $out );
		$csv = stream_get_contents( $out );
		fclose( $out );

		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $report . '-' . $to . '.csv"' );
		echo $csv; // phpcs:ignore WordPress.Security.EscapeOutput
		exit;
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

		if ( $desk ) {
			$rows   = $wpdb->get_results(
				"SELECT * FROM {$t} ORDER BY id DESC LIMIT 40",
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

	private static function event_title( $event, $order ) {
		$no = $order ? AH_Shape::order_no( $order ) : 'an order';
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
				return ucfirst( str_replace( '_', ' ', $event['action'] ) ) . " · {$no}";
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
	private static function spend_by_customer( $ids ) {
		global $wpdb;
		$ids = array_filter( array_map( 'intval', (array) $ids ) );
		if ( ! $ids ) {
			return array();
		}

		$in     = implode( ',', $ids );
		$skip   = "'wc-cancelled','wc-ah-rejected','wc-refunded','trash'";
		$hpos   = class_exists( 'AutomatticWooCommerceUtilitiesOrderUtil' )
			&& AutomatticWooCommerceUtilitiesOrderUtil::custom_orders_table_usage_is_enabled();

		if ( $hpos ) {
			$rows = $wpdb->get_results(
				"SELECT customer_id, COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS spent
				   FROM {$wpdb->prefix}wc_orders
				  WHERE customer_id IN ({$in}) AND status NOT IN ({$skip})
				  GROUP BY customer_id",
				ARRAY_A
			);
		} else {
			$rows = $wpdb->get_results(
				"SELECT cust.meta_value AS customer_id,
				        COUNT(*) AS orders,
				        COALESCE(SUM(tot.meta_value),0) AS spent
				   FROM {$wpdb->posts} p
				   JOIN {$wpdb->postmeta} cust ON cust.post_id = p.ID AND cust.meta_key = '_customer_user'
				   LEFT JOIN {$wpdb->postmeta} tot ON tot.post_id = p.ID AND tot.meta_key = '_order_total'
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
				'orders' => (int) $r['orders'],
				'spent'  => (int) round( (float) $r['spent'] ),
			);
		}
		return $out;
	}

	public static function customers( $req ) {
		$args = array( 'role' => 'customer', 'number' => 200 );
		if ( $req->get_param( 'q' ) ) {
			$args['search']         = '*' . sanitize_text_field( $req->get_param( 'q' ) ) . '*';
			$args['search_columns'] = array( 'display_name', 'user_email', 'user_login' );
		}

		$users = get_users( $args );
		if ( ! $users ) {
			return array( 'customers' => array() );
		}

		// One aggregate for everybody, rather than a pair of queries per
		// customer and then a full order load for each of their orders.
		// Two hundred customers with ten orders each used to be two
		// thousand order loads to draw one table.
		$totals = self::spend_by_customer( wp_list_pluck( $users, 'ID' ) );

		$out = array();
		foreach ( $users as $u ) {
			$row               = AH_Shape::user( $u );
			$row['orderCount'] = isset( $totals[ $u->ID ] ) ? $totals[ $u->ID ]['orders'] : 0;
			$row['totalSpent'] = isset( $totals[ $u->ID ] ) ? $totals[ $u->ID ]['spent'] : 0;
			$out[]             = $row;
		}
		return array( 'customers' => $out );
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

	public static function products( $req ) {
		if ( 'POST' === $req->get_method() ) {
			$p = new WC_Product_Simple();
			$p->set_name( sanitize_text_field( $req->get_param( 'name' ) ) );
			$p->set_sku( sanitize_text_field( $req->get_param( 'code' ) ) );
			$p->set_regular_price( (string) (int) $req->get_param( 'price' ) );
			$p->set_manage_stock( true );
			$p->set_stock_quantity( (int) $req->get_param( 'stockAvailable' ) );
			$p->set_status( 'publish' );
			$id = $p->save();

			if ( $req->get_param( 'reorderLevel' ) !== null ) {
				update_post_meta( $id, '_ah_reorder_level', (int) $req->get_param( 'reorderLevel' ) );
			}
			if ( $req->get_param( 'unit' ) ) {
				update_post_meta( $id, '_ah_unit', sanitize_text_field( $req->get_param( 'unit' ) ) );
			}
			return array( 'product' => AH_Shape::product( $id ) );
		}

		return AH_Rest::products( $req );
	}

	public static function update_product( $req ) {
		$product = wc_get_product( (int) $req['id'] );
		if ( ! $product ) {
			return new WP_Error( 'ah_not_found', 'Product not found', array( 'status' => 404 ) );
		}

		if ( null !== $req->get_param( 'price' ) ) {
			$product->set_regular_price( (string) (int) $req->get_param( 'price' ) );
		}
		if ( null !== $req->get_param( 'stockAvailable' ) ) {
			$product->set_manage_stock( true );
			$product->set_stock_quantity( (int) $req->get_param( 'stockAvailable' ) );
		}
		if ( $req->get_param( 'name' ) ) {
			$product->set_name( sanitize_text_field( $req->get_param( 'name' ) ) );
		}
		if ( null !== $req->get_param( 'active' ) ) {
			$product->set_status( $req->get_param( 'active' ) ? 'publish' : 'draft' );
		}
		$product->save();

		if ( null !== $req->get_param( 'reorderLevel' ) ) {
			update_post_meta( $product->get_id(), '_ah_reorder_level', (int) $req->get_param( 'reorderLevel' ) );
		}
		if ( $req->get_param( 'unit' ) ) {
			update_post_meta( $product->get_id(), '_ah_unit', sanitize_text_field( $req->get_param( 'unit' ) ) );
		}

		return array( 'product' => AH_Shape::product( $product->get_id() ) );
	}
}
