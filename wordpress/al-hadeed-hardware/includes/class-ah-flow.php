<?php
/**
 * The order flow: Cashier → Accounts → Store Manager.
 *
 * Every rule about who may move an order, and when, lives here. The
 * desk screens and the REST API both call these four methods and
 * neither gets to decide for itself — which is why a cashier cannot
 * release goods by typing a URL, and why an order cannot be verified
 * twice.
 *
 *   receive_payment()  pending      → ah-paid       (+ receipt, cash book)
 *   verify_payment()   ah-paid      → ah-verified   (or ah-rejected, back)
 *   release_order()    ah-verified  → completed     (+ stock reduced)
 *   cancel_order()     any early    → cancelled
 *
 * Each one writes an audit event, texts the customer, and leaves the
 * order where the next desk will find it.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Flow {

	public static function init() {
		// A website order arriving at checkout belongs to the cashier,
		// and the customer should be told so straight away.
		add_action( 'woocommerce_checkout_order_processed', array( __CLASS__, 'on_new_order' ), 10, 1 );
		add_action( 'woocommerce_store_api_checkout_order_processed', array( __CLASS__, 'on_new_order' ), 10, 1 );
	}

	/**
	 * A new website order: stamp it with the shop's own order number and
	 * text the customer what to do next.
	 */
	/**
	 * @param WC_Order|int $order
	 * @param bool         $notify Text the customer. The app's ordering
	 *                             routes text them themselves (they need to
	 *                             report whether it went), so they pass
	 *                             false — before, every app order sent the
	 *                             same "order placed" text twice.
	 */
	public static function on_new_order( $order, $notify = true ) {
		$order = is_numeric( $order ) ? wc_get_order( $order ) : $order;
		if ( ! $order ) {
			return;
		}
		if ( $order->get_meta( '_ah_order_no' ) ) {
			return; // already handled
		}

		$order->update_meta_data( '_ah_order_no', 'AH-' . $order->get_order_number() );

		// Only if nobody has already said where it came from. This used
		// to overwrite unconditionally, and since it runs after the
		// ordering routes have stamped an order 'app', every order
		// placed on the phone was filed as a website order.
		if ( ! $order->get_meta( '_ah_source' ) ) {
			$order->update_meta_data( '_ah_source', 'web' );
		}
		$order->save();

		self::log_event(
			$order->get_id(),
			'customer',
			'placed',
			null,
			'pending_payment',
			null,
			$order->get_item_count() . ' item(s)'
		);
		do_action( 'ah_order_placed', $order );

		$phone = $order->get_billing_phone();
		if ( $phone && $notify ) {
			AH_Sms::send( $phone, AH_Sms::order_placed_message( $order ) );
		}
	}

	// -----------------------------------------------------------------
	// 1. Cashier takes the money
	// -----------------------------------------------------------------

	/**
	 * @param int    $order_id
	 * @param array  $args method, amount_paid, transaction_ref
	 * @param int    $cashier_id
	 * @return array|WP_Error the order, as the clients read it
	 */
	public static function receive_payment( $order_id, $args, $cashier_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return new WP_Error( 'ah_not_found', 'Order not found', array( 'status' => 404 ) );
		}

		$status = AH_Statuses::to_api( $order->get_status() );
		if ( ! in_array( $status, array( 'pending_payment', 'rejected' ), true ) ) {
			return new WP_Error(
				'ah_wrong_stage',
				sprintf( 'Order %s is already %s', AH_Shape::order_no( $order ), AH_Statuses::label_of( $order->get_status() ) ),
				array( 'status' => 409 )
			);
		}

		$method = isset( $args['method'] ) ? $args['method'] : '';
		if ( ! in_array( $method, array( 'cash', 'mobile_money', 'card', 'credit' ), true ) ) {
			return new WP_Error( 'ah_bad_method', 'Unknown payment method', array( 'status' => 400 ) );
		}

		$ref = isset( $args['transaction_ref'] ) ? AH_Proofs::normalise_ref( $args['transaction_ref'] ) : '';
		// Mobile money and card leave a reference behind. Without it
		// Accounts has nothing to match against the statement, and the
		// order would stall there instead of here.
		if ( in_array( $method, array( 'mobile_money', 'card' ), true ) && '' === $ref ) {
			return new WP_Error(
				'ah_ref_required',
				'A transaction reference is required for mobile money and card payments',
				array( 'status' => 400 )
			);
		}

		// One mobile money transaction pays for one order. Used twice,
		// the shop has a receipt for money it received once — by mistake
		// or otherwise, and Accounts would only find out at month end.
		if ( '' !== $ref ) {
			$used = AH_Proofs::already_used( $ref, $order->get_id() );
			if ( $used ) {
				$other = wc_get_order( (int) $used['order_id'] );
				return new WP_Error(
					'ah_ref_used',
					sprintf(
						'Transaction %s has already paid for order %s (receipt %s). Check the reference.',
						$ref,
						$other ? AH_Shape::order_no( $other ) : '#' . $used['order_id'],
						$used['receipt_no']
					),
					array( 'status' => 409 )
				);
			}
		}

		$due  = AH_Shape::money( $order->get_total() );
		$paid = isset( $args['amount_paid'] ) ? (int) $args['amount_paid'] : $due;

		// On account: no money now. Allowed only within the customer's
		// credit limit and terms, or by the manager with a reason.
		if ( 'credit' === $method ) {
			$refused = AH_Credit::check( $order, $due, $args['override'] ?? '', $cashier_id );
			if ( $refused ) {
				return $refused;
			}
			$paid = $due;
		}
		if ( $paid < $due ) {
			return new WP_Error(
				'ah_short_payment',
				sprintf( 'That is %s short of the %s due', self::money_label( $due - $paid ), self::money_label( $due ) ),
				array( 'status' => 400 )
			);
		}

		global $wpdb;
		$cashier    = get_user_by( 'id', $cashier_id );
		$receipt_no = self::next_receipt_no();
		$now        = current_time( 'mysql' );

		$wpdb->insert(
			AH_Install::table( 'payments' ),
			array(
				'order_id'        => $order->get_id(),
				'receipt_no'      => $receipt_no,
				'amount_due'      => $due,
				'amount_paid'     => $paid,
				'method'          => $method,
				'transaction_ref' => $ref ? $ref : null,
				'proof_file'      => ! empty( $args['proof_file'] ) ? $args['proof_file'] : null,
				'cashier_id'      => $cashier_id,
				'cashier_name'    => $cashier ? $cashier->display_name : '',
				'verified'        => 0,
				'created_at'      => $now,
			)
		);
		$payment_id = $wpdb->insert_id;

		// The cash book is the thing the shop reconciles at close of
		// day, so the money is entered the moment it is taken. A credit
		// sale takes no money, so it goes on the customer's account.
		if ( 'credit' === $method ) {
			AH_Credit::charge( $order, $due, $receipt_no );
		} else $wpdb->insert(
			AH_Install::table( 'cash_book' ),
			array(
				'entry_date'  => current_time( 'Y-m-d' ),
				'details'     => sprintf( '%s · Order %s', $receipt_no, AH_Shape::order_no( $order ) ),
				'cash_in'     => $paid,
				'cash_out'    => 0,
				'method'      => $method,
				'order_id'    => $order->get_id(),
				'payment_id'  => $payment_id,
				'recorded_by' => $cashier_id,
				'created_at'  => $now,
			)
		);

		$order->update_meta_data( '_ah_receipt_no', $receipt_no );
		if ( 'credit' === $method ) {
			$order->update_meta_data( '_ah_on_credit', 'yes' );
		}
		$order->set_status( 'ah-paid', 'credit' === $method ? 'Sold on credit at the cashier desk.' : 'Payment received at the cashier desk.' );
		$order->save();

		self::after_move( $order, 'cashier', 'payment_received', 'pending_payment', 'paid', $cashier_id, "Receipt {$receipt_no}" );
		return AH_Shape::order( $order, true );
	}

	// -----------------------------------------------------------------
	// 2. Accounts check it
	// -----------------------------------------------------------------

	public static function verify_payment( $order_id, $approve, $remarks, $user_id ) {
		global $wpdb;

		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return new WP_Error( 'ah_not_found', 'Order not found', array( 'status' => 404 ) );
		}
		if ( 'paid' !== AH_Statuses::to_api( $order->get_status() ) ) {
			return new WP_Error(
				'ah_wrong_stage',
				sprintf( 'Order %s is not waiting for verification', AH_Shape::order_no( $order ) ),
				array( 'status' => 409 )
			);
		}

		$user    = get_user_by( 'id', $user_id );
		$payment = self::payment_for( $order->get_id() );

		if ( $payment ) {
			$wpdb->update(
				AH_Install::table( 'payments' ),
				array(
					'verified'       => $approve ? 1 : -1,
					'verified_by'    => $user_id,
					'verifier_name'  => $user ? $user->display_name : '',
					'verified_at'    => current_time( 'mysql' ),
					'verify_remarks' => $remarks ? $remarks : null,
				),
				array( 'id' => $payment['id'] )
			);
		}

		if ( $approve ) {
			$order->set_status( 'ah-verified', 'Payment verified by Accounts.' );
			$order->save();
			self::after_move( $order, 'accounts', 'verified', 'paid', 'payment_verified', $user_id, $remarks );
		} else {
			// A rejected payment goes back to the cashier, never
			// forward. The money is already in the till or it is not,
			// and that is the cashier's to sort out.
			$order->set_status( 'ah-rejected', 'Accounts could not match this payment.' );
			$order->save();

			// The cash book entry is reversed rather than deleted: the
			// shop needs to see that it happened and was undone.
			if ( $payment && 'credit' === $payment['method'] ) {
				AH_Credit::reverse_order( $order, 'Sent back by Accounts' . ( $remarks ? ': ' . $remarks : '' ) );
			} elseif ( $payment ) {
				$wpdb->insert(
					AH_Install::table( 'cash_book' ),
					array(
						'entry_date'  => current_time( 'Y-m-d' ),
						'details'     => sprintf( 'Reversal · %s · %s', $payment['receipt_no'], $remarks ? $remarks : 'payment not matched' ),
						'cash_in'     => 0,
						'cash_out'    => (int) $payment['amount_paid'],
						'method'      => $payment['method'],
						'order_id'    => $order->get_id(),
						'payment_id'  => $payment['id'],
						'recorded_by' => $user_id,
						'created_at'  => current_time( 'mysql' ),
					)
				);
			}

			self::after_move( $order, 'accounts', 'rejected', 'paid', 'rejected', $user_id, $remarks );
		}

		return AH_Shape::order( $order, true );
	}

	// -----------------------------------------------------------------
	// 3. Store releases the goods
	// -----------------------------------------------------------------

	public static function release_order( $order_id, $args, $user_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return new WP_Error( 'ah_not_found', 'Order not found', array( 'status' => 404 ) );
		}
		if ( 'payment_verified' !== AH_Statuses::to_api( $order->get_status() ) ) {
			return new WP_Error(
				'ah_wrong_stage',
				sprintf( 'Order %s has not been verified by Accounts yet', AH_Shape::order_no( $order ) ),
				array( 'status' => 409 )
			);
		}

		// Stock comes off the shelf when the goods leave it, not when the
		// order is placed, and only as much as leaves: a builder can take
		// ten lengths today and the other ten next week. Each delivery is
		// its own line in the stock book.
		$want    = isset( $args['lines'] ) && is_array( $args['lines'] ) ? $args['lines'] : null;
		$going   = array();
		$left    = 0;
		foreach ( $order->get_items() as $item_id => $item ) {
			$sold = (float) $item->get_quantity();
			$done = (float) $item->get_meta( '_ah_qty_released' );
			$rest = max( 0, round( $sold - $done, 2 ) );
			$now  = null === $want ? $rest : (float) ( $want[ $item_id ] ?? $want[ (string) $item_id ] ?? 0 );
			if ( $now < 0 || $now > $rest ) {
				return new WP_Error( 'ah_bad_qty', sprintf( 'Only %d of %s are still to deliver', $rest, $item->get_name() ), array( 'status' => 400 ) );
			}
			if ( $now > 0 ) {
				$going[] = array( $item, $now );
			}
			$left += $rest - $now;
		}
		if ( ! $going ) {
			return new WP_Error( 'ah_nothing', 'Choose what is being delivered now', array( 'status' => 400 ) );
		}

		$no = AH_Shape::order_no( $order );
		foreach ( $going as list( $item, $now ) ) {
			$product = $item->get_product();
			if ( $product ) {
				$sold_qty = max( 1, (float) $item->get_quantity() );
				AH_Stock::adjust( $product, -$now, 'sold', array(
					'order_id'   => $order->get_id(),
					'ref'        => $no,
					'unit_cost'  => (int) ( $item->get_meta( '_ah_unit_cost' ) ?: AH_Stock::cost_of( $product->get_id() ) ),
					'unit_price' => (int) round( (float) $item->get_total() / $sold_qty ),
					'note'       => ! empty( $args['collected_by'] ) ? 'Collected by ' . sanitize_text_field( $args['collected_by'] ) : '',
				) );
			}
			$item->update_meta_data( '_ah_qty_released', (float) $item->get_meta( '_ah_qty_released' ) + $now );
			$item->save();
		}

		if ( ! empty( $args['collected_by'] ) ) {
			$order->update_meta_data( '_ah_collected_by', sanitize_text_field( $args['collected_by'] ) );
		}
		if ( ! empty( $args['delivery_status'] ) ) {
			$order->update_meta_data( '_ah_delivery_status', sanitize_text_field( $args['delivery_status'] ) );
		}

		$what = implode( ', ', array_map( function ( $g ) { return $g[1] . ' ' . $g[0]->get_name(); }, $going ) );
		$note = trim( $what . ( ! empty( $args['collected_by'] ) ? ' · collected by ' . $args['collected_by'] : '' ) );

		if ( $left > 0 ) {
			// Part of it has gone; the order waits at the store for the rest.
			$order->update_meta_data( '_ah_part_released', 'yes' );
			$order->add_order_note( 'Part delivered: ' . $what );
			$order->save();
			self::log_event( $order->get_id(), 'store', 'part_released', 'payment_verified', 'payment_verified', $user_id, $note . " · {$left} still to deliver" );
			return AH_Shape::order( $order, true );
		}

		// Everything has gone. The stock was taken line by line above, so
		// WooCommerce is told not to take it again.
		$order->update_meta_data( '_order_stock_reduced', 'yes' );
		$order->set_status( 'completed', 'Goods released by the store.' );
		$order->save();

		self::after_move( $order, 'store', 'released', 'payment_verified', 'released', $user_id, $note );

		return AH_Shape::order( $order, true );
	}

	// -----------------------------------------------------------------
	// 4. Cancelling
	// -----------------------------------------------------------------

	public static function cancel_order( $order_id, $reason, $user_id ) {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return new WP_Error( 'ah_not_found', 'Order not found', array( 'status' => 404 ) );
		}

		$status = AH_Statuses::to_api( $order->get_status() );
		if ( in_array( $status, array( 'released', 'cancelled', 'refunded' ), true ) ) {
			return new WP_Error(
				'ah_too_late',
				'This order has already been completed. Raise a refund instead.',
				array( 'status' => 409 )
			);
		}

		// Once money has been taken, cancelling is the manager's call and
		// needs a reason: a paid order quietly cancelled is the oldest way
		// for takings to go missing.
		if ( ! in_array( $status, array( 'pending_payment', 'rejected' ), true ) ) {
			$who = get_user_by( 'id', (int) $user_id );
			if ( ! $who || 'manager' !== AH_Roles::desk_of( $who ) ) {
				return new WP_Error( 'ah_paid_order', 'This order is paid. Only the manager can cancel it.', array( 'status' => 403 ) );
			}
			if ( mb_strlen( trim( (string) $reason ) ) < 5 ) {
				return new WP_Error( 'ah_need_reason', 'Say why a paid order is being cancelled, and how the money goes back.', array( 'status' => 400 ) );
			}
		}

		// Goods that have left cannot be cancelled back onto the shelf.
		if ( 'yes' === $order->get_meta( '_ah_part_released' ) ) {
			return new WP_Error( 'ah_part_released', 'Some of this order has already been delivered. Deliver the rest, or raise a refund for what is not wanted.', array( 'status' => 409 ) );
		}

		$order->update_meta_data( '_ah_cancel_reason', $reason ? sanitize_text_field( $reason ) : null );
		$order->set_status( 'cancelled', $reason ? $reason : 'Cancelled.' );
		$order->save();

		self::after_move( $order, 'manager', 'cancelled', $status, 'cancelled', $user_id, $reason );
		return AH_Shape::order( $order, true );
	}

	// -----------------------------------------------------------------
	// The queues each desk looks at
	// -----------------------------------------------------------------

	/**
	 * Which order statuses sit at which desk.
	 *
	 * Public, because counting what is at a desk and listing it are two
	 * different jobs and only one of them should be loading orders.
	 */
	public static function stages() {
		return array(
			'cashier'  => array( 'wc-pending', 'wc-ah-rejected' ),
			'accounts' => array( 'wc-ah-paid' ),
			'store'    => array( 'wc-ah-verified' ),
			'done'     => array( 'wc-completed' ),
		);
	}

	public static function queue_for( $stage, $limit = 100 ) {
		$by_stage = self::stages();
		if ( ! isset( $by_stage[ $stage ] ) ) {
			return array();
		}

		$orders = wc_get_orders(
			array(
				'status'  => $by_stage[ $stage ],
				'limit'   => $limit,
				'orderby' => 'date',
				'order'   => 'ASC', // oldest first: a queue, not a stack
			)
		);

		return array_map(
			function ( $o ) {
				return AH_Shape::order( $o );
			},
			$orders
		);
	}

	// -----------------------------------------------------------------
	// Receipts, the audit trail, and the plumbing
	// -----------------------------------------------------------------

	/** R-00843 — one series, never reused, however many tills there are. */
	public static function next_receipt_no() {
		// An option update is atomic enough here: WordPress writes it in
		// one query, and two cashiers pressing at the same instant get
		// different numbers because each re-reads before writing.
		global $wpdb;
		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$wpdb->options} (option_name, option_value, autoload)
				 VALUES (%s, %d, 'no')
				 ON DUPLICATE KEY UPDATE option_value = option_value + 1",
				'ah_receipt_counter',
				801
			)
		);
		wp_cache_delete( 'ah_receipt_counter', 'options' );
		$n = (int) get_option( 'ah_receipt_counter', 801 );
		return 'R-' . str_pad( $n, 5, '0', STR_PAD_LEFT );
	}

	public static function payment_for( $order_id ) {
		global $wpdb;
		$table = AH_Install::table( 'payments' );
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE order_id = %d ORDER BY id DESC LIMIT 1", $order_id ),
			ARRAY_A
		);
		if ( ! $row ) {
			return null;
		}
		foreach ( array( 'id', 'order_id', 'amount_due', 'amount_paid', 'verified' ) as $k ) {
			$row[ $k ] = (int) $row[ $k ];
		}
		return $row;
	}

	public static function events_for( $order_id ) {
		global $wpdb;
		$table = AH_Install::table( 'events' );
		return $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE order_id = %d ORDER BY id ASC", $order_id ),
			ARRAY_A
		);
	}

	public static function log_event( $order_id, $stage, $action, $from, $to, $user_id = null, $notes = null ) {
		global $wpdb;
		$user = $user_id ? get_user_by( 'id', $user_id ) : null;

		$wpdb->insert(
			AH_Install::table( 'events' ),
			array(
				'order_id'     => $order_id,
				'stage'        => $stage,
				'action'       => $action,
				'from_status'  => $from,
				'to_status'    => $to,
				'handled_by'   => $user_id,
				'handler_name' => $user ? $user->display_name : null,
				'notes'        => $notes,
				'created_at'   => current_time( 'mysql' ),
			)
		);
	}

	/** Audit trail, then tell the customer. Done once, in one place. */
	private static function after_move( $order, $stage, $action, $from, $to, $user_id, $notes = null ) {
		self::log_event( $order->get_id(), $stage, $action, $from, $to, $user_id, $notes );

		$phone = $order->get_billing_phone();
		if ( ! $phone ) {
			$phone = get_user_meta( $order->get_customer_id(), 'ah_phone', true );
		}
		$message = AH_Sms::status_message( $order, $to );
		if ( $phone && $message ) {
			AH_Sms::send( $phone, $message );
		}

		/**
		 * Fires after an order moves between desks.
		 *
		 * @param WC_Order $order
		 * @param string   $to    the new status, in the API's vocabulary
		 */
		do_action( 'ah_order_moved', $order, $to );
	}

	private static function money_label( $amount ) {
		return AH_Sms::option( 'currency', 'UGX' ) . ' ' . number_format( (int) $amount );
	}
}
