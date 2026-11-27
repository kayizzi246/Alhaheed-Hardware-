<?php
/**
 * Buying from suppliers, start to finish.
 *
 *   Purchase order   what the shop asked a supplier for, at what price
 *   Receiving        what actually arrived against it, delivery by
 *                    delivery, each with its delivery note (FDN); part
 *                    deliveries leave the rest open
 *   Bill             the supplier's invoice, checked three ways: ordered,
 *                    received, billed. A bill for more than arrived is
 *                    flagged before anything is paid
 *   Payment          what has been paid against each bill
 *   Return           goods sent back, out of the stock book, with a
 *                    credit note against the supplier
 *
 * The manager does all of it. Every step is in the stock book or the
 * audit trail with who did it.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Purchasing {

	public static function routes() {
		$ns      = AH_Rest::NS;
		$manager = AH_Rest::desk( array( 'manager' ) );
		$get     = WP_REST_Server::READABLE;
		$post    = WP_REST_Server::CREATABLE;
		$route   = function ( $path, $methods, $cb ) use ( $ns, $manager ) {
			register_rest_route( $ns, $path, array(
				'methods'             => $methods,
				'permission_callback' => $manager,
				'callback'            => array( __CLASS__, $cb ),
			) );
		};
		$route( '/manager/purchasing', $get, 'overview' );
		$route( '/manager/purchase-orders', $post, 'create_po' );
		$route( '/manager/purchase-orders/(?P<id>\d+)', $get, 'show_po' );
		$route( '/manager/purchase-orders/(?P<id>\d+)/receive', $post, 'receive' );
		$route( '/manager/purchase-orders/(?P<id>\d+)/close', $post, 'close_po' );
		$route( '/manager/supplier-bills', $post, 'add_bill' );
		$route( '/manager/supplier-bills/(?P<id>\d+)/pay', $post, 'pay_bill' );
		$route( '/manager/purchase-orders/(?P<id>\d+)/delete', $post, 'delete_po' );
		$route( '/manager/supplier-bills/(?P<id>\d+)/delete', $post, 'delete_bill' );
		$route( '/manager/supplier-returns', $post, 'return_goods' );
	}

	private static function t( $n ) {
		return AH_Install::table( $n );
	}

	private static function err( $code, $msg, $status = 400 ) {
		return new WP_Error( $code, $msg, array( 'status' => $status ) );
	}

	private static function date_ok( $d ) {
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $d ) && $d <= current_time( 'Y-m-d' );
	}

	private static function audit( $action, $note ) {
		$u = AH_Auth::current();
		AH_Flow::log_event( 0, 'manager', $action, null, null, $u ? $u->ID : null, $note );
	}

	// -----------------------------------------------------------------
	// Purchase orders
	// -----------------------------------------------------------------

	public static function create_po( $req ) {
		global $wpdb;
		$supplier = trim( sanitize_text_field( (string) $req->get_param( 'supplier' ) ) );
		if ( '' === $supplier ) {
			return self::err( 'ah_no_supplier', 'Choose the supplier' );
		}
		$lines = array();
		foreach ( (array) $req->get_param( 'lines' ) as $l ) {
			$pid  = (int) ( $l['productId'] ?? 0 );
			$qty  = (float) ( $l['qty'] ?? 0 );
			$cost = (int) ( $l['unitCost'] ?? 0 );
			$p    = $pid ? wc_get_product( $pid ) : null;
			if ( ! $p ) {
				return self::err( 'ah_bad_product', 'One of the lines has no product' );
			}
			if ( $qty <= 0 || $cost < 1 ) {
				return self::err( 'ah_bad_line', sprintf( 'Enter how many %s and the agreed price', $p->get_name() ) );
			}
			$lines[] = array( $p, $qty, $cost );
		}
		if ( ! $lines ) {
			return self::err( 'ah_no_lines', 'Add at least one item to the order' );
		}
		$expected = (string) $req->get_param( 'expectedOn' );
		$user     = AH_Auth::current();
		$wpdb->insert( self::t( 'purchase_orders' ), array(
			'po_no'        => 'TMP-' . wp_generate_password( 8, false ),
			'supplier'     => $supplier,
			'status'       => 'open',
			'expected_on'  => preg_match( '/^\d{4}-\d{2}-\d{2}$/', $expected ) ? $expected : null,
			'note'         => trim( sanitize_textarea_field( (string) $req->get_param( 'note' ) ) ),
			'created_by'   => (int) $user->ID,
			'created_name' => $user->display_name,
			'created_at'   => current_time( 'mysql' ),
		) );
		$id = (int) $wpdb->insert_id;
		$no = sprintf( 'PO-%05d', $id );
		$wpdb->update( self::t( 'purchase_orders' ), array( 'po_no' => $no ), array( 'id' => $id ) );
		foreach ( $lines as list( $p, $qty, $cost ) ) {
			$wpdb->insert( self::t( 'po_lines' ), array(
				'po_id'        => $id,
				'product_id'   => $p->get_id(),
				'product_name' => $p->get_name(),
				'qty_ordered'  => $qty,
				'unit_cost'    => $cost,
			) );
			// The item now belongs to this supplier, so the next order to
			// them lists it by itself.
			if ( ! get_post_meta( $p->get_id(), '_ah_supplier', true ) ) {
				update_post_meta( $p->get_id(), '_ah_supplier', $supplier );
			}
		}
		self::audit( 'po_created', sprintf( '%s to %s, %d lines', $no, $supplier, count( $lines ) ) );
		return self::show_po( array( 'id' => $id ) );
	}

	private static function po( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'purchase_orders' ) . ' WHERE id = %d', $id ), ARRAY_A );
	}

	private static function po_lines( $id ) {
		global $wpdb;
		return (array) $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'po_lines' ) . ' WHERE po_id = %d ORDER BY id', $id ), ARRAY_A );
	}

	/** A purchase order with its lines, deliveries, bills and the three-way check. */
	private static function shape_po( $h ) {
		global $wpdb;
		$lines    = self::po_lines( (int) $h['id'] );
		$ordered  = 0;
		$received = 0;
		$out      = array();
		foreach ( $lines as $l ) {
			$ordered  += (int) $l['qty_ordered'] * (int) $l['unit_cost'];
			$received += (int) $l['qty_received'] * (int) $l['unit_cost'];
			$out[]     = array(
				'id'          => (int) $l['id'],
				'productId'   => (int) $l['product_id'],
				'name'        => $l['product_name'],
				'unit'        => get_post_meta( (int) $l['product_id'], '_ah_unit', true ) ?: 'pc',
				'ordered'     => (float) $l['qty_ordered'],
				'received'    => (float) $l['qty_received'],
				'outstanding' => max( 0, (float) $l['qty_ordered'] - (float) $l['qty_received'] ),
				'unitCost'    => (int) $l['unit_cost'],
			);
		}
		$billed = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(amount),0) FROM ' . self::t( 'supplier_bills' ) . " WHERE po_id = %d AND kind = 'bill'", $h['id'] ) );
		return array(
			'id'          => (int) $h['id'],
			'poNo'        => $h['po_no'],
			'supplier'    => $h['supplier'],
			'status'      => $h['status'],
			'expectedOn'  => $h['expected_on'],
			'note'        => (string) $h['note'],
			'createdBy'   => (string) $h['created_name'],
			'createdAt'   => $h['created_at'],
			'lines'       => $out,
			'ordered'     => $ordered,
			'received'    => $received,
			'billed'      => $billed,
			'match'       => AH_Stock_Math::three_way( $ordered, $received, $billed ),
		);
	}

	public static function show_po( $req ) {
		global $wpdb;
		$h = self::po( (int) $req['id'] );
		if ( ! $h ) {
			return self::err( 'ah_not_found', 'That purchase order was not found', 404 );
		}
		$po         = self::shape_po( $h );
		$po['deliveries'] = (array) $wpdb->get_results( $wpdb->prepare(
			'SELECT m.id, m.product_id, m.qty, m.unit_cost, m.ref, m.user_name, COALESCE(m.moved_on, DATE(m.created_at)) AS day
			   FROM ' . self::t( 'stock_moves' ) . " m WHERE m.po_id = %d AND m.kind = 'received' ORDER BY m.id",
			$h['id']
		), ARRAY_A );
		foreach ( $po['deliveries'] as &$d ) {
			$d['name'] = get_the_title( (int) $d['product_id'] );
		}
		unset( $d );
		$po['bills'] = self::bills( array( 'po_id' => (int) $h['id'] ) );
		return array( 'po' => $po );
	}

	/**
	 * Goods in against a purchase order. Only what is still outstanding
	 * can be received, and every delivery carries its FDN and date.
	 */
	public static function receive( $req ) {
		global $wpdb;
		$h = self::po( (int) $req['id'] );
		if ( ! $h ) {
			return self::err( 'ah_not_found', 'That purchase order was not found', 404 );
		}
		if ( ! in_array( $h['status'], array( 'open', 'partial' ), true ) ) {
			return self::err( 'ah_po_closed', 'This purchase order is closed' );
		}
		$fdn  = trim( sanitize_text_field( (string) $req->get_param( 'fdn' ) ) );
		$date = (string) $req->get_param( 'date' );
		if ( '' === $fdn ) {
			return self::err( 'ah_no_fdn', 'Enter the delivery note (FDN) number' );
		}
		if ( ! self::date_ok( $date ) ) {
			return self::err( 'ah_bad_date', 'Enter the delivery date. It cannot be in the future.' );
		}
		$by   = array();
		foreach ( self::po_lines( (int) $h['id'] ) as $l ) {
			$by[ (int) $l['id'] ] = $l;
		}
		$todo = array();
		foreach ( (array) $req->get_param( 'lines' ) as $l ) {
			$lid = (int) ( $l['lineId'] ?? 0 );
			$qty = (float) ( $l['qty'] ?? 0 );
			if ( ! $qty ) {
				continue;
			}
			if ( ! isset( $by[ $lid ] ) ) {
				return self::err( 'ah_bad_line', 'That line is not on this purchase order' );
			}
			$open = (float) $by[ $lid ]['qty_ordered'] - (float) $by[ $lid ]['qty_received'];
			if ( $qty < 0 || $qty > $open ) {
				return self::err( 'ah_too_many', sprintf( 'Only %d %s are still to come on this order. More than that is a new order.', $open, $by[ $lid ]['product_name'] ) );
			}
			$todo[] = array( $by[ $lid ], $qty );
		}
		if ( ! $todo ) {
			return self::err( 'ah_nothing', 'Enter how many of each item arrived' );
		}
		foreach ( $todo as list( $l, $qty ) ) {
			$product = wc_get_product( (int) $l['product_id'] );
			if ( ! $product ) {
				continue;
			}
			$cost = (int) $l['unit_cost'];
			AH_Stock::blend_cost( $product->get_id(), $qty, $cost );
			update_post_meta( $product->get_id(), '_ah_cost', $cost );
			AH_Stock::adjust( $product, $qty, 'received', array(
				'unit_cost' => $cost,
				'supplier'  => $h['supplier'],
				'ref'       => $fdn,
				'moved_on'  => $date,
				'po_id'     => (int) $h['id'],
				'note'      => $h['po_no'],
			) );
			$wpdb->query( $wpdb->prepare( 'UPDATE ' . self::t( 'po_lines' ) . ' SET qty_received = qty_received + %f WHERE id = %d', $qty, $l['id'] ) );
		}
		$left = 0;
		foreach ( self::po_lines( (int) $h['id'] ) as $l ) {
			$left += max( 0, (float) $l['qty_ordered'] - (float) $l['qty_received'] );
		}
		$wpdb->update( self::t( 'purchase_orders' ), array(
			'status'    => $left ? 'partial' : 'received',
			'closed_at' => $left ? null : current_time( 'mysql' ),
		), array( 'id' => (int) $h['id'] ) );
		self::audit( 'po_received', sprintf( '%s: FDN %s, %d lines%s', $h['po_no'], $fdn, count( $todo ), $left ? ", {$left} still to come" : ', complete' ) );
		return self::show_po( array( 'id' => (int) $h['id'] ) );
	}

	/** Nothing more is coming: what was not delivered is not owed. */
	public static function close_po( $req ) {
		global $wpdb;
		$h = self::po( (int) $req['id'] );
		if ( ! $h ) {
			return self::err( 'ah_not_found', 'That purchase order was not found', 404 );
		}
		$got = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(qty_received),0) FROM ' . self::t( 'po_lines' ) . ' WHERE po_id = %d', $h['id'] ) );
		$wpdb->update( self::t( 'purchase_orders' ), array(
			'status'    => $got ? 'closed' : 'cancelled',
			'closed_at' => current_time( 'mysql' ),
		), array( 'id' => (int) $h['id'] ) );
		self::audit( $got ? 'po_closed' : 'po_cancelled', $h['po_no'] . ' · ' . trim( sanitize_text_field( (string) $req->get_param( 'reason' ) ) ) );
		return self::show_po( array( 'id' => (int) $h['id'] ) );
	}

	/**
	 * Delete a purchase order typed by mistake. Only while nothing has
	 * been received or billed on it: after that it is part of the books.
	 */
	public static function delete_po( $req ) {
		global $wpdb;
		$h = self::po( (int) $req['id'] );
		if ( ! $h ) {
			return self::err( 'ah_not_found', 'That purchase order was not found', 404 );
		}
		$got   = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(qty_received),0) FROM ' . self::t( 'po_lines' ) . ' WHERE po_id = %d', $h['id'] ) );
		$bills = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'supplier_bills' ) . ' WHERE po_id = %d', $h['id'] ) );
		if ( $got || $bills ) {
			return self::err( 'ah_po_used', 'Goods have been received or billed on this order, so it stays in the books. Use Close the order instead.', 409 );
		}
		$wpdb->delete( self::t( 'po_lines' ), array( 'po_id' => (int) $h['id'] ) );
		$wpdb->delete( self::t( 'purchase_orders' ), array( 'id' => (int) $h['id'] ) );
		self::audit( 'po_deleted', $h['po_no'] . ' to ' . $h['supplier'] );
		return array( 'ok' => true );
	}

	/** Delete a bill typed by mistake, only while nothing is paid on it. */
	public static function delete_bill( $req ) {
		global $wpdb;
		$b = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'supplier_bills' ) . ' WHERE id = %d', (int) $req['id'] ), ARRAY_A );
		if ( ! $b ) {
			return self::err( 'ah_not_found', 'That bill was not found', 404 );
		}
		if ( 'bill' !== $b['kind'] ) {
			return self::err( 'ah_credit', 'A credit note comes from goods sent back and stays with that return.', 409 );
		}
		if ( (int) $b['paid'] > 0 ) {
			return self::err( 'ah_bill_paid', 'Money has been paid on this bill, so it stays in the books.', 409 );
		}
		$wpdb->delete( self::t( 'supplier_bills' ), array( 'id' => (int) $b['id'] ) );
		self::audit( 'bill_deleted', sprintf( '%s invoice %s, UGX %s', $b['supplier'], $b['invoice_no'], number_format( (int) $b['amount'] ) ) );
		return array( 'ok' => true );
	}

	// -----------------------------------------------------------------
	// Bills, payments, returns
	// -----------------------------------------------------------------

	private static function bills( $where = array() ) {
		global $wpdb;
		$sql = 'SELECT * FROM ' . self::t( 'supplier_bills' ) . ' WHERE 1=1';
		if ( isset( $where['po_id'] ) ) {
			$sql .= $wpdb->prepare( ' AND po_id = %d', $where['po_id'] );
		}
		$rows = (array) $wpdb->get_results( $sql . ' ORDER BY bill_date DESC, id DESC', ARRAY_A );
		$po   = array();
		$out  = array();
		foreach ( $rows as $b ) {
			$pid  = (int) $b['po_id'];
			if ( $pid && ! isset( $po[ $pid ] ) ) {
				$h        = self::po( $pid );
				$po[ $pid ] = $h ? self::shape_po( $h ) : null;
			}
			$owed  = (int) $b['amount'] - (int) $b['paid'];
			$out[] = array(
				'id'        => (int) $b['id'],
				'kind'      => $b['kind'],
				'supplier'  => $b['supplier'],
				'poId'      => $pid ?: null,
				'poNo'      => $pid && $po[ $pid ] ? $po[ $pid ]['poNo'] : null,
				'invoiceNo' => (string) $b['invoice_no'],
				'date'      => $b['bill_date'],
				'dueDate'   => $b['due_date'],
				'amount'    => (int) $b['amount'],
				'paid'      => (int) $b['paid'],
				'owed'      => $owed,
				'status'    => $b['status'],
				'overdue'   => 'bill' === $b['kind'] && $owed > 0 && $b['due_date'] && $b['due_date'] < current_time( 'Y-m-d' ),
				'match'     => $pid && $po[ $pid ] ? $po[ $pid ]['match'] : null,
				'note'      => (string) $b['note'],
				'by'        => (string) $b['created_name'],
			);
		}
		return $out;
	}

	public static function add_bill( $req ) {
		global $wpdb;
		$supplier = trim( sanitize_text_field( (string) $req->get_param( 'supplier' ) ) );
		$po_id    = (int) $req->get_param( 'poId' );
		$amount   = (int) $req->get_param( 'amount' );
		$no       = trim( sanitize_text_field( (string) $req->get_param( 'invoiceNo' ) ) );
		$date     = (string) $req->get_param( 'billDate' );
		$due      = (string) $req->get_param( 'dueDate' );
		if ( $po_id ) {
			$h = self::po( $po_id );
			if ( ! $h ) {
				return self::err( 'ah_not_found', 'That purchase order was not found', 404 );
			}
			$supplier = $h['supplier'];
		}
		if ( '' === $supplier || '' === $no || $amount <= 0 ) {
			return self::err( 'ah_bill_incomplete', 'A bill needs the supplier, their invoice number and the amount' );
		}
		if ( ! self::date_ok( $date ) ) {
			return self::err( 'ah_bad_date', 'Enter the date on the invoice' );
		}
		$dupe = $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . self::t( 'supplier_bills' ) . " WHERE supplier = %s AND invoice_no = %s AND kind = 'bill'", $supplier, $no ) );
		if ( $dupe ) {
			return self::err( 'ah_bill_twice', sprintf( 'Invoice %s from %s is already recorded. The same invoice is never paid twice.', $no, $supplier ), 409 );
		}
		$user = AH_Auth::current();
		$wpdb->insert( self::t( 'supplier_bills' ), array(
			'kind'         => 'bill',
			'supplier'     => $supplier,
			'po_id'        => $po_id,
			'invoice_no'   => $no,
			'bill_date'    => $date,
			'due_date'     => preg_match( '/^\d{4}-\d{2}-\d{2}$/', $due ) ? $due : null,
			'amount'       => $amount,
			'status'       => 'unpaid',
			'note'         => trim( sanitize_textarea_field( (string) $req->get_param( 'note' ) ) ),
			'created_by'   => (int) $user->ID,
			'created_name' => $user->display_name,
			'created_at'   => current_time( 'mysql' ),
		) );
		self::audit( 'bill_added', sprintf( '%s invoice %s, UGX %s', $supplier, $no, number_format( $amount ) ) );
		$bills = self::bills( $po_id ? array( 'po_id' => $po_id ) : array() );
		return array( 'bill' => $bills ? $bills[0] : null );
	}

	public static function pay_bill( $req ) {
		global $wpdb;
		$b = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'supplier_bills' ) . ' WHERE id = %d', (int) $req['id'] ), ARRAY_A );
		if ( ! $b || 'bill' !== $b['kind'] ) {
			return self::err( 'ah_not_found', 'That bill was not found', 404 );
		}
		$amount = (int) $req->get_param( 'amount' );
		$owed   = (int) $b['amount'] - (int) $b['paid'];
		$method = sanitize_text_field( (string) $req->get_param( 'method' ) );
		$ref    = trim( sanitize_text_field( (string) $req->get_param( 'ref' ) ) );
		$date   = (string) $req->get_param( 'date' );
		if ( $amount <= 0 || $amount > $owed ) {
			return self::err( 'ah_bad_amount', sprintf( 'UGX %s is still owed on this bill', number_format( $owed ) ) );
		}
		if ( ! self::date_ok( $date ) ) {
			return self::err( 'ah_bad_date', 'Enter the date it was paid' );
		}
		if ( 'cash' !== $method && '' === $ref ) {
			return self::err( 'ah_no_ref', 'Enter the transaction or cheque number' );
		}
		// One transaction number pays once; the same amount on the same
		// bill twice in two minutes is a double tap.
		if ( '' !== $ref && $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . self::t( 'bill_payments' ) . " WHERE REPLACE(UPPER(ref), ' ', '') = %s LIMIT 1", strtoupper( str_replace( ' ', '', $ref ) ) ) ) ) {
			return self::err( 'ah_ref_used', sprintf( 'Payment %s is already recorded. The same payment is never entered twice.', $ref ), 409 );
		}
		if ( ! $req->get_param( 'again' ) && $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . self::t( 'bill_payments' ) . ' WHERE bill_id = %d AND amount = %d AND created_at >= %s LIMIT 1', $b['id'], $amount, gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - 120 ) ) ) ) {
			return new WP_Error( 'ah_paid_twice', sprintf( 'UGX %s on this bill was just recorded. If this is a second payment, tick "It is a second payment".', number_format( $amount ) ), array( 'status' => 409, 'canRepeat' => true ) );
		}
		$user = AH_Auth::current();
		$done = AH_Books::atomic( function () use ( $wpdb, $b, $amount, $method, $ref, $date, $user ) {
			$ok = $wpdb->insert( self::t( 'bill_payments' ), array(
				'bill_id'    => (int) $b['id'],
				'amount'     => $amount,
				'method'     => $method ?: 'cash',
				'ref'        => $ref,
				'paid_on'    => $date,
				'user_id'    => (int) $user->ID,
				'user_name'  => $user->display_name,
				'created_at' => current_time( 'mysql' ),
			) );
			// Paid from what is owed now, read inside the transaction.
			$ok = $ok && false !== $wpdb->query( $wpdb->prepare(
				'UPDATE ' . self::t( 'supplier_bills' ) . " SET paid = paid + %d, status = IF(paid >= amount, 'paid', 'part') WHERE id = %d AND paid + %d <= amount",
				$amount, $b['id'], $amount
			) ) && $wpdb->rows_affected;
			return $ok ? true : self::err( 'ah_failed', 'The payment did not save. Check what is still owed and try again.', 409 );
		} );
		if ( is_wp_error( $done ) ) {
			return $done;
		}
		self::audit( 'bill_paid', sprintf( '%s invoice %s: UGX %s by %s%s', $b['supplier'], $b['invoice_no'], number_format( $amount ), $method ?: 'cash', $ref ? " ({$ref})" : '' ) );
		return array( 'ok' => true );
	}

	/**
	 * Goods back to the supplier: out of the stock book, and a credit
	 * note so the shop is not billed for them.
	 */
	public static function return_goods( $req ) {
		global $wpdb;
		$pid      = (int) $req->get_param( 'productId' );
		$qty      = (float) $req->get_param( 'qty' );
		$supplier = trim( sanitize_text_field( (string) $req->get_param( 'supplier' ) ) );
		$ref      = trim( sanitize_text_field( (string) $req->get_param( 'ref' ) ) );
		$reason   = trim( sanitize_textarea_field( (string) $req->get_param( 'reason' ) ) );
		$date     = (string) $req->get_param( 'date' );
		$product  = $pid ? wc_get_product( $pid ) : null;
		if ( ! $product ) {
			return self::err( 'ah_bad_product', 'Choose the item going back' );
		}
		if ( $qty <= 0 || '' === $supplier || mb_strlen( $reason ) < 3 ) {
			return self::err( 'ah_return_incomplete', 'A return needs how many, the supplier and why it is going back' );
		}
		if ( ! self::date_ok( $date ) ) {
			return self::err( 'ah_bad_date', 'Enter the date it went back' );
		}
		$book = AH_Ledger::book( $pid );
		if ( $qty > $book ) {
			return self::err( 'ah_not_enough', sprintf( 'Only %d in the stock book to send back', $book ), 409 );
		}
		$cost = (int) $req->get_param( 'unitCost' ) ?: (int) get_post_meta( $pid, '_ah_cost', true );
		AH_Stock::adjust( $product, -$qty, 'supplier_return', array(
			'unit_cost' => $cost,
			'supplier'  => $supplier,
			'ref'       => $ref,
			'note'      => $reason,
			'moved_on'  => $date,
		) );
		$user = AH_Auth::current();
		$wpdb->insert( self::t( 'supplier_bills' ), array(
			'kind'         => 'credit',
			'supplier'     => $supplier,
			'invoice_no'   => $ref ?: 'Return',
			'bill_date'    => $date,
			'amount'       => -$qty * $cost,
			'status'       => 'open',
			'note'         => sprintf( '%d %s sent back: %s', $qty, $product->get_name(), $reason ),
			'created_by'   => (int) $user->ID,
			'created_name' => $user->display_name,
			'created_at'   => current_time( 'mysql' ),
		) );
		self::audit( 'supplier_return', sprintf( '%d %s back to %s: %s', $qty, $product->get_name(), $supplier, $reason ) );
		return array( 'ok' => true, 'credit' => $qty * $cost );
	}

	// -----------------------------------------------------------------
	// The whole picture
	// -----------------------------------------------------------------

	public static function overview() {
		global $wpdb;
		$pos = array();
		foreach ( (array) $wpdb->get_results( 'SELECT * FROM ' . self::t( 'purchase_orders' ) . ' ORDER BY id DESC LIMIT 300', ARRAY_A ) as $h ) {
			$pos[] = self::shape_po( $h );
		}
		$bills = self::bills();

		// What is owed, supplier by supplier.
		$by = array();
		foreach ( $bills as $b ) {
			$s = $b['supplier'];
			if ( ! isset( $by[ $s ] ) ) {
				$by[ $s ] = array( 'supplier' => $s, 'billed' => 0, 'credits' => 0, 'paid' => 0, 'owed' => 0, 'overdue' => 0 );
			}
			if ( 'bill' === $b['kind'] ) {
				$by[ $s ]['billed'] += $b['amount'];
				$by[ $s ]['paid']   += $b['paid'];
				if ( $b['overdue'] ) {
					$by[ $s ]['overdue'] += $b['owed'];
				}
			} else {
				$by[ $s ]['credits'] += -$b['amount'];
			}
		}
		foreach ( $by as &$x ) {
			$x['owed'] = $x['billed'] - $x['paid'] - $x['credits'];
		}
		unset( $x );
		usort( $by, function ( $a, $b ) { return $b['owed'] <=> $a['owed']; } );

		$returns = (array) $wpdb->get_results(
			'SELECT id, product_id, -qty AS qty, unit_cost, supplier, ref, note, user_name, COALESCE(moved_on, DATE(created_at)) AS day
			   FROM ' . self::t( 'stock_moves' ) . " WHERE kind = 'supplier_return' ORDER BY id DESC LIMIT 200",
			ARRAY_A
		);
		foreach ( $returns as &$r ) {
			$r['name'] = get_the_title( (int) $r['product_id'] );
		}
		unset( $r );

		// Received without a purchase order behind it: allowed, but shown.
		$loose = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . self::t( 'stock_moves' ) . " WHERE kind = 'received' AND po_id = 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)" );

		return array(
			'orders'        => $pos,
			'bills'         => $bills,
			'balances'      => array_values( $by ),
			'returns'       => $returns,
			'receivedNoPo'  => $loose,
			'suppliers'     => array_values( array_unique( array_filter( array_merge(
				(array) $wpdb->get_col( 'SELECT name FROM ' . AH_Install::table( 'suppliers' ) . ' WHERE active = 1 ORDER BY name' ),
				wp_list_pluck( $pos, 'supplier' )
			) ) ) ),
		);
	}
}
