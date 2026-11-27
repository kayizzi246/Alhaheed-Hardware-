<?php
/**
 * Documents a customer can keep: the order summary, a receipt for every
 * payment, and the loan statement. Real PDFs, drawn from the books.
 *
 * A receipt exists only for money that was recorded: a cashier's payment
 * that Accounts did not send back, or a payment in the loan book. A sale
 * put on loan is not a payment and gets no receipt; it is on the summary
 * and the statement.
 *
 * The phone opens documents in its browser, which carries no sign-in, so
 * the app first asks for a link. The link names one document for one
 * person and stops working after ten minutes. A customer only ever gets
 * links to their own; staff desks may open any.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Docs {

	const LIME  = array( 0.573, 0.816, 0.314 );
	const DARK  = array( 0.063, 0.129, 0.031 );
	const INK   = array( 0.06, 0.11, 0.2 );
	const SOFT  = array( 0.33, 0.39, 0.49 );
	const PALE  = array( 0.94, 0.97, 0.90 );
	const ZEBRA = array( 0.975, 0.98, 0.99 );
	const RED   = array( 0.75, 0.17, 0.17 );
	const GREEN = array( 0.05, 0.45, 0.27 );

	private static function err( $code, $msg, $status = 400 ) {
		return new WP_Error( $code, $msg, array( 'status' => $status ) );
	}

	public static function routes() {
		$ns = AH_Rest::NS;
		register_rest_route( $ns, '/orders/(?P<id>\d+)/documents', array( 'methods' => WP_REST_Server::READABLE, 'permission_callback' => array( 'AH_Rest', 'signed_in' ), 'callback' => array( __CLASS__, 'for_order' ) ) );
		register_rest_route( $ns, '/docs/link', array( 'methods' => WP_REST_Server::READABLE, 'permission_callback' => array( 'AH_Rest', 'signed_in' ), 'callback' => array( __CLASS__, 'link' ) ) );
		// Opened by the browser: the signed link is the permission.
		register_rest_route( $ns, '/docs/file', array( 'methods' => WP_REST_Server::READABLE, 'permission_callback' => '__return_true', 'callback' => array( __CLASS__, 'file' ) ) );
	}

	// -----------------------------------------------------------------
	// Who may see what
	// -----------------------------------------------------------------

	private static function staff( $user ) {
		return $user && ( AH_Roles::desk_of( $user ) || user_can( $user, 'manage_options' ) );
	}

	/** The customer a document belongs to, or an error. */
	private static function owner_of( $type, $id ) {
		global $wpdb;
		if ( 'order' === $type ) {
			$o = wc_get_order( (int) $id );
			return $o ? (int) $o->get_customer_id() : self::err( 'ah_not_found', 'Order not found', 404 );
		}
		if ( 'receipt' === $type ) {
			$r = self::receipt_row( (string) $id );
			return $r ? (int) $r['customer'] : self::err( 'ah_not_found', 'There is no recorded payment with that receipt number', 404 );
		}
		if ( 'statement' === $type ) {
			return get_user_by( 'id', (int) $id ) ? (int) $id : self::err( 'ah_not_found', 'Customer not found', 404 );
		}
		return self::err( 'ah_bad_doc', 'Unknown document' );
	}

	private static function allowed( $user, $type, $id ) {
		$owner = self::owner_of( $type, $id );
		if ( is_wp_error( $owner ) ) {
			return $owner;
		}
		if ( self::staff( $user ) || ( $owner && (int) $owner === (int) $user->ID ) ) {
			return true;
		}
		return self::err( 'ah_forbidden', 'You can only open your own documents', 403 );
	}

	/** What there is to download for one order. */
	public static function for_order( $req ) {
		global $wpdb;
		$me    = AH_Auth::current();
		$order = wc_get_order( (int) $req['id'] );
		if ( ! $order ) {
			return self::err( 'ah_not_found', 'Order not found', 404 );
		}
		$ok = self::allowed( $me, 'order', $order->get_id() );
		if ( is_wp_error( $ok ) ) {
			return $ok;
		}
		$receipts = array();
		foreach ( (array) $wpdb->get_results( $wpdb->prepare( 'SELECT receipt_no, amount_paid, amount_due, method, created_at FROM ' . AH_Install::table( 'payments' ) . " WHERE order_id = %d AND method <> 'credit' AND verified <> -1 ORDER BY id", $order->get_id() ), ARRAY_A ) as $p ) {
			$receipts[] = array( 'receiptNo' => $p['receipt_no'], 'amount' => min( (int) $p['amount_paid'], (int) $p['amount_due'] ) ?: (int) $p['amount_paid'], 'method' => $p['method'], 'date' => $p['created_at'], 'kind' => 'order' );
		}
		foreach ( (array) $wpdb->get_results( $wpdb->prepare( 'SELECT receipt_no, amount, method, created_at FROM ' . AH_Install::table( 'credit_entries' ) . " WHERE order_id = %d AND kind = 'payment' AND receipt_no IS NOT NULL ORDER BY id", $order->get_id() ), ARRAY_A ) as $p ) {
			$receipts[] = array( 'receiptNo' => $p['receipt_no'], 'amount' => -(int) $p['amount'], 'method' => $p['method'], 'date' => $p['created_at'], 'kind' => 'loan' );
		}
		$cid  = (int) $order->get_customer_id();
		$loan = $cid && ( AH_Credit::account( $cid ) || (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . AH_Install::table( 'credit_entries' ) . ' WHERE customer_id = %d', $cid ) ) );
		return array(
			'orderId'   => $order->get_id(),
			'receipts'  => $receipts,
			'statement' => $loan ? $cid : null,
		);
	}

	// -----------------------------------------------------------------
	// Signed links
	// -----------------------------------------------------------------

	private static function sign( $data ) {
		return hash_hmac( 'sha256', $data, wp_salt( 'auth' ) . 'ah-docs' );
	}

	public static function link( $req ) {
		$me   = AH_Auth::current();
		$type = sanitize_key( (string) $req->get_param( 'type' ) );
		$id   = sanitize_text_field( (string) $req->get_param( 'id' ) );
		// A customer's statement is always their own.
		if ( 'statement' === $type && ( '' === $id || ! self::staff( $me ) ) ) {
			$id = (string) $me->ID;
		}
		$ok = self::allowed( $me, $type, $id );
		if ( is_wp_error( $ok ) ) {
			return $ok;
		}
		$data  = rtrim( strtr( base64_encode( wp_json_encode( array( 't' => $type, 'i' => $id, 'u' => (int) $me->ID, 'e' => time() + 600 ) ) ), '+/', '-_' ), '=' );
		$token = $data . '.' . self::sign( $data );
		AH_Flow::log_event( 'order' === $type ? (int) $id : 0, self::staff( $me ) ? 'manager' : 'customer', 'document_opened', null, null, $me->ID, $type . ' ' . $id );
		return array( 'url' => rest_url( AH_Rest::NS . '/docs/file' ) . '?t=' . rawurlencode( $token ), 'expires' => 600 );
	}

	public static function file( $req ) {
		$token = (string) $req->get_param( 't' );
		$parts = explode( '.', $token );
		if ( 2 !== count( $parts ) || ! hash_equals( self::sign( $parts[0] ), $parts[1] ) ) {
			return self::err( 'ah_bad_link', 'This link is not valid. Open the document again from the app.', 403 );
		}
		$d = json_decode( base64_decode( strtr( $parts[0], '-_', '+/' ) ), true );
		if ( ! $d || time() > (int) $d['e'] ) {
			return self::err( 'ah_link_expired', 'This link has expired. Open the document again from the app.', 403 );
		}
		// Checked again: access could have changed since the link was made.
		$user = get_user_by( 'id', (int) $d['u'] );
		$ok   = $user ? self::allowed( $user, $d['t'], $d['i'] ) : self::err( 'ah_forbidden', 'Not allowed', 403 );
		if ( is_wp_error( $ok ) ) {
			return $ok;
		}
		switch ( $d['t'] ) {
			case 'order':
				list( $pdf, $name ) = self::order_summary( wc_get_order( (int) $d['i'] ) );
				break;
			case 'receipt':
				list( $pdf, $name ) = self::receipt( (string) $d['i'] );
				break;
			default:
				list( $pdf, $name ) = self::statement( (int) $d['i'] );
		}
		nocache_headers();
		header( 'Content-Type: application/pdf' );
		header( 'Content-Disposition: ' . ( $req->get_param( 'download' ) ? 'attachment' : 'inline' ) . '; filename="' . $name . '"' );
		header( 'Content-Length: ' . strlen( $pdf ) );
		echo $pdf; // phpcs:ignore WordPress.Security.EscapeOutput
		exit;
	}

	// -----------------------------------------------------------------
	// Drawing
	// -----------------------------------------------------------------

	private static function ugx( $n ) {
		return ( $n < 0 ? '-' : '' ) . 'UGX ' . number_format( abs( (int) $n ) );
	}

	private static function day( $d, $time = false ) {
		$t = strtotime( (string) $d );
		return $t ? gmdate( $time ? 'j M Y, H:i' : 'j M Y', $t ) : '';
	}

	/** "12 Nov 26", for narrow table columns. */
	private static function short( $d ) {
		$t = strtotime( (string) $d );
		return $t ? gmdate( 'j M y', $t ) : '';
	}

	private static function shop() {
		return AH_Sms::shop_name() ?: 'Al Hadeed Hardware';
	}

	private static function method( $m ) {
		return array( 'cash' => 'Cash', 'mobile_money' => 'Mobile Money', 'mtn_momo' => 'MTN Mobile Money', 'airtel_money' => 'Airtel Money', 'bank' => 'Bank', 'cheque' => 'Cheque', 'card' => 'Card', 'credit' => 'On loan' )[ (string) $m ] ?? (string) $m;
	}

	/** The top of every A4 page: the mark, the name, the title. */
	private static function head( AH_Pdf $p, $title, $number, $date ) {
		$p->rect( 0, 0, $p->w, 6, self::LIME );
		$p->rect( 40, 30, 38, 38, self::LIME );
		$p->text( 59, 54, 'AH', 15, true, self::DARK, 'center' );
		$p->text( 88, 46, strtoupper( self::shop() ), 15, true, self::INK );
		$p->text( 88, 62, 'Steel and hardware · Kampala, Uganda', 9, false, self::SOFT );
		$p->text( $p->w - 40, 44, $title, 13, true, self::INK, 'right' );
		$p->text( $p->w - 40, 58, $number, 9.5, false, self::SOFT, 'right' );
		$p->text( $p->w - 40, 70, $date, 9.5, false, self::SOFT, 'right' );
		$p->line( 40, 84, $p->w - 40, 84, self::LIME, 1.2 );
	}

	private static function foot( AH_Pdf $p, $note ) {
		$p->line( 40, $p->h - 44, $p->w - 40, $p->h - 44 );
		$p->text( 40, $p->h - 30, $note, 8, false, self::SOFT );
		$p->text( $p->w - 40, $p->h - 30, 'Page {page} of {pages}', 8, false, self::SOFT, 'right' );
	}

	/**
	 * A table that runs over pages. $cols: [title, width, align]. Each row
	 * is a list of cells; a cell may be [text, rgb, bold].
	 */
	private static function table( AH_Pdf $p, &$y, $cols, $rows, $title, $number, $date, $note ) {
		$x0   = 40;
		$draw = function () use ( $p, &$y, $cols, $x0 ) {
			$p->rect( $x0, $y, $p->w - 80, 20, self::PALE );
			$x = $x0 + 6;
			foreach ( $cols as $c ) {
				$p->text( 'right' === $c[2] ? $x + $c[1] - 12 : $x, $y + 13.5, $c[0], 8.5, true, self::DARK, $c[2] );
				$x += $c[1];
			}
			$y += 20;
		};
		$draw();
		foreach ( $rows as $n => $r ) {
			if ( $y > $p->h - 70 ) {
				self::foot( $p, $note );
				$p->add_page();
				self::head( $p, $title, $number, $date );
				$y = 100;
				$draw();
			}
			if ( $n % 2 ) {
				$p->rect( $x0, $y, $p->w - 80, 18, self::ZEBRA );
			}
			$x = $x0 + 6;
			foreach ( $cols as $i => $c ) {
				$cell = is_array( $r[ $i ] ) ? $r[ $i ] : array( $r[ $i ] );
				$txt  = AH_Pdf::fit( (string) $cell[0], 8, $c[1] - 12, ! empty( $cell[2] ) );
				$p->text( 'right' === $c[2] ? $x + $c[1] - 12 : $x, $y + 12.5, $txt, 8, ! empty( $cell[2] ), $cell[1] ?? self::INK, $c[2] );
				$x += $c[1];
			}
			$y += 18;
		}
		$p->line( $x0, $y, $p->w - 40, $y );
	}

	/** A label and a value, in a column. */
	private static function kv( AH_Pdf $p, $x, &$y, $k, $v, $w = 220 ) {
		$p->text( $x, $y, $k, 8, false, self::SOFT );
		$p->text( $x, $y + 12, AH_Pdf::fit( $v, 10, $w ), 10, true, self::INK );
		$y += 28;
	}

	// -----------------------------------------------------------------
	// 1. The order summary
	// -----------------------------------------------------------------

	private static function payment_status( $order ) {
		global $wpdb;
		$s = AH_Shape::order( $order, false );
		if ( ! empty( $s['on_credit'] ) ) {
			return (int) ( $s['paid_now'] ?? 0 ) > 0
				? sprintf( 'Part paid (%s), the rest on loan', self::ugx( $s['paid_now'] ) )
				: 'On loan';
		}
		$p = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . AH_Install::table( 'payments' ) . ' WHERE order_id = %d ORDER BY id DESC LIMIT 1', $order->get_id() ), ARRAY_A );
		if ( ! $p ) {
			return ( $s['credit_approval']['status'] ?? '' ) === 'pending' ? 'Not paid · loan waiting for approval' : 'Not paid';
		}
		if ( -1 === (int) $p['verified'] ) {
			return 'Payment sent back, not paid';
		}
		return 'Paid · ' . self::method( $p['method'] ) . ' · receipt ' . $p['receipt_no'];
	}

	public static function order_summary( $order ) {
		$s     = AH_Shape::order( $order, true );
		$no    = AH_Shape::order_no( $order );
		$title = 'ORDER SUMMARY';
		$date  = self::day( $s['created_at'] ?? $order->get_date_created(), true );
		$note  = self::shop() . ' · Order ' . $no . ' · printed ' . gmdate( 'j M Y H:i', current_time( 'timestamp' ) );
		$p     = new AH_Pdf( AH_Pdf::A4_W, AH_Pdf::A4_H, false, 'Order ' . $no );
		self::head( $p, $title, 'Order ' . $no, $date );

		$y = 104;
		$l = $y;
		self::kv( $p, 40, $l, 'CUSTOMER', $s['company_name'] ?: ( $s['ordered_by_name'] ?? trim( $order->get_formatted_billing_full_name() ) ) );
		self::kv( $p, 40, $l, 'PHONE', $s['ordered_by_phone'] ?? $order->get_billing_phone() );
		if ( ! empty( $s['delivery_address'] ) ) {
			self::kv( $p, 40, $l, 'DELIVER TO', $s['delivery_address'] );
		}
		$r = $y;
		self::kv( $p, 320, $r, 'ORDER STATUS', $s['status_label'] ?? '' );
		self::kv( $p, 320, $r, 'PAYMENT', self::payment_status( $order ), 235 );
		self::kv( $p, 320, $r, 'HOW IT GETS TO YOU', 'delivery' === ( $s['fulfilment'] ?? '' ) ? 'We deliver' : 'Collect from the shop' );
		$y = max( $l, $r ) + 6;

		$rows = array();
		$n    = 0;
		foreach ( (array) $s['items'] as $i ) {
			$rows[] = array( (string) ++$n, $i['product_name'], AH_Stock::qty_text( $i['quantity'] ) . ' ' . ( $i['unit'] ?? '' ), self::ugx( $i['unit_price'] ), array( self::ugx( $i['line_total'] ), self::INK, true ) );
		}
		self::table( $p, $y, array( array( '#', 26, 'left' ), array( 'ITEM', 245, 'left' ), array( 'QTY', 70, 'left' ), array( 'UNIT PRICE', 85, 'right' ), array( 'AMOUNT', 89, 'right' ) ), $rows, $title, 'Order ' . $no, $date, $note );

		// Totals.
		$y       += 14;
		$subtotal = AH_Shape::money( $order->get_subtotal() );
		$discount = AH_Shape::money( $order->get_discount_total() );
		$delivery = AH_Shape::money( $order->get_shipping_total() ) + AH_Shape::money( $order->get_total_fees() );
		$total    = AH_Shape::money( $order->get_total() );
		if ( $y > $p->h - 150 ) {
			self::foot( $p, $note );
			$p->add_page();
			self::head( $p, $title, 'Order ' . $no, $date );
			$y = 104;
		}
		$line = function ( $k, $v, $bold = false ) use ( $p, &$y ) {
			$p->text( 400, $y, $k, 9.5, $bold, $bold ? self::INK : self::SOFT );
			$p->text( $p->w - 46, $y, $v, 9.5, $bold, self::INK, 'right' );
			$y += 16;
		};
		$line( 'Subtotal', self::ugx( $subtotal ) );
		$line( 'Discount', $discount ? '-' . self::ugx( $discount ) : self::ugx( 0 ) );
		if ( $delivery ) {
			$line( 'Delivery', self::ugx( $delivery ) );
		}
		$p->rect( 390, $y - 4, $p->w - 430, 24, self::LIME );
		$p->text( 400, $y + 12, 'GRAND TOTAL', 10.5, true, self::DARK );
		$p->text( $p->w - 46, $y + 12, self::ugx( $total ), 11.5, true, self::DARK, 'right' );
		$y += 36;
		if ( ! empty( $s['on_credit'] ) ) {
			$p->text( 40, $y, 'This order is on the customer\'s loan. Payments on it are shown on the account statement.', 9, false, self::SOFT );
			$y += 14;
		}
		$p->text( 40, $y, 'Show the order number at the store to collect your goods. Thank you for buying from ' . self::shop() . '.', 9, false, self::SOFT );
		self::foot( $p, $note );
		return array( $p->output(), 'Order-' . $no . '.pdf' );
	}

	// -----------------------------------------------------------------
	// 2. A payment receipt
	// -----------------------------------------------------------------

	/** One recorded payment, from either book, or null. */
	private static function receipt_row( $no ) {
		global $wpdb;
		$p = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . AH_Install::table( 'payments' ) . " WHERE receipt_no = %s AND method <> 'credit' AND verified <> -1", $no ), ARRAY_A );
		if ( $p ) {
			$o = wc_get_order( (int) $p['order_id'] );
			if ( ! $o ) {
				return null;
			}
			$due  = (int) $p['amount_due'];
			$paid = min( (int) $p['amount_paid'], $due ) ?: (int) $p['amount_paid'];
			return array(
				'customer' => (int) $o->get_customer_id(),
				'name'     => $o->get_meta( '_ah_company_name' ) ?: trim( $o->get_formatted_billing_full_name() ),
				'phone'    => $o->get_billing_phone(),
				'order'    => AH_Shape::order_no( $o ),
				'when'     => $p['created_at'],
				'amount'   => $paid,
				'handed'   => (int) $p['amount_paid'],
				'method'   => $p['method'],
				'ref'      => (string) $p['transaction_ref'],
				'by'       => (string) $p['cashier_name'],
				'before'   => $due,
				'after'    => $due - $paid,
				'what'     => 'Payment for order ' . AH_Shape::order_no( $o ),
			);
		}
		$e = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . AH_Install::table( 'credit_entries' ) . " WHERE receipt_no = %s AND kind = 'payment'", $no ), ARRAY_A );
		if ( ! $e ) {
			return null;
		}
		$before = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(amount),0) FROM ' . AH_Install::table( 'credit_entries' ) . ' WHERE customer_id = %d AND id < %d', $e['customer_id'], $e['id'] ) );
		$u      = get_user_by( 'id', (int) $e['customer_id'] );
		$o      = $e['order_id'] ? wc_get_order( (int) $e['order_id'] ) : null;
		return array(
			'customer' => (int) $e['customer_id'],
			'name'     => $u ? $u->display_name : '',
			'phone'    => $u ? ( get_user_meta( $u->ID, 'ah_phone', true ) ?: get_user_meta( $u->ID, 'billing_phone', true ) ) : '',
			'order'    => $o ? AH_Shape::order_no( $o ) : '',
			'when'     => $e['created_at'],
			'amount'   => -(int) $e['amount'],
			'handed'   => -(int) $e['amount'],
			'method'   => $e['method'],
			'ref'      => (string) $e['ref'],
			'by'       => (string) $e['user_name'],
			'before'   => $before,
			'after'    => $before + (int) $e['amount'],
			'what'     => $o ? 'Paid on the loan, order ' . AH_Shape::order_no( $o ) : 'Payment on the loan account',
		);
	}

	public static function receipt( $no ) {
		$r = self::receipt_row( $no );
		$p = new AH_Pdf( AH_Pdf::ROLL, 2000, true, 'Receipt ' . $no );
		$w = AH_Pdf::ROLL;
		$c = $w / 2;
		$y = 22;
		$p->rect( $c - 15, $y, 30, 30, self::LIME );
		$p->text( $c, $y + 19.5, 'AH', 12, true, self::DARK, 'center' );
		$y += 46;
		$p->text( $c, $y, strtoupper( self::shop() ), 11, true, self::INK, 'center' );
		$y += 12;
		$p->text( $c, $y, 'Kampala, Uganda', 8, false, self::SOFT, 'center' );
		$y += 18;
		$p->text( $c, $y, 'PAYMENT RECEIPT', 10, true, self::INK, 'center' );
		$y += 10;
		$p->line( 12, $y, $w - 12, $y, self::SOFT, 0.6, true );
		$y += 16;
		$row = function ( $k, $v, $bold = false, $rgb = self::INK ) use ( $p, &$y, $w ) {
			$p->text( 12, $y, $k, 8, false, self::SOFT );
			$p->text( $w - 12, $y, AH_Pdf::fit( $v, $bold ? 9 : 8.5, 120, $bold ), $bold ? 9 : 8.5, $bold, $rgb, 'right' );
			$y += 14;
		};
		$row( 'Receipt no.', $no, true );
		if ( $r['order'] ) {
			$row( 'Order', $r['order'] );
		}
		$row( 'Date', self::day( $r['when'], true ) );
		$row( 'Customer', $r['name'] );
		if ( $r['phone'] ) {
			$row( 'Phone', $r['phone'] );
		}
		$y += 2;
		foreach ( AH_Pdf::wrap( $r['what'], 8, $w - 24 ) as $l ) {
			$p->text( 12, $y, $l, 8, false, self::SOFT );
			$y += 11;
		}
		$p->line( 12, $y, $w - 12, $y, self::SOFT, 0.6, true );
		$y += 16;
		$row( 'Owed before', self::ugx( max( 0, $r['before'] ) ) );
		$p->rect( 8, $y - 10, $w - 16, 24, self::LIME );
		$p->text( 14, $y + 5.5, 'AMOUNT PAID', 9, true, self::DARK );
		$p->text( $w - 14, $y + 5.5, self::ugx( $r['amount'] ), 11, true, self::DARK, 'right' );
		$y += 26;
		$row( 'Paid by', self::method( $r['method'] ) );
		if ( $r['ref'] ) {
			$row( 'Transaction ref', $r['ref'] );
		}
		if ( 'cash' === $r['method'] && $r['handed'] > $r['amount'] ) {
			$row( 'Cash given', self::ugx( $r['handed'] ) );
			$row( 'Change', self::ugx( $r['handed'] - $r['amount'] ) );
		}
		$row( $r['after'] < 0 ? 'Paid ahead' : 'Still owed', self::ugx( abs( $r['after'] ) ), true, $r['after'] > 0 ? self::RED : self::GREEN );
		$row( 'Received by', $r['by'] );
		$p->line( 12, $y, $w - 12, $y, self::SOFT, 0.6, true );
		$y += 16;
		$p->text( $c, $y, 'Thank you. Keep this receipt.', 8.5, true, self::INK, 'center' );
		$y += 12;
		$p->text( $c, $y, 'Printed ' . gmdate( 'j M Y H:i', current_time( 'timestamp' ) ), 7, false, self::SOFT, 'center' );
		return array( $p->output(), 'Receipt-' . $no . '.pdf' );
	}

	// -----------------------------------------------------------------
	// 3. The loan statement
	// -----------------------------------------------------------------

	public static function statement( $customer_id ) {
		$a     = AH_Credit::summary( $customer_id );
		$lines = array_reverse( AH_Credit::statement( $customer_id, 5000 ) );
		$bills = AH_Credit::open_bills( $customer_id );
		$today = current_time( 'Y-m-d' );
		$title = 'ACCOUNT STATEMENT';
		$num   = $a['name'];
		$date  = 'As at ' . self::day( $today );
		$note  = self::shop() . ' · Statement for ' . $a['name'] . ' · printed ' . gmdate( 'j M Y H:i', current_time( 'timestamp' ) );
		$p     = new AH_Pdf( AH_Pdf::A4_W, AH_Pdf::A4_H, false, 'Statement ' . $a['name'] );
		self::head( $p, $title, $num, $date );

		$opening = 0;
		$bought  = 0;
		$paid    = 0;
		foreach ( $lines as $l ) {
			if ( 'opening' === $l['kind'] ) {
				$opening += $l['debit'] - $l['credit'];
			} else {
				$bought += $l['debit'];
				$paid   += $l['credit'];
			}
		}
		$y = 104;
		$l = $y;
		self::kv( $p, 40, $l, 'CUSTOMER', $a['name'] );
		self::kv( $p, 40, $l, 'PHONE', $a['phone'] ?: '-' );
		$r = $y;
		self::kv( $p, 320, $r, 'LOAN LIMIT', self::ugx( $a['limit'] ) );
		self::kv( $p, 320, $r, 'DAYS TO PAY', $a['termsDays'] . ' days' );
		$y = max( $l, $r );

		// The figures in boxes.
		$boxes = array(
			array( 'Opening balance', self::ugx( $opening ), self::INK ),
			array( 'Bought on loan', self::ugx( $bought ), self::INK ),
			array( 'Payments made', self::ugx( $paid ), self::GREEN ),
			array( $a['owed'] < 0 ? 'Paid ahead' : 'Outstanding', self::ugx( abs( $a['owed'] ) ), self::INK ),
			array( 'Overdue', self::ugx( $a['overdue'] ), $a['overdue'] ? self::RED : self::GREEN ),
		);
		$bw = ( $p->w - 80 - 4 * 6 ) / 5;
		foreach ( $boxes as $i => $b ) {
			$x = 40 + $i * ( $bw + 6 );
			$p->rect( $x, $y, $bw, 40, 3 === $i ? self::LIME : self::PALE );
			$p->text( $x + 7, $y + 14, $b[0], 7.5, false, 3 === $i ? self::DARK : self::SOFT );
			$p->text( $x + 7, $y + 30, AH_Pdf::fit( $b[1], 10, $bw - 12, true ), 10, true, 3 === $i ? self::DARK : $b[2] );
		}
		$y += 56;

		$p->text( 40, $y, 'EVERY LINE', 9, true, self::INK );
		$y += 8;
		$rows = array();
		foreach ( $lines as $x ) {
			$rows[] = array(
				self::short( $x['date'] ),
				$x['what'] . ( $x['orderNo'] ? ' · ' . $x['orderNo'] : '' ) . ( $x['method'] ? ' · ' . self::method( $x['method'] ) : '' ),
				(string) ( $x['ref'] ?? '' ),
				$x['due'] && $x['debit'] ? self::short( $x['due'] ) : '',
				$x['debit'] ? self::ugx( $x['debit'] ) : '',
				$x['credit'] ? array( self::ugx( $x['credit'] ), self::GREEN ) : '',
				array( self::ugx( $x['balance'] ), self::INK, true ),
			);
		}
		if ( ! $rows ) {
			$rows[] = array( '', 'Nothing on this account yet', '', '', '', '', '' );
		}
		self::table( $p, $y, array(
			array( 'DATE', 56, 'left' ), array( 'DETAILS', 118, 'left' ), array( 'REF', 52, 'left' ), array( 'DUE', 54, 'left' ),
			array( 'BOUGHT', 78, 'right' ), array( 'PAID', 78, 'right' ), array( 'BALANCE', 79, 'right' ),
		), $rows, $title, $num, $date, $note );

		if ( $bills ) {
			$y += 20;
			if ( $y > $p->h - 140 ) {
				self::foot( $p, $note );
				$p->add_page();
				self::head( $p, $title, $num, $date );
				$y = 104;
			}
			$p->text( 40, $y, 'BILLS NOT YET PAID (OLDEST IS PAID FIRST)', 9, true, self::INK );
			$y += 8;
			$rows = array();
			foreach ( $bills as $b ) {
				$late   = $b['due'] < $today;
				$rows[] = array( self::day( $b['date'] ), (string) ( $b['ref'] ?? '' ), self::day( $b['due'] ), array( $late ? 'Overdue' : 'Not yet due', $late ? self::RED : self::GREEN, true ), array( self::ugx( $b['left'] ), self::INK, true ) );
			}
			self::table( $p, $y, array( array( 'BOUGHT ON', 100, 'left' ), array( 'RECEIPT', 110, 'left' ), array( 'PAY BY', 100, 'left' ), array( 'STATE', 105, 'left' ), array( 'LEFT TO PAY', 100, 'right' ) ), $rows, $title, $num, $date, $note );
		}
		$y += 22;
		if ( $y < $p->h - 60 ) {
			$p->text( 40, $y, 'Pay at the shop counter in cash, Mobile Money or bank. You get a receipt and an SMS for every payment.', 8.5, false, self::SOFT );
		}
		self::foot( $p, $note );
		return array( $p->output(), 'Statement-' . sanitize_file_name( $a['name'] ) . '-' . $today . '.pdf' );
	}
}
