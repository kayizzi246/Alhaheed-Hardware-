<?php
/**
 * The books: who owes the shop, whom the shop owes, and the double-entry
 * journal behind both.
 *
 * The shop already keeps its money and stock in books of its own: the
 * cash book, the loan (credit) book, supplier bills and what was paid on
 * them, and the stock book. This class does not ask anyone to write a
 * second time. Each line in those books becomes exactly one balanced
 * journal entry here (debits equal credits, always), keyed by where it
 * came from, so the journal can be filled in at any time and never twice.
 *
 * Nothing in the journal is edited. If a source line is taken away (an
 * order deleted by the manager), its entry stays and a second entry turns
 * it around, so the trail shows both.
 *
 *   Credit sale        Dr Customers owe us      Cr Sales
 *   Loan payment       Dr Cash / MoMo / Bank    Cr Customers owe us
 *   Cash sale          Dr Cash / MoMo / Bank    Cr Sales
 *   Goods received     Dr Stock                 Cr Goods in, bill not yet in
 *   Supplier bill      Dr Goods in, no bill     Cr We owe suppliers
 *   Supplier payment   Dr We owe suppliers      Cr Cash / MoMo / Bank
 *   Goods sold         Dr Cost of goods sold    Cr Stock
 *   Expense paid       Dr Shop expenses         Cr Cash / MoMo / Bank
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Books {

	/** The chart of accounts, in the words the shop uses. */
	const ACCOUNTS = array(
		'1000' => array( 'Cash', 'asset' ),
		'1010' => array( 'Mobile money', 'asset' ),
		'1020' => array( 'Bank', 'asset' ),
		'1030' => array( 'Till floats', 'asset' ),
		'1100' => array( 'Customers owe us (receivable)', 'asset' ),
		'1200' => array( 'Staff advances', 'asset' ),
		'1300' => array( 'Stock', 'asset' ),
		'2000' => array( 'We owe suppliers (payable)', 'liability' ),
		'2010' => array( 'Goods in, bill not yet in', 'liability' ),
		'3000' => array( 'Opening balances', 'equity' ),
		'4000' => array( 'Sales', 'income' ),
		'4010' => array( 'Sales returns and corrections', 'income' ),
		'4800' => array( 'Other money in', 'income' ),
		'5000' => array( 'Cost of goods sold', 'expense' ),
		'5100' => array( 'Stock lost or found', 'expense' ),
		'6000' => array( 'Shop expenses', 'expense' ),
		'6100' => array( 'Salaries', 'expense' ),
		'6200' => array( 'Loans written off', 'expense' ),
		'6900' => array( 'Other money out', 'expense' ),
	);

	private static function t( $n ) {
		return AH_Install::table( $n );
	}

	private static function err( $code, $msg, $status = 400 ) {
		return new WP_Error( $code, $msg, array( 'status' => $status ) );
	}

	public static function seed_accounts() {
		global $wpdb;
		foreach ( self::ACCOUNTS as $code => list( $name, $type ) ) {
			$wpdb->replace( self::t( 'gl_accounts' ), array( 'code' => $code, 'name' => $name, 'type' => $type ) );
		}
	}

	/**
	 * Run $fn inside one database transaction: all of it is written, or
	 * none of it. Returns what $fn returns; a WP_Error rolls back.
	 */
	public static function atomic( callable $fn ) {
		global $wpdb;
		$wpdb->query( 'START TRANSACTION' );
		try {
			$out = $fn();
		} catch ( Throwable $e ) {
			$wpdb->query( 'ROLLBACK' );
			return self::err( 'ah_failed', 'That did not save. Nothing was written. Try again.', 500 );
		}
		$wpdb->query( is_wp_error( $out ) ? 'ROLLBACK' : 'COMMIT' );
		return $out;
	}

	public static function routes() {
		$ns      = AH_Rest::NS;
		$get     = WP_REST_Server::READABLE;
		$manager = AH_Rest::desk( array( 'manager' ) );
		$r       = function ( $path, $cb ) use ( $ns, $get, $manager ) {
			register_rest_route( $ns, $path, array( 'methods' => $get, 'permission_callback' => $manager, 'callback' => array( __CLASS__, $cb ) ) );
		};
		$r( '/manager/books', 'dashboard' );
		$r( '/manager/books/report', 'report' );
		$r( '/manager/books/journal', 'journal' );
		$r( '/manager/books/trial-balance', 'trial_balance' );
		$r( '/manager/books/supplier', 'supplier_statement' );
	}

	// -----------------------------------------------------------------
	// The journal
	// -----------------------------------------------------------------

	/** Which money account a payment method lands in. */
	public static function money_account( $method ) {
		switch ( (string) $method ) {
			case 'mobile_money':
			case 'mtn_momo':
			case 'airtel_money':
				return '1010';
			case 'bank':
			case 'cheque':
			case 'card':
				return '1020';
			default:
				return '1000';
		}
	}

	/**
	 * Write one entry. $lines: [account, debit, credit]. Refused unless
	 * the debits equal the credits. A zero entry is still written, so the
	 * source line is known to be done.
	 */
	private static function post( $source, $source_id, $date, $memo, $user, $lines ) {
		global $wpdb;
		$dr = 0;
		$cr = 0;
		$keep = array();
		foreach ( $lines as list( $acc, $d, $c ) ) {
			$d = (int) round( $d );
			$c = (int) round( $c );
			// A negative side is the other side.
			if ( $d < 0 ) { $c -= $d; $d = 0; }
			if ( $c < 0 ) { $d -= $c; $c = 0; }
			if ( ! $d && ! $c ) {
				continue;
			}
			$dr    += $d;
			$cr    += $c;
			$keep[] = array( $acc, $d, $c );
		}
		if ( $dr !== $cr ) {
			return false;
		}
		$ok = $wpdb->insert( self::t( 'journal' ), array(
			'entry_date' => $date ?: current_time( 'Y-m-d' ),
			'source'     => $source,
			'source_id'  => (int) $source_id,
			'memo'       => mb_substr( (string) $memo, 0, 250 ),
			'amount'     => $dr,
			'user_name'  => $user ?: null,
			'created_at' => current_time( 'mysql' ),
		) );
		if ( ! $ok ) {
			return false; // Already there (the unique key): nothing to do.
		}
		$id = (int) $wpdb->insert_id;
		foreach ( $keep as list( $acc, $d, $c ) ) {
			$wpdb->insert( self::t( 'journal_lines' ), array( 'journal_id' => $id, 'account' => $acc, 'debit' => $d, 'credit' => $c ) );
		}
		return $id;
	}

	/** Two-line entry: $amount from $cr to $dr (signs flip for negatives). */
	private static function pair( $source, $id, $date, $memo, $user, $dr, $cr, $amount ) {
		return self::post( $source, $id, $date, $memo, $user, array( array( $dr, $amount, 0 ), array( $cr, 0, $amount ) ) );
	}

	/**
	 * Bring the journal up to date with every book. Cheap when nothing is
	 * new: each source is read only where it has no entry yet.
	 */
	public static function sync() {
		global $wpdb;
		if ( ! get_option( 'ah_gl_seeded' ) ) {
			self::seed_accounts();
			update_option( 'ah_gl_seeded', 1 );
		}
		$j = self::t( 'journal' );
		$missing = function ( $table, $source, $cols ) use ( $wpdb, $j ) {
			return (array) $wpdb->get_results(
				"SELECT {$cols} FROM {$table} s LEFT JOIN {$j} j ON j.source = '{$source}' AND j.source_id = s.id WHERE j.id IS NULL ORDER BY s.id LIMIT 3000",
				ARRAY_A
			);
		};

		// Cash book: sales paid, money back, expenses, anything by hand.
		// Loan payments are in the cash book too, but they are written from
		// the loan book below, so they are skipped here.
		$exp = self::t( 'expenses' );
		$pay = self::t( 'payments' );
		foreach ( $missing( self::t( 'cash_book' ), 'cash', "s.*, (SELECT e.kind FROM {$exp} e WHERE e.cash_book_id = s.id LIMIT 1) AS ekind, (SELECT p.amount_due FROM {$pay} p WHERE p.id = s.payment_id) AS due" ) as $c ) {
			$money = self::money_account( $c['method'] );
			$in    = (int) $c['cash_in'];
			$out   = (int) $c['cash_out'];
			$memo  = (string) $c['details'];
			$who   = ( $u = get_user_by( 'id', (int) $c['recorded_by'] ) ) ? $u->display_name : '';
			if ( false !== strpos( $memo, 'Credit payment' ) && ! $c['payment_id'] ) {
				self::post( 'cash', $c['id'], $c['entry_date'], $memo . ' (in the loan book)', $who, array() );
				continue;
			}
			if ( $c['payment_id'] ) {
				// What was sold, not what was handed over: change went back.
				// (Older cash lines held the whole note handed over.)
				$due = null !== $c['due'] && 'cash' === $c['method'] ? (int) $c['due'] : 0;
				if ( $in ) {
					$amt = $due > 0 ? min( $in, $due ) : $in;
					self::pair( 'cash', $c['id'], $c['entry_date'], $memo, $who, $money, '4000', $amt );
				} else {
					$amt = $due > 0 ? min( $out, $due ) : $out;
					self::pair( 'cash', $c['id'], $c['entry_date'], $memo, $who, '4010', $money, $amt );
				}
				continue;
			}
			if ( $c['ekind'] ) {
				$acc = array( 'salary' => '6100', 'advance' => '1200', 'float' => '1030' )[ $c['ekind'] ] ?? '6000';
				self::pair( 'cash', $c['id'], $c['entry_date'], $memo, $who, $acc, $money, $out - $in );
				continue;
			}
			if ( $c['order_id'] ) {
				$in ? self::pair( 'cash', $c['id'], $c['entry_date'], $memo, $who, $money, '4000', $in )
					: self::pair( 'cash', $c['id'], $c['entry_date'], $memo, $who, '4010', $money, $out );
				continue;
			}
			$in ? self::pair( 'cash', $c['id'], $c['entry_date'], $memo, $who, $money, '4800', $in )
				: self::pair( 'cash', $c['id'], $c['entry_date'], $memo, $who, '6900', $money, $out );
		}

		// Loan book: plus is the customer owing more, minus is less.
		foreach ( $missing( self::t( 'credit_entries' ), 'loan', 's.*' ) as $e ) {
			$a    = (int) $e['amount'];
			$name = ( $u = get_user_by( 'id', (int) $e['customer_id'] ) ) ? $u->display_name : 'Customer #' . $e['customer_id'];
			$memo = sprintf( '%s · %s%s', AH_Credit::KINDS[ $e['kind'] ] ?? $e['kind'], $name, $e['receipt_no'] ? ' · ' . $e['receipt_no'] : '' );
			$other = array(
				'sale'       => '4000',
				'reversal'   => '4000',
				'payment'    => self::money_account( $e['method'] ),
				'opening'    => '3000',
				'writeoff'   => '6200',
				'adjustment' => '4010',
			)[ $e['kind'] ] ?? '4010';
			// $a > 0: Dr receivable, Cr other. $a < 0: the other way.
			self::pair( 'loan', $e['id'], $e['entry_date'], $memo, $e['user_name'], '1100', $other, $a );
		}

		// Supplier bills (and credit notes, which are negative).
		foreach ( $missing( self::t( 'supplier_bills' ), 'bill', 's.*' ) as $b ) {
			$memo = sprintf( '%s %s %s', 'bill' === $b['kind'] ? 'Bill from' : 'Credit note from', $b['supplier'], $b['invoice_no'] );
			self::pair( 'bill', $b['id'], $b['bill_date'], $memo, $b['created_name'], '2010', '2000', (int) $b['amount'] );
		}

		// Money paid to suppliers.
		$bills = self::t( 'supplier_bills' );
		foreach ( $missing( self::t( 'bill_payments' ), 'billpay', "s.*, (SELECT CONCAT(b.supplier, ' ', COALESCE(b.invoice_no,'')) FROM {$bills} b WHERE b.id = s.bill_id) AS what" ) as $p ) {
			self::pair( 'billpay', $p['id'], $p['paid_on'], 'Paid ' . $p['what'] . ( $p['ref'] ? ' · ' . $p['ref'] : '' ), $p['user_name'], '2000', self::money_account( $p['method'] ), (int) $p['amount'] );
		}

		// The stock book, at what each line cost. A product's very first
		// stock, however it was written (opening, the first count), is
		// where the books start, not stock found.
		$sm = self::t( 'stock_moves' );
		foreach ( $missing( $sm, 'stock', "s.id, s.product_id, s.kind, s.qty, s.unit_cost, s.supplier, s.ref, s.user_name, COALESCE(s.moved_on, DATE(s.created_at)) AS day, (SELECT COUNT(*) FROM {$sm} e WHERE e.product_id = s.product_id AND e.id < s.id AND e.qty <> 0) AS earlier" ) as $m ) {
			$value = (int) round( (float) $m['qty'] * (int) $m['unit_cost'] );
			$other = array(
				'opening'         => '3000',
				'received'        => '2010',
				'supplier_return' => '2010',
				'sold'            => '5000',
				'restored'        => '5000',
				'returned'        => '5000',
				'order_deleted'   => '5000',
			)[ $m['kind'] ] ?? '5100';
			if ( in_array( $m['kind'], array( 'count', 'correction' ), true ) && ! (int) $m['earlier'] && (float) $m['qty'] > 0 ) {
				$other = '3000';
			}
			$memo = sprintf( '%s · %s %s', AH_Stock::KINDS[ $m['kind'] ] ?? $m['kind'], AH_Stock::qty_text( abs( (float) $m['qty'] ) ), get_the_title( (int) $m['product_id'] ) );
			// Plus: stock goes up (Dr Stock). Minus: it goes down.
			self::pair( 'stock', $m['id'], $m['day'], $memo, $m['user_name'], '1300', $other, $value );
		}

		self::void_gone();
	}

	/**
	 * A source line that no longer exists (deleted by the manager) has its
	 * entry turned around by a second one. The first stays, marked.
	 */
	private static function void_gone() {
		global $wpdb;
		$j   = self::t( 'journal' );
		$map = array(
			'cash'    => self::t( 'cash_book' ),
			'loan'    => self::t( 'credit_entries' ),
			'bill'    => self::t( 'supplier_bills' ),
			'billpay' => self::t( 'bill_payments' ),
			'stock'   => self::t( 'stock_moves' ),
		);
		foreach ( $map as $source => $table ) {
			$gone = (array) $wpdb->get_results( "SELECT j.* FROM {$j} j LEFT JOIN {$table} s ON s.id = j.source_id WHERE j.source = '{$source}' AND j.voided = 0 AND s.id IS NULL", ARRAY_A );
			foreach ( $gone as $e ) {
				$lines = (array) $wpdb->get_results( $wpdb->prepare( 'SELECT account, debit, credit FROM ' . self::t( 'journal_lines' ) . ' WHERE journal_id = %d', $e['id'] ), ARRAY_A );
				$back  = array();
				foreach ( $lines as $l ) {
					$back[] = array( $l['account'], (int) $l['credit'], (int) $l['debit'] );
				}
				self::post( 'void', $e['id'], current_time( 'Y-m-d' ), 'Undone, the record was deleted: ' . $e['memo'], 'The books', $back );
				$wpdb->update( $j, array( 'voided' => 1 ), array( 'id' => $e['id'] ) );
			}
		}
	}

	/** Balance of each account up to a day (debit minus credit). */
	private static function balances( $to = null ) {
		global $wpdb;
		$j   = self::t( 'journal' );
		$l   = self::t( 'journal_lines' );
		$sql = "SELECT l.account, SUM(l.debit) d, SUM(l.credit) c FROM {$l} l JOIN {$j} j ON j.id = l.journal_id";
		if ( $to ) {
			$sql .= $wpdb->prepare( ' WHERE j.entry_date <= %s', $to );
		}
		$out = array();
		foreach ( (array) $wpdb->get_results( $sql . ' GROUP BY l.account', ARRAY_A ) as $r ) {
			$out[ $r['account'] ] = array( (int) $r['d'], (int) $r['c'] );
		}
		return $out;
	}

	public static function trial_balance( $req ) {
		self::sync();
		$to   = self::day( $req->get_param( 'to' ), current_time( 'Y-m-d' ) );
		$bal  = self::balances( $to );
		$rows = array();
		$td   = 0;
		$tc   = 0;
		foreach ( self::ACCOUNTS as $code => list( $name, $type ) ) {
			list( $d, $c ) = $bal[ $code ] ?? array( 0, 0 );
			$net   = $d - $c;
			$rows[] = array(
				'code'    => $code,
				'name'    => $name,
				'type'    => $type,
				'debit'   => $net > 0 ? $net : 0,
				'credit'  => $net < 0 ? -$net : 0,
			);
			$td += max( 0, $net );
			$tc += max( 0, -$net );
		}
		return array( 'to' => $to, 'accounts' => $rows, 'debit' => $td, 'credit' => $tc, 'balanced' => $td === $tc );
	}

	public static function journal( $req ) {
		global $wpdb;
		self::sync();
		$to   = self::day( $req->get_param( 'to' ), current_time( 'Y-m-d' ) );
		$from = self::day( $req->get_param( 'from' ), gmdate( 'Y-m-d', strtotime( $to ) - 6 * DAY_IN_SECONDS ) );
		$acc  = preg_replace( '/[^0-9]/', '', (string) $req->get_param( 'account' ) );
		$j    = self::t( 'journal' );
		$l    = self::t( 'journal_lines' );
		$sql  = $wpdb->prepare( "SELECT * FROM {$j} WHERE entry_date BETWEEN %s AND %s AND amount > 0", $from, $to );
		if ( $acc ) {
			$sql .= $wpdb->prepare( " AND id IN (SELECT journal_id FROM {$l} WHERE account = %s)", $acc );
		}
		$entries = (array) $wpdb->get_results( $sql . ' ORDER BY entry_date DESC, id DESC LIMIT 1000', ARRAY_A );
		$ids     = array_map( 'intval', wp_list_pluck( $entries, 'id' ) );
		$lines   = array();
		if ( $ids ) {
			foreach ( (array) $wpdb->get_results( "SELECT * FROM {$l} WHERE journal_id IN (" . implode( ',', $ids ) . ') ORDER BY debit DESC, id', ARRAY_A ) as $x ) {
				$lines[ (int) $x['journal_id'] ][] = array(
					'account' => $x['account'],
					'name'    => self::ACCOUNTS[ $x['account'] ][0] ?? $x['account'],
					'debit'   => (int) $x['debit'],
					'credit'  => (int) $x['credit'],
				);
			}
		}
		$out = array();
		foreach ( $entries as $e ) {
			$out[] = array(
				'id'     => (int) $e['id'],
				'date'   => $e['entry_date'],
				'source' => $e['source'],
				'memo'   => $e['memo'],
				'amount' => (int) $e['amount'],
				'by'     => (string) $e['user_name'],
				'voided' => (bool) $e['voided'],
				'lines'  => $lines[ (int) $e['id'] ] ?? array(),
			);
		}
		$accounts = array();
		foreach ( self::ACCOUNTS as $code => list( $name, $type ) ) {
			$accounts[] = array( 'code' => $code, 'name' => $name, 'type' => $type );
		}
		return array( 'from' => $from, 'to' => $to, 'entries' => $out, 'accounts' => $accounts );
	}

	// -----------------------------------------------------------------
	// Suppliers
	// -----------------------------------------------------------------

	/** Every supplier: billed, sent back, paid, owed, late, next due. */
	public static function creditors() {
		global $wpdb;
		$today = current_time( 'Y-m-d' );
		$bills = (array) $wpdb->get_results( 'SELECT * FROM ' . self::t( 'supplier_bills' ) . ' ORDER BY bill_date, id', ARRAY_A );
		$by    = array();
		foreach ( $bills as $b ) {
			$s = $b['supplier'];
			if ( ! isset( $by[ $s ] ) ) {
				$by[ $s ] = array( 'supplier' => $s, 'billed' => 0, 'credits' => 0, 'paid' => 0, 'owed' => 0, 'overdue' => 0, 'nextDue' => null, 'bills' => 0 );
			}
			if ( 'bill' === $b['kind'] ) {
				$left = (int) $b['amount'] - (int) $b['paid'];
				$by[ $s ]['billed'] += (int) $b['amount'];
				$by[ $s ]['paid']   += (int) $b['paid'];
				$by[ $s ]['bills']++;
				if ( $left > 0 && $b['due_date'] ) {
					if ( $b['due_date'] < $today ) {
						$by[ $s ]['overdue'] += $left;
					} elseif ( ! $by[ $s ]['nextDue'] || $b['due_date'] < $by[ $s ]['nextDue'] ) {
						$by[ $s ]['nextDue'] = $b['due_date'];
					}
				}
			} else {
				$by[ $s ]['credits'] += -(int) $b['amount'];
			}
		}
		foreach ( $by as &$x ) {
			$x['owed']   = $x['billed'] - $x['paid'] - $x['credits'];
			$x['status'] = self::status( $x['owed'], $x['paid'] + $x['credits'], $x['overdue'] );
		}
		unset( $x );
		usort( $by, function ( $a, $b ) { return $b['owed'] <=> $a['owed']; } );
		return array_values( $by );
	}

	/** Paid, Partly paid, Unpaid or Overdue: the same four words everywhere. */
	private static function status( $owed, $paid, $overdue ) {
		if ( $owed <= 0 ) {
			return 'paid';
		}
		if ( $overdue > 0 ) {
			return 'overdue';
		}
		return $paid > 0 ? 'part' : 'unpaid';
	}

	/** One supplier's statement: bills, credit notes and payments, with the balance after each. */
	public static function supplier_statement( $req ) {
		global $wpdb;
		$name = trim( sanitize_text_field( (string) $req->get_param( 'name' ) ) );
		if ( '' === $name ) {
			return self::err( 'ah_no_supplier', 'Choose a supplier' );
		}
		$b     = self::t( 'supplier_bills' );
		$p     = self::t( 'bill_payments' );
		$bills = (array) $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$b} WHERE supplier = %s", $name ), ARRAY_A );
		$lines = array();
		foreach ( $bills as $x ) {
			$lines[] = array(
				'date'   => $x['bill_date'],
				'what'   => 'bill' === $x['kind'] ? 'Bill' : 'Credit note (goods sent back)',
				'ref'    => (string) $x['invoice_no'],
				'due'    => $x['due_date'],
				'billed' => max( 0, (int) $x['amount'] ),
				'paid'   => max( 0, -(int) $x['amount'] ),
				'by'     => (string) $x['created_name'],
				'sort'   => $x['bill_date'] . $x['created_at'] . 'a',
			);
		}
		$pays = (array) $wpdb->get_results( $wpdb->prepare( "SELECT p.*, b.invoice_no FROM {$p} p JOIN {$b} b ON b.id = p.bill_id WHERE b.supplier = %s", $name ), ARRAY_A );
		foreach ( $pays as $x ) {
			$lines[] = array(
				'date'   => $x['paid_on'],
				'what'   => 'Payment · ' . self::method_label( $x['method'] ),
				'ref'    => trim( $x['invoice_no'] . ( $x['ref'] ? ' · ' . $x['ref'] : '' ) ),
				'due'    => null,
				'billed' => 0,
				'paid'   => (int) $x['amount'],
				'by'     => (string) $x['user_name'],
				'sort'   => $x['paid_on'] . $x['created_at'] . 'b',
			);
		}
		usort( $lines, function ( $a, $b ) { return strcmp( $a['sort'], $b['sort'] ); } );
		$bal = 0;
		foreach ( $lines as &$l ) {
			$bal       += $l['billed'] - $l['paid'];
			$l['balance'] = $bal;
			unset( $l['sort'] );
		}
		unset( $l );
		$one = null;
		foreach ( self::creditors() as $c ) {
			if ( $c['supplier'] === $name ) {
				$one = $c;
			}
		}
		return array( 'supplier' => $name, 'account' => $one, 'lines' => array_reverse( $lines ) );
	}

	// -----------------------------------------------------------------
	// The dashboard
	// -----------------------------------------------------------------

	public static function dashboard() {
		global $wpdb;
		self::sync();
		$today  = current_time( 'Y-m-d' );
		$soon   = gmdate( 'Y-m-d', current_time( 'timestamp' ) + 14 * DAY_IN_SECONDS );
		$ce     = self::t( 'credit_entries' );
		$credit = AH_Credit::overview();
		$debtors = array_values( array_filter( $credit['accounts'], function ( $a ) { return $a['owed'] > 0; } ) );
		$owe     = self::creditors();
		$sum     = function ( $sql ) use ( $wpdb ) {
			return (int) $wpdb->get_var( $sql );
		};

		$upcoming = (array) $wpdb->get_results( $wpdb->prepare(
			'SELECT id, supplier, invoice_no, bill_date, due_date, amount, paid FROM ' . self::t( 'supplier_bills' ) . " WHERE kind = 'bill' AND amount > paid AND due_date IS NOT NULL AND due_date <= %s ORDER BY due_date LIMIT 20",
			$soon
		), ARRAY_A );
		foreach ( $upcoming as &$u ) {
			$u = array(
				'id'       => (int) $u['id'],
				'supplier' => $u['supplier'],
				'invoice'  => (string) $u['invoice_no'],
				'due'      => $u['due_date'],
				'owed'     => (int) $u['amount'] - (int) $u['paid'],
				'late'     => $u['due_date'] < $today,
			);
		}
		unset( $u );

		$tb  = self::trial_balance( new WP_REST_Request() );
		$bal = self::balances();
		$net = function ( $code ) use ( $bal ) {
			return isset( $bal[ $code ] ) ? $bal[ $code ][0] - $bal[ $code ][1] : 0;
		};
		$receivable = array_sum( wp_list_pluck( $debtors, 'owed' ) );
		$advances   = array_sum( wp_list_pluck( $credit['accounts'], 'advance' ) );
		$payable    = array_sum( array_map( function ( $c ) { return max( 0, $c['owed'] ); }, $owe ) );

		return array(
			'today'   => array(
				'creditSales'      => $sum( $wpdb->prepare( "SELECT COALESCE(SUM(amount),0) FROM {$ce} WHERE kind = 'sale' AND entry_date = %s", $today ) ),
				'collections'      => $sum( $wpdb->prepare( "SELECT COALESCE(SUM(-amount),0) FROM {$ce} WHERE kind = 'payment' AND entry_date = %s", $today ) ),
				'supplierPayments' => $sum( $wpdb->prepare( 'SELECT COALESCE(SUM(amount),0) FROM ' . self::t( 'bill_payments' ) . ' WHERE paid_on = %s', $today ) ),
				'cashSales'        => $sum( $wpdb->prepare( 'SELECT COALESCE(SUM(LEAST(amount_paid, amount_due)),0) FROM ' . self::t( 'payments' ) . " WHERE method <> 'credit' AND verified <> -1 AND DATE(created_at) = %s", $today ) ),
				'supplierBills'    => $sum( $wpdb->prepare( 'SELECT COALESCE(SUM(amount),0) FROM ' . self::t( 'supplier_bills' ) . " WHERE kind = 'bill' AND bill_date = %s", $today ) ),
			),
			'receivable'  => $receivable,
			'advances'    => $advances,
			'payable'     => $payable,
			'overdueIn'   => array_sum( wp_list_pluck( $debtors, 'overdue' ) ),
			'overdueOut'  => array_sum( wp_list_pluck( $owe, 'overdue' ) ),
			'debtors'     => count( $debtors ),
			'creditors'   => count( array_filter( $owe, function ( $c ) { return $c['owed'] > 0; } ) ),
			'aging'       => $credit['summary']['aging'],
			'overdueCustomers' => array_slice( array_values( array_filter( $debtors, function ( $a ) { return $a['overdue'] > 0; } ) ), 0, 12 ),
			'topDebtors'  => array_slice( $debtors, 0, 8 ),
			'upcoming'    => $upcoming,
			'suppliers'   => array_slice( array_values( array_filter( $owe, function ( $c ) { return $c['owed'] > 0; } ) ), 0, 8 ),
			// The proof the books add up.
			'check'       => array(
				'balanced'        => $tb['balanced'],
				'debit'           => $tb['debit'],
				'credit'          => $tb['credit'],
				'receivableBooks' => $net( '1100' ),
				'receivableList'  => $receivable - $advances,
				'payableBooks'    => -$net( '2000' ),
				'payableList'     => array_sum( wp_list_pluck( $owe, 'owed' ) ),
				'cash'            => $net( '1000' ),
				'mobile'          => $net( '1010' ),
				'bank'            => $net( '1020' ),
				'stock'           => $net( '1300' ),
				'entries'         => (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . self::t( 'journal' ) . ' WHERE amount > 0' ),
			),
		);
	}

	// -----------------------------------------------------------------
	// Reports
	// -----------------------------------------------------------------

	/**
	 * One report, filtered. type: debtors | creditors | credit_sales |
	 * collections | supplier_bills | supplier_payments | overdue | summary.
	 * Filters: from, to, who (customer id or supplier name), status
	 * (paid | part | unpaid | overdue), period (day | week | month).
	 */
	public static function report( $req ) {
		global $wpdb;
		self::sync();
		$type   = sanitize_key( (string) $req->get_param( 'type' ) ) ?: 'debtors';
		$to     = self::day( $req->get_param( 'to' ), current_time( 'Y-m-d' ) );
		$from   = self::day( $req->get_param( 'from' ), current_time( 'Y-m' ) . '-01' );
		$who    = trim( sanitize_text_field( (string) $req->get_param( 'who' ) ) );
		$status = sanitize_key( (string) $req->get_param( 'status' ) );
		$today  = current_time( 'Y-m-d' );
		$ce     = self::t( 'credit_entries' );
		$rows   = array();

		switch ( $type ) {
			case 'debtors':
				foreach ( AH_Credit::overview()['accounts'] as $a ) {
					if ( $who && (int) $who !== $a['customerId'] ) {
						continue;
					}
					$paid = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(-amount),0) FROM {$ce} WHERE customer_id = %d AND kind = 'payment'", $a['customerId'] ) );
					$rows[] = array(
						'customer' => $a['name'], 'customerId' => $a['customerId'], 'phone' => $a['phone'],
						'limit' => $a['limit'], 'owed' => max( 0, $a['owed'] ), 'advance' => $a['advance'],
						'overdue' => $a['overdue'], 'nextDue' => $a['nextDue'], 'oldestDays' => $a['oldestDays'],
						'lastPaid' => $a['lastPayment'] ? $a['lastPayment']['date'] : null,
						'status' => self::status( $a['owed'], $paid, $a['overdue'] ),
					);
				}
				break;

			case 'creditors':
				foreach ( self::creditors() as $c ) {
					if ( $who && $who !== $c['supplier'] ) {
						continue;
					}
					$rows[] = $c;
				}
				break;

			case 'credit_sales':
				$list = (array) $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$ce} WHERE kind IN ('sale','reversal') AND entry_date BETWEEN %s AND %s ORDER BY entry_date, id", $from, $to ), ARRAY_A );
				$left = array();
				foreach ( array_unique( array_map( 'intval', wp_list_pluck( $list, 'customer_id' ) ) ) as $cid ) {
					foreach ( AH_Credit::open_bills( $cid ) as $b ) {
						$left[ $b['id'] ] = $b;
					}
				}
				foreach ( $list as $e ) {
					if ( $who && (int) $who !== (int) $e['customer_id'] ) {
						continue;
					}
					$a    = (int) $e['amount'];
					$open = $left[ (int) $e['id'] ] ?? null;
					$rest = 'sale' === $e['kind'] ? ( $open ? $open['left'] : 0 ) : 0;
					$o    = $e['order_id'] ? wc_get_order( (int) $e['order_id'] ) : null;
					$rows[] = array(
						'date' => $e['entry_date'], 'customer' => ( $u = get_user_by( 'id', (int) $e['customer_id'] ) ) ? $u->display_name : '#' . $e['customer_id'],
						'orderNo' => $o ? AH_Shape::order_no( $o ) : '', 'receipt' => (string) $e['receipt_no'],
						'kind' => 'sale' === $e['kind'] ? 'Sale' : 'Cancelled', 'amount' => $a,
						'paid' => 'sale' === $e['kind'] ? $a - $rest : 0, 'left' => $rest, 'due' => $e['due_on'],
						'by' => (string) $e['user_name'],
						'status' => 'sale' !== $e['kind'] ? 'paid' : self::status( $rest, $a - $rest, $rest > 0 && $e['due_on'] && $e['due_on'] < $today ? $rest : 0 ),
					);
				}
				break;

			case 'collections':
				$list = (array) $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$ce} WHERE kind = 'payment' AND entry_date BETWEEN %s AND %s ORDER BY entry_date, id", $from, $to ), ARRAY_A );
				foreach ( $list as $e ) {
					if ( $who && (int) $who !== (int) $e['customer_id'] ) {
						continue;
					}
					$rows[] = array(
						'date' => $e['entry_date'], 'receipt' => (string) $e['receipt_no'],
						'customer' => ( $u = get_user_by( 'id', (int) $e['customer_id'] ) ) ? $u->display_name : '#' . $e['customer_id'],
						'method' => self::method_label( $e['method'] ), 'ref' => (string) $e['ref'],
						'amount' => -(int) $e['amount'], 'by' => (string) $e['user_name'],
					);
				}
				break;

			case 'supplier_bills':
				$list = (array) $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'supplier_bills' ) . ' WHERE bill_date BETWEEN %s AND %s ORDER BY bill_date, id', $from, $to ), ARRAY_A );
				foreach ( $list as $b ) {
					if ( $who && $who !== $b['supplier'] ) {
						continue;
					}
					$owed = 'bill' === $b['kind'] ? (int) $b['amount'] - (int) $b['paid'] : 0;
					$rows[] = array(
						'date' => $b['bill_date'], 'supplier' => $b['supplier'], 'invoice' => (string) $b['invoice_no'],
						'kind' => 'bill' === $b['kind'] ? 'Bill' : 'Credit note', 'amount' => (int) $b['amount'],
						'paid' => (int) $b['paid'], 'left' => $owed, 'due' => $b['due_date'], 'by' => (string) $b['created_name'],
						'status' => 'bill' !== $b['kind'] ? 'paid' : self::status( $owed, (int) $b['paid'], $owed > 0 && $b['due_date'] && $b['due_date'] < $today ? $owed : 0 ),
					);
				}
				break;

			case 'supplier_payments':
				$p    = self::t( 'bill_payments' );
				$b    = self::t( 'supplier_bills' );
				$list = (array) $wpdb->get_results( $wpdb->prepare( "SELECT p.*, b.supplier, b.invoice_no FROM {$p} p JOIN {$b} b ON b.id = p.bill_id WHERE p.paid_on BETWEEN %s AND %s ORDER BY p.paid_on, p.id", $from, $to ), ARRAY_A );
				foreach ( $list as $x ) {
					if ( $who && $who !== $x['supplier'] ) {
						continue;
					}
					$rows[] = array(
						'date' => $x['paid_on'], 'supplier' => $x['supplier'], 'invoice' => (string) $x['invoice_no'],
						'method' => self::method_label( $x['method'] ), 'ref' => (string) $x['ref'],
						'amount' => (int) $x['amount'], 'by' => (string) $x['user_name'],
					);
				}
				break;

			case 'overdue':
				foreach ( AH_Credit::overview()['accounts'] as $a ) {
					if ( $a['overdue'] > 0 ) {
						$rows[] = array( 'side' => 'Customer owes us', 'name' => $a['name'], 'phone' => $a['phone'], 'overdue' => $a['overdue'], 'owed' => $a['owed'], 'days' => $a['oldestDays'] );
					}
				}
				$list = (array) $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'supplier_bills' ) . " WHERE kind = 'bill' AND amount > paid AND due_date < %s ORDER BY due_date", $today ), ARRAY_A );
				foreach ( $list as $b ) {
					$rows[] = array( 'side' => 'We owe supplier', 'name' => $b['supplier'] . ' · ' . $b['invoice_no'], 'phone' => '', 'overdue' => (int) $b['amount'] - (int) $b['paid'], 'owed' => (int) $b['amount'] - (int) $b['paid'], 'days' => (int) floor( ( strtotime( $today ) - strtotime( $b['due_date'] ) ) / DAY_IN_SECONDS ) );
				}
				break;

			case 'summary':
				$period = in_array( $req->get_param( 'period' ), array( 'day', 'week', 'month' ), true ) ? $req->get_param( 'period' ) : 'day';
				$key    = function ( $d ) use ( $period ) {
					if ( 'month' === $period ) {
						return substr( $d, 0, 7 );
					}
					if ( 'week' === $period ) {
						$t = strtotime( $d );
						return gmdate( 'Y-m-d', $t - ( (int) gmdate( 'N', $t ) - 1 ) * DAY_IN_SECONDS );
					}
					return $d;
				};
				$add = function ( $sql, $field ) use ( $wpdb, &$rows, $key ) {
					foreach ( (array) $wpdb->get_results( $sql, ARRAY_A ) as $r ) {
						$k = $key( $r['d'] );
						if ( ! isset( $rows[ $k ] ) ) {
							$rows[ $k ] = array( 'period' => $k, 'cashSales' => 0, 'creditSales' => 0, 'collections' => 0, 'supplierBills' => 0, 'supplierPayments' => 0, 'expenses' => 0 );
						}
						$rows[ $k ][ $field ] += (int) $r['v'];
					}
				};
				$add( $wpdb->prepare( 'SELECT DATE(created_at) d, SUM(LEAST(amount_paid, amount_due)) v FROM ' . self::t( 'payments' ) . " WHERE method <> 'credit' AND verified <> -1 AND DATE(created_at) BETWEEN %s AND %s GROUP BY d", $from, $to ), 'cashSales' );
				$add( $wpdb->prepare( "SELECT entry_date d, SUM(amount) v FROM {$ce} WHERE kind IN ('sale','reversal') AND entry_date BETWEEN %s AND %s GROUP BY d", $from, $to ), 'creditSales' );
				$add( $wpdb->prepare( "SELECT entry_date d, SUM(-amount) v FROM {$ce} WHERE kind = 'payment' AND entry_date BETWEEN %s AND %s GROUP BY d", $from, $to ), 'collections' );
				$add( $wpdb->prepare( 'SELECT bill_date d, SUM(amount) v FROM ' . self::t( 'supplier_bills' ) . ' WHERE bill_date BETWEEN %s AND %s GROUP BY d', $from, $to ), 'supplierBills' );
				$add( $wpdb->prepare( 'SELECT paid_on d, SUM(amount) v FROM ' . self::t( 'bill_payments' ) . ' WHERE paid_on BETWEEN %s AND %s GROUP BY d', $from, $to ), 'supplierPayments' );
				$add( $wpdb->prepare( 'SELECT c.entry_date d, SUM(c.cash_out - c.cash_in) v FROM ' . self::t( 'cash_book' ) . ' c JOIN ' . self::t( 'expenses' ) . ' e ON e.cash_book_id = c.id WHERE c.entry_date BETWEEN %s AND %s GROUP BY d', $from, $to ), 'expenses' );
				ksort( $rows );
				$rows = array_values( $rows );
				break;

			default:
				return self::err( 'ah_bad_report', 'Unknown report' );
		}

		if ( $status && 'all' !== $status ) {
			$rows = array_values( array_filter( $rows, function ( $r ) use ( $status ) {
				return ! isset( $r['status'] ) || $r['status'] === $status;
			} ) );
		}
		return array( 'type' => $type, 'from' => $from, 'to' => $to, 'rows' => $rows );
	}

	private static function method_label( $m ) {
		return array(
			'cash' => 'Cash', 'mobile_money' => 'Mobile Money', 'mtn_momo' => 'MTN MoMo', 'airtel_money' => 'Airtel Money',
			'bank' => 'Bank', 'cheque' => 'Cheque', 'card' => 'Card',
		)[ (string) $m ] ?? (string) $m;
	}

	private static function day( $v, $fallback ) {
		$v = (string) $v;
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) ? $v : $fallback;
	}
}
