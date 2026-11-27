<?php
/**
 * Selling on credit ("on account"), and getting the money in.
 *
 * How it works, the way hardware shops do it:
 *
 *   - Only the manager opens credit for a customer, and sets how much
 *     they may owe (the limit) and how many days they have to pay (the
 *     terms). He can stop it (hold) or close it at any time.
 *   - A sale on credit goes through the counter like any sale, but the
 *     cashier puts it "on account" instead of taking money. It adds to
 *     what the customer owes. No money goes in the cash book.
 *   - It is refused when the new total would pass the limit, when a bill
 *     is past its days, or when the account is on hold. The customer can
 *     pay something off first, or pay cash. Only the manager can let it
 *     through anyway, with a reason that is written down.
 *   - A payment on account takes off what is owed, oldest bill first,
 *     and goes in the cash book as money in, with a receipt.
 *   - Every line is kept: date, bill, what was added, what was paid, and
 *     the balance after, like the shop's own notebook.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Credit {

	const KINDS = array(
		'sale'       => 'Taken on loan',
		'payment'    => 'Payment',
		'opening'    => 'Balance brought forward',
		'adjustment' => 'Correction',
		'writeoff'   => 'Written off',
		'reversal'   => 'Sale cancelled',
	);

	private static function t( $name ) {
		return AH_Install::table( $name );
	}

	private static function err( $code, $message, $status = 400 ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}

	public static function init() {
		// A paid credit order that is cancelled comes off what is owed.
		add_action( 'ah_order_moved', array( __CLASS__, 'on_move' ), 10, 2 );
	}

	public static function routes() {
		$ns      = AH_Rest::NS;
		$get     = WP_REST_Server::READABLE;
		$post    = WP_REST_Server::CREATABLE;
		$manager = AH_Rest::desk( array( 'manager' ) );
		$desks   = AH_Rest::desk( array( 'cashier', 'accounts', 'manager' ) );

		// The manager's overview, and the day's cash and credit sales.
		register_rest_route( $ns, '/manager/credit', array( 'methods' => $get, 'permission_callback' => $manager, 'callback' => array( __CLASS__, 'overview' ) ) );
		register_rest_route( $ns, '/manager/credit/days', array( 'methods' => $get, 'permission_callback' => $manager, 'callback' => array( __CLASS__, 'days' ) ) );
		register_rest_route( $ns, '/manager/credit/sales-report', array( 'methods' => $get, 'permission_callback' => $manager, 'callback' => array( __CLASS__, 'sales_report' ) ) );
		// Take loan accounts away, with everything on them.
		register_rest_route( $ns, '/manager/credit/delete', array( 'methods' => $post, 'permission_callback' => $manager, 'callback' => array( __CLASS__, 'delete_accounts' ) ) );
		// Open or change an account; correct a balance.
		register_rest_route( $ns, '/manager/credit/(?P<id>\d+)', array( 'methods' => $post, 'permission_callback' => $manager, 'callback' => array( __CLASS__, 'save_account' ) ) );
		register_rest_route( $ns, '/manager/credit/(?P<id>\d+)/adjust', array( 'methods' => $post, 'permission_callback' => $manager, 'callback' => array( __CLASS__, 'adjust' ) ) );
		// The same list for the cashier and accounts, who take payments.
		register_rest_route( $ns, '/credit', array( 'methods' => $get, 'permission_callback' => $desks, 'callback' => array( __CLASS__, 'overview' ) ) );
		// One customer's account and statement; taking a payment on it.
		register_rest_route( $ns, '/credit/(?P<id>\d+)', array( 'methods' => $get, 'permission_callback' => $desks, 'callback' => array( __CLASS__, 'one' ) ) );
		register_rest_route( $ns, '/credit/(?P<id>\d+)/payment', array( 'methods' => $post, 'permission_callback' => AH_Rest::desk( array( 'cashier', 'manager' ) ), 'callback' => array( __CLASS__, 'pay' ) ) );
		// The customer's own account, in the app.
		register_rest_route( $ns, '/me/credit', array( 'methods' => $get, 'permission_callback' => array( 'AH_Rest', 'signed_in' ), 'callback' => array( __CLASS__, 'mine' ) ) );
	}

	// -----------------------------------------------------------------
	// Reading
	// -----------------------------------------------------------------

	public static function account( $customer_id ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'credit_accounts' ) . ' WHERE customer_id = %d', $customer_id ), ARRAY_A );
		return $row ?: null;
	}

	public static function balance( $customer_id ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(amount),0) FROM ' . self::t( 'credit_entries' ) . ' WHERE customer_id = %d', $customer_id ) );
	}

	/**
	 * What is still unpaid, bill by bill, after payments are taken off
	 * the oldest bills first. Each: amount left, date, due date.
	 */
	public static function open_bills( $customer_id ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare(
			'SELECT id, kind, amount, order_id, receipt_no, entry_date, due_on FROM ' . self::t( 'credit_entries' ) . ' WHERE customer_id = %d ORDER BY entry_date, id',
			$customer_id
		), ARRAY_A );
		// A cancelled sale takes off its own bill, not the oldest one.
		$undone = array();
		foreach ( (array) $rows as $r ) {
			if ( 'reversal' === $r['kind'] && (int) $r['order_id'] ) {
				$undone[ (int) $r['order_id'] ] = ( $undone[ (int) $r['order_id'] ] ?? 0 ) - (int) $r['amount'];
			}
		}
		$bills = array();
		$paid  = 0;
		foreach ( (array) $rows as $r ) {
			$a = (int) $r['amount'];
			if ( 'reversal' === $r['kind'] && (int) $r['order_id'] ) {
				continue;
			}
			if ( 'sale' === $r['kind'] && ! empty( $undone[ (int) $r['order_id'] ] ) ) {
				$take                            = min( $a, $undone[ (int) $r['order_id'] ] );
				$a                              -= $take;
				$undone[ (int) $r['order_id'] ] -= $take;
				if ( $a <= 0 ) {
					continue;
				}
			}
			if ( $a > 0 ) {
				$bills[] = array(
					'id'      => (int) $r['id'],
					'left'    => $a,
					'amount'  => $a,
					'date'    => $r['entry_date'],
					'due'     => $r['due_on'] ?: $r['entry_date'],
					'ref'     => $r['receipt_no'],
					'orderId' => (int) $r['order_id'],
				);
			} else {
				$paid += -$a;
			}
		}
		// Oldest first.
		foreach ( $bills as &$b ) {
			$take       = min( $paid, $b['left'] );
			$b['left'] -= $take;
			$paid      -= $take;
		}
		unset( $b );
		return array_values( array_filter( $bills, function ( $b ) {
			return $b['left'] > 0;
		} ) );
	}

	/** Days since a date. */
	private static function days_since( $date ) {
		return (int) floor( ( current_time( 'timestamp' ) - strtotime( $date . ' 00:00:00' ) ) / DAY_IN_SECONDS );
	}

	/** Everything the screens show about one account. */
	public static function summary( $customer_id, $account = null ) {
		$account = $account ?: self::account( $customer_id );
		$owed    = self::balance( $customer_id );
		$bills   = self::open_bills( $customer_id );
		$today   = current_time( 'Y-m-d' );
		$age     = array( 'current' => 0, 'd30' => 0, 'd60' => 0, 'd90' => 0, 'over90' => 0 );
		$overdue = 0;
		$oldest  = null;
		$next    = null;
		foreach ( $bills as $b ) {
			$days = self::days_since( $b['date'] );
			if ( $days <= 7 ) {
				$age['current'] += $b['left'];
			} elseif ( $days <= 30 ) {
				$age['d30'] += $b['left'];
			} elseif ( $days <= 60 ) {
				$age['d60'] += $b['left'];
			} elseif ( $days <= 90 ) {
				$age['d90'] += $b['left'];
			} else {
				$age['over90'] += $b['left'];
			}
			if ( $b['due'] < $today ) {
				$overdue += $b['left'];
			} elseif ( null === $next || $b['due'] < $next ) {
				$next = $b['due'];
			}
			if ( null === $oldest ) {
				$oldest = $b['date'];
			}
		}
		$limit  = $account ? (int) $account['credit_limit'] : 0;
		$status = $account ? $account['status'] : 'none';

		global $wpdb;
		$last_pay = $wpdb->get_row( $wpdb->prepare(
			"SELECT -amount AS amount, entry_date FROM " . self::t( 'credit_entries' ) . " WHERE customer_id = %d AND kind = 'payment' ORDER BY id DESC LIMIT 1",
			$customer_id
		), ARRAY_A );

		$user = get_user_by( 'id', $customer_id );
		return array(
			'customerId'  => (int) $customer_id,
			'name'        => $user ? $user->display_name : 'Customer #' . $customer_id,
			'phone'       => $user ? ( get_user_meta( $customer_id, 'ah_phone', true ) ?: get_user_meta( $customer_id, 'billing_phone', true ) ) : '',
			'status'      => $status,
			'limit'       => $limit,
			'termsDays'   => $account ? (int) $account['terms_days'] : 0,
			'note'        => $account ? (string) $account['note'] : '',
			'owed'        => $owed,
			// Money paid in advance and not yet used.
			'advance'     => max( 0, -$owed ),
			'available'   => max( 0, $limit - $owed ),
			'used'        => $limit > 0 ? round( $owed / $limit * 100, 1 ) : null,
			'overdue'     => $overdue,
			'oldestBill'  => $oldest,
			'oldestDays'  => $oldest ? self::days_since( $oldest ) : 0,
			'nextDue'     => $next,
			'aging'       => $age,
			'lastPayment' => $last_pay ? array( 'amount' => (int) $last_pay['amount'], 'date' => $last_pay['entry_date'] ) : null,
			'openedAt'    => $account ? substr( $account['opened_at'], 0, 10 ) : null,
			'canBuy'      => self::reason_not( $account, $owed, $overdue, 0 ) === null,
			'blocked'     => self::reason_not( $account, $owed, $overdue, 0 ),
		);
	}

	/**
	 * How much must be paid off before $more can go on credit: enough to
	 * clear what is late, and enough to bring the new total under the
	 * limit. 0 when it fits now. Null when credit cannot be used at all
	 * (no account, stopped or closed): then paying does not help.
	 */
	public static function to_pay_first( $customer_id, $more ) {
		$acc = self::account( $customer_id );
		if ( ! $acc || 'active' !== $acc['status'] ) {
			return null;
		}
		$owed  = self::balance( $customer_id );
		$today = current_time( 'Y-m-d' );
		$late  = 0;
		foreach ( self::open_bills( $customer_id ) as $b ) {
			if ( $b['due'] < $today ) {
				$late += $b['left'];
			}
		}
		return max( 0, $late, $owed + (int) $more - (int) $acc['credit_limit'] );
	}

	/** Why more cannot go on this account now, in plain words, or null. */
	private static function reason_not( $account, $owed, $overdue, $more ) {
		if ( ! $account ) {
			return 'This customer has no credit account.';
		}
		if ( 'hold' === $account['status'] ) {
			return 'Credit is stopped for this customer.';
		}
		if ( 'closed' === $account['status'] ) {
			return 'This credit account is closed.';
		}
		if ( $overdue > 0 ) {
			return sprintf( 'UGX %s is past the %d days to pay. Pay that first.', number_format( $overdue ), (int) $account['terms_days'] );
		}
		$limit = (int) $account['credit_limit'];
		if ( $owed + $more > $limit ) {
			return $more > 0
				? sprintf( 'This would make UGX %s owed. The limit is UGX %s. Only UGX %s is left.', number_format( $owed + $more ), number_format( $limit ), number_format( max( 0, $limit - $owed ) ) )
				: sprintf( 'Already owes UGX %s, over the limit of UGX %s.', number_format( $owed ), number_format( $limit ) );
		}
		return null;
	}

	/** The statement: every line with the balance after it. */
	public static function statement( $customer_id, $limit = 500 ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare(
			'SELECT * FROM ' . self::t( 'credit_entries' ) . ' WHERE customer_id = %d ORDER BY entry_date, id',
			$customer_id
		), ARRAY_A );
		$bal = 0;
		$out = array();
		foreach ( (array) $rows as $r ) {
			$a    = (int) $r['amount'];
			$bal += $a;
			$out[] = array(
				'id'      => (int) $r['id'],
				'date'    => $r['entry_date'],
				'kind'    => $r['kind'],
				'what'    => self::KINDS[ $r['kind'] ] ?? $r['kind'],
				'debit'   => $a > 0 ? $a : 0,
				'credit'  => $a < 0 ? -$a : 0,
				'balance' => $bal,
				'ref'     => $r['receipt_no'] ?: $r['ref'],
				'orderNo' => $r['order_id'] ? ( ( $o = wc_get_order( (int) $r['order_id'] ) ) ? AH_Shape::order_no( $o ) : '#' . $r['order_id'] ) : null,
				'method'  => $r['method'],
				'note'    => $r['note'],
				'due'     => $r['due_on'],
				'by'      => $r['user_name'],
			);
		}
		return array_slice( array_reverse( $out ), 0, $limit );
	}

	public static function overview() {
		global $wpdb;
		$accounts = (array) $wpdb->get_results( 'SELECT * FROM ' . self::t( 'credit_accounts' ) . " WHERE status <> 'closed' ORDER BY customer_id", ARRAY_A );
		// Anyone who still owes, even with a closed account.
		$owing = (array) $wpdb->get_col( 'SELECT customer_id FROM ' . self::t( 'credit_entries' ) . ' GROUP BY customer_id HAVING SUM(amount) <> 0' );
		$ids   = array_unique( array_merge( array_map( 'intval', wp_list_pluck( $accounts, 'customer_id' ) ), array_map( 'intval', $owing ) ) );

		$list = array();
		foreach ( $ids as $id ) {
			$list[] = self::summary( $id );
		}
		usort( $list, function ( $a, $b ) {
			return $b['owed'] <=> $a['owed'];
		} );

		$today = current_time( 'Y-m-d' );
		$month = current_time( 'Y-m' ) . '-01';
		$t     = self::t( 'credit_entries' );
		$sum   = function ( $kind, $from ) use ( $wpdb, $t ) {
			return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(ABS(amount)),0) FROM {$t} WHERE kind = %s AND entry_date >= %s", $kind, $from ) );
		};
		$aging = array( 'current' => 0, 'd30' => 0, 'd60' => 0, 'd90' => 0, 'over90' => 0 );
		foreach ( $list as $a ) {
			foreach ( $aging as $k => $v ) {
				$aging[ $k ] += $a['aging'][ $k ];
			}
		}

		return array(
			'summary'  => array(
				'owed'          => array_sum( wp_list_pluck( $list, 'owed' ) ),
				'overdue'       => array_sum( wp_list_pluck( $list, 'overdue' ) ),
				'limits'        => array_sum( wp_list_pluck( $list, 'limit' ) ),
				'customers'     => count( array_filter( $list, function ( $a ) { return 'none' !== $a['status'] && 'closed' !== $a['status']; } ) ),
				'owing'         => count( array_filter( $list, function ( $a ) { return $a['owed'] > 0; } ) ),
				'overdueCount'  => count( array_filter( $list, function ( $a ) { return $a['overdue'] > 0; } ) ),
				'nearLimit'     => count( array_filter( $list, function ( $a ) { return null !== $a['used'] && $a['used'] >= 80; } ) ),
				'onHold'        => count( array_filter( $list, function ( $a ) { return 'hold' === $a['status']; } ) ),
				'soldToday'     => $sum( 'sale', $today ),
				'paidToday'     => $sum( 'payment', $today ),
				'soldMonth'     => $sum( 'sale', $month ),
				'paidMonth'     => $sum( 'payment', $month ),
				'aging'         => $aging,
			),
			'accounts' => $list,
		);
	}

	/**
	 * Day by day, as the shop wrote it in the notebook: cash sales,
	 * credit sales, payments on credit, and what is owed at the end.
	 */
	public static function days( $req ) {
		global $wpdb;
		$to   = self::day( $req->get_param( 'to' ), current_time( 'Y-m-d' ) );
		$from = self::day( $req->get_param( 'from' ), gmdate( 'Y-m-d', strtotime( $to ) - 13 * DAY_IN_SECONDS ) );
		$pay  = self::t( 'payments' );
		$ce   = self::t( 'credit_entries' );
		$out  = array();
		$owed = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(amount),0) FROM {$ce} WHERE entry_date < %s", $from ) );
		for ( $d = $from; $d <= $to; $d = gmdate( 'Y-m-d', strtotime( $d ) + DAY_IN_SECONDS ) ) {
			$cash   = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(amount_paid),0) FROM {$pay} WHERE DATE(created_at) = %s AND method <> 'credit' AND verified <> -1", $d ) );
			$credit = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(amount),0) FROM {$ce} WHERE entry_date = %s AND kind = 'sale'", $d ) );
			$paid   = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(-amount),0) FROM {$ce} WHERE entry_date = %s AND kind = 'payment'", $d ) );
			$moved  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(amount),0) FROM {$ce} WHERE entry_date = %s", $d ) );
			$opening = $owed;
			$owed   += $moved;
			$out[]   = array(
				'day'        => $d,
				'cashSales'  => $cash,
				'creditSales'=> $credit,
				'totalSales' => $cash + $credit,
				'paidIn'     => $paid,
				'opening'    => $opening,
				'closing'    => $owed,
			);
		}
		return array( 'from' => $from, 'to' => $to, 'days' => array_reverse( $out ) );
	}

	/**
	 * The "Cash and Credit Sales Detailed Report": every line sold in the
	 * period, cash sales and credit sales apart, with their totals.
	 */
	public static function sales_report( $req ) {
		global $wpdb;
		$to   = self::day( $req->get_param( 'to' ), current_time( 'Y-m-d' ) );
		$from = self::day( $req->get_param( 'from' ), $to );
		$pay  = self::t( 'payments' );
		$rows = (array) $wpdb->get_results( $wpdb->prepare(
			"SELECT order_id, receipt_no, method, created_at FROM {$pay} WHERE DATE(created_at) BETWEEN %s AND %s AND verified <> -1 ORDER BY created_at, id",
			$from, $to
		), ARRAY_A );
		$cash   = array();
		$credit = array();
		foreach ( $rows as $p ) {
			$o = wc_get_order( (int) $p['order_id'] );
			if ( ! $o || in_array( AH_Statuses::to_api( $o->get_status() ), array( 'cancelled', 'refunded' ), true ) ) {
				continue;
			}
			$who = trim( $o->get_formatted_billing_full_name() ) ?: 'Cash Sale';
			foreach ( $o->get_items() as $item ) {
				$qty  = (float) $item->get_quantity();
				$line = array(
					'date'      => substr( $p['created_at'], 0, 10 ),
					'reference' => $p['receipt_no'] . ' · ' . AH_Shape::order_no( $o ),
					'customer'  => 'credit' === $p['method'] ? $who : 'Cash Sale',
					'item'      => $item->get_name(),
					'qty'       => $qty,
					'unitPrice' => $qty ? (int) round( (float) $item->get_total() / $qty ) : 0,
					'amount'    => (int) round( (float) $item->get_total() ),
					'method'    => $p['method'],
				);
				if ( 'credit' === $p['method'] ) {
					$credit[] = $line;
				} else {
					$cash[] = $line;
				}
			}
		}
		$user = AH_Auth::current();
		AH_Flow::log_event( 0, 'manager', 'data_exported', null, null, $user ? $user->ID : null, sprintf( 'Cash and credit sales report, %s to %s', $from, $to ) );
		return array(
			'shop'   => get_bloginfo( 'name' ) ?: 'Al Hadeed Hardware',
			'from'   => $from,
			'to'     => $to,
			'cash'   => $cash,
			'credit' => $credit,
		);
	}

	public static function one( $req ) {
		$id = (int) $req['id'];
		if ( ! get_user_by( 'id', $id ) ) {
			return self::err( 'ah_not_found', 'Customer not found', 404 );
		}
		return array(
			'account'   => self::summary( $id ),
			'bills'     => self::open_bills( $id ),
			'statement' => self::statement( $id ),
		);
	}

	/** The customer's own credit, for the app. */
	public static function mine( $req ) {
		$user = AH_Auth::current( $req );
		$acc  = self::account( $user->ID );
		if ( ! $acc && 0 === self::balance( $user->ID ) ) {
			return array( 'account' => null );
		}
		return array(
			'account'   => self::summary( $user->ID, $acc ),
			'bills'     => self::open_bills( $user->ID ),
			'statement' => self::statement( $user->ID, 100 ),
		);
	}

	// -----------------------------------------------------------------
	// Writing
	// -----------------------------------------------------------------

	private static function entry( $customer_id, $kind, $amount, $args = array() ) {
		global $wpdb;
		$user = ! empty( $args['by'] ) ? get_user_by( 'id', (int) $args['by'] ) : AH_Auth::current();
		$wpdb->insert( self::t( 'credit_entries' ), array(
			'customer_id' => (int) $customer_id,
			'kind'        => $kind,
			'amount'      => (int) $amount,
			'order_id'    => (int) ( $args['order_id'] ?? 0 ),
			'method'      => $args['method'] ?? null,
			'ref'         => $args['ref'] ?? null,
			'receipt_no'  => $args['receipt_no'] ?? null,
			'note'        => $args['note'] ?? null,
			'due_on'      => $args['due_on'] ?? null,
			'user_id'     => $user ? (int) $user->ID : 0,
			'user_name'   => $user ? $user->display_name : 'The shop',
			'entry_date'  => $args['date'] ?? current_time( 'Y-m-d' ),
			'created_at'  => current_time( 'mysql' ),
		) );
		return (int) $wpdb->insert_id;
	}

	public static function save_account( $req ) {
		global $wpdb;
		$id   = (int) $req['id'];
		$user = get_user_by( 'id', $id );
		if ( ! $user || AH_Roles::desk_of( $user ) ) {
			return self::err( 'ah_not_customer', 'Credit is for customers only', 400 );
		}
		$acc    = self::account( $id );
		$limit  = null !== $req->get_param( 'limit' ) ? max( 0, (int) $req->get_param( 'limit' ) ) : ( $acc ? (int) $acc['credit_limit'] : 0 );
		$terms  = null !== $req->get_param( 'termsDays' ) ? max( 1, min( 365, (int) $req->get_param( 'termsDays' ) ) ) : ( $acc ? (int) $acc['terms_days'] : 30 );
		$status = (string) ( $req->get_param( 'status' ) ?: ( $acc ? $acc['status'] : 'active' ) );
		if ( ! in_array( $status, array( 'active', 'hold', 'closed' ), true ) ) {
			return self::err( 'ah_bad_status', 'Choose active, stopped or closed' );
		}
		if ( ! $acc && $limit <= 0 ) {
			return self::err( 'ah_need_limit', 'Set how much this customer may owe' );
		}
		$note = null !== $req->get_param( 'note' ) ? sanitize_textarea_field( (string) $req->get_param( 'note' ) ) : ( $acc ? $acc['note'] : '' );
		$now  = current_time( 'mysql' );
		$me   = AH_Auth::current();
		if ( $acc ) {
			$wpdb->update( self::t( 'credit_accounts' ), array( 'credit_limit' => $limit, 'terms_days' => $terms, 'status' => $status, 'note' => $note, 'updated_at' => $now ), array( 'customer_id' => $id ) );
		} else {
			$wpdb->insert( self::t( 'credit_accounts' ), array( 'customer_id' => $id, 'credit_limit' => $limit, 'terms_days' => $terms, 'status' => $status, 'note' => $note, 'opened_by' => $me ? $me->ID : 0, 'opened_at' => $now, 'updated_at' => $now ) );
		}
		$what = ! $acc ? 'credit_opened' : ( $acc['status'] !== $status ? 'credit_' . $status : 'credit_changed' );
		AH_Flow::log_event( 0, 'manager', $what, null, null, $me ? $me->ID : null, sprintf( '%s · limit UGX %s · %d days', $user->display_name, number_format( $limit ), $terms ) );

		// An opening balance, when the account is first set up.
		$opening = (int) $req->get_param( 'openingBalance' );
		if ( ! $acc && $opening > 0 ) {
			self::entry( $id, 'opening', $opening, array( 'note' => 'Balance brought forward', 'due_on' => current_time( 'Y-m-d' ) ) );
		}
		return array( 'account' => self::summary( $id ) );
	}

	/**
	 * Delete loan accounts: the account and every line on it. The books
	 * do not forget: each line's journal entry is turned around, and
	 * History keeps who deleted what and how much was owed.
	 */
	public static function delete_accounts( $req ) {
		global $wpdb;
		$me  = AH_Auth::current();
		$ids = array_values( array_unique( array_filter( array_map( 'intval', (array) $req->get_param( 'ids' ) ) ) ) );
		if ( ! $ids ) {
			return self::err( 'ah_nothing', 'Choose the loan accounts to delete' );
		}
		$done = array();
		foreach ( $ids as $id ) {
			$acc   = self::account( $id );
			$lines = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'credit_entries' ) . ' WHERE customer_id = %d', $id ) );
			if ( ! $acc && ! $lines ) {
				continue;
			}
			$owed = self::balance( $id );
			$user = get_user_by( 'id', $id );
			$wpdb->delete( self::t( 'credit_entries' ), array( 'customer_id' => $id ) );
			$wpdb->delete( self::t( 'credit_accounts' ), array( 'customer_id' => $id ) );
			AH_Flow::log_event( 0, 'manager', 'credit_deleted', null, null, $me ? $me->ID : null, sprintf( '%s · owed UGX %s · %d lines', $user ? $user->display_name : '#' . $id, number_format( $owed ), $lines ) );
			$done[] = $id;
		}
		if ( class_exists( 'AH_Books' ) ) {
			AH_Books::sync();
		}
		return array( 'deleted' => count( $done ), 'ids' => $done );
	}

	public static function adjust( $req ) {
		$id     = (int) $req['id'];
		$amount = (int) $req->get_param( 'amount' );
		$kind   = (string) $req->get_param( 'kind' );
		$reason = trim( sanitize_text_field( (string) $req->get_param( 'reason' ) ) );
		if ( ! get_user_by( 'id', $id ) ) {
			return self::err( 'ah_not_found', 'Customer not found', 404 );
		}
		if ( 0 === $amount ) {
			return self::err( 'ah_no_amount', 'Type the amount' );
		}
		if ( mb_strlen( $reason ) < 3 ) {
			return self::err( 'ah_need_reason', 'Say why' );
		}
		if ( ! in_array( $kind, array( 'opening', 'adjustment', 'writeoff' ), true ) ) {
			$kind = 'adjustment';
		}
		// A write-off always takes off.
		if ( 'writeoff' === $kind ) {
			$amount = -abs( $amount );
		}
		self::entry( $id, $kind, $amount, array( 'note' => $reason, 'due_on' => $amount > 0 ? current_time( 'Y-m-d' ) : null ) );
		$me = AH_Auth::current();
		AH_Flow::log_event( 0, 'manager', 'credit_' . $kind, null, null, $me ? $me->ID : null, sprintf( '%s · UGX %s · %s', get_user_by( 'id', $id )->display_name, number_format( $amount ), $reason ) );
		return self::one( $req );
	}

	/** Money in against what is owed. */
	public static function pay( $req ) {
		global $wpdb;
		$id     = (int) $req['id'];
		$user   = get_user_by( 'id', $id );
		$amount = (int) $req->get_param( 'amount' );
		$method = (string) $req->get_param( 'method' );
		$ref    = trim( sanitize_text_field( (string) $req->get_param( 'ref' ) ) );
		if ( ! $user ) {
			return self::err( 'ah_not_found', 'Customer not found', 404 );
		}
		if ( $amount <= 0 ) {
			return self::err( 'ah_no_amount', 'Type the amount paid' );
		}
		$receipt = self::take( $id, $amount, $method, $ref, sanitize_text_field( (string) $req->get_param( 'note' ) ), (bool) $req->get_param( 'again' ) );
		if ( is_wp_error( $receipt ) ) {
			return $receipt;
		}
		return array_merge( self::one( $req ), array( 'receiptNo' => $receipt ) );
	}

	/**
	 * Money in against what a customer owes: the loan book, the cash book
	 * and a receipt, all saved together or not at all. Returns the
	 * receipt number, or why not.
	 *
	 * The same transaction ID never pays twice, and the same amount from
	 * the same customer twice inside two minutes is stopped as a double
	 * tap unless $again says it really is a second payment.
	 */
	public static function take( $id, $amount, $method, $ref, $note = '', $again = false, $order_id = 0, $by = 0 ) {
		global $wpdb;
		$user = get_user_by( 'id', (int) $id );
		$ref  = trim( (string) $ref );
		if ( ! $user ) {
			return self::err( 'ah_not_found', 'Customer not found', 404 );
		}
		if ( $amount <= 0 ) {
			return self::err( 'ah_no_amount', 'Type the amount paid' );
		}
		if ( ! in_array( $method, array( 'cash', 'mobile_money', 'bank', 'card', 'cheque' ), true ) ) {
			return self::err( 'ah_bad_method', 'Choose how it was paid' );
		}
		if ( 'cash' !== $method && strlen( $ref ) < 3 ) {
			return self::err( 'ah_ref_required', 'Type the transaction or cheque number' );
		}
		if ( '' !== $ref ) {
			$norm = AH_Proofs::normalise_ref( $ref );
			$used = $wpdb->get_var( $wpdb->prepare( 'SELECT receipt_no FROM ' . self::t( 'credit_entries' ) . " WHERE kind = 'payment' AND REPLACE(UPPER(ref), ' ', '') = %s LIMIT 1", $norm ) );
			$paid = $used ? null : AH_Proofs::already_used( $norm, 0 );
			if ( $used || $paid ) {
				return self::err( 'ah_ref_used', sprintf( 'Transaction %s is already recorded (receipt %s). The same payment is never entered twice.', $ref, $used ?: $paid['receipt_no'] ), 409 );
			}
		}
		if ( ! $again ) {
			$twice = $wpdb->get_var( $wpdb->prepare(
				'SELECT receipt_no FROM ' . self::t( 'credit_entries' ) . " WHERE kind = 'payment' AND customer_id = %d AND amount = %d AND created_at >= %s LIMIT 1",
				$id, -$amount, gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - 120 )
			) );
			if ( $twice ) {
				return new WP_Error( 'ah_paid_twice', sprintf( 'UGX %s from %s was just recorded (receipt %s). If this is a second payment, tick "It is a second payment".', number_format( $amount ), $user->display_name, $twice ), array( 'status' => 409, 'canRepeat' => true ) );
			}
		}
		// Paying more than is owed is allowed: the extra is held for the
		// customer and used by their next credit order (a deposit).
		$me      = $by ? get_user_by( 'id', (int) $by ) : AH_Auth::current();
		$receipt = AH_Books::atomic( function () use ( $wpdb, $id, $amount, $method, $ref, $note, $user, $me, $order_id ) {
			$receipt = AH_Flow::next_receipt_no();
			if ( ! self::entry( $id, 'payment', -$amount, array( 'method' => $method, 'ref' => $ref ?: null, 'receipt_no' => $receipt, 'note' => $note ?: null, 'order_id' => $order_id, 'by' => $me ? $me->ID : 0 ) ) ) {
				return self::err( 'ah_failed', 'The payment did not save. Try again.', 500 );
			}
			// Real money in, so it goes in the cash book with a receipt.
			$ok = $wpdb->insert( AH_Install::table( 'cash_book' ), array(
				'entry_date'  => current_time( 'Y-m-d' ),
				'details'     => sprintf( '%s · Credit payment · %s', $receipt, $user->display_name ),
				'cash_in'     => $amount,
				'cash_out'    => 0,
				'method'      => $method,
				'order_id'    => $order_id ?: null,
				'payment_id'  => null,
				'recorded_by' => $me ? $me->ID : 0,
				'created_at'  => current_time( 'mysql' ),
			) );
			if ( ! $ok ) {
				return self::err( 'ah_failed', 'The payment did not save. Try again.', 500 );
			}
			return $receipt;
		} );
		if ( is_wp_error( $receipt ) ) {
			return $receipt;
		}
		AH_Flow::log_event( (int) $order_id, 'cashier', 'credit_payment', null, null, $me ? $me->ID : null, sprintf( '%s · %s · UGX %s · %s%s', $receipt, $user->display_name, number_format( $amount ), $method, $ref ? ' · ' . $ref : '' ) );

		$left = self::balance( $id );
		self::tell( $id, 'Payment received', $left < 0
			? sprintf( '%s: we received UGX %s. You owe nothing and have UGX %s with us for your next order. Receipt %s.', self::shop(), number_format( $amount ), number_format( -$left ), $receipt )
			: sprintf( '%s: we received UGX %s. You now owe UGX %s. Receipt %s.', self::shop(), number_format( $amount ), number_format( $left ), $receipt ) );
		if ( class_exists( 'AH_Push' ) ) {
			AH_Push::send( AH_Push::desk( 'manager' ), 'Credit paid UGX ' . number_format( $amount ), sprintf( '%s · now owes UGX %s', $user->display_name, number_format( max( 0, $left ) ) ), array( 'kind' => 'credit_payment' ) );
		}
		return $receipt;
	}

	// -----------------------------------------------------------------
	// Selling on credit (called from the cashier's payment)
	// -----------------------------------------------------------------

	/**
	 * May this order go on the customer's account? Null if yes, or the
	 * refusal. The manager can let it through with a reason.
	 */
	public static function check( $order, $due, $override = '', $by = 0 ) {
		$customer = (int) $order->get_customer_id();
		if ( ! $customer ) {
			return self::err( 'ah_no_customer', 'This sale has no customer. Credit needs a named customer with a credit account.' );
		}
		$acc    = self::account( $customer );
		$owed   = self::balance( $customer );
		$bills  = self::open_bills( $customer );
		$today  = current_time( 'Y-m-d' );
		$late   = 0;
		foreach ( $bills as $b ) {
			if ( $b['due'] < $today ) {
				$late += $b['left'];
			}
		}
		$why = self::reason_not( $acc, $owed, $late, $due );
		if ( null === $why ) {
			return null;
		}
		// No account at all cannot be overridden: the manager opens one.
		$who = get_user_by( 'id', (int) $by );
		if ( $acc && $who && 'manager' === AH_Roles::desk_of( $who ) && mb_strlen( trim( (string) $override ) ) >= 5 ) {
			AH_Flow::log_event( $order->get_id(), 'manager', 'credit_override', null, null, $who->ID, $why . ' · Allowed: ' . sanitize_text_field( $override ) );
			return null;
		}
		if ( class_exists( 'AH_Push' ) ) {
			AH_Push::send( AH_Push::desk( 'manager' ), 'Credit refused ' . AH_Shape::order_no( $order ), get_user_by( 'id', $customer )->display_name . ': ' . $why, array( 'kind' => 'credit_refused' ) );
		}
		return new WP_Error( 'ah_credit_refused', $why, array( 'status' => 409, 'canOverride' => (bool) $acc ) );
	}

	/** The sale goes on the account. */
	public static function charge( $order, $amount, $receipt, $by = 0 ) {
		$customer = (int) $order->get_customer_id();
		$acc      = self::account( $customer );
		$days     = $acc ? (int) $acc['terms_days'] : 30;
		self::entry( $customer, 'sale', $amount, array(
			'order_id'   => $order->get_id(),
			'receipt_no' => $receipt,
			'note'       => AH_Shape::order_no( $order ),
			'due_on'     => gmdate( 'Y-m-d', current_time( 'timestamp' ) + $days * DAY_IN_SECONDS ),
			'by'         => $by,
		) );
		$owed = self::balance( $customer );
		$name = get_user_by( 'id', $customer )->display_name;
		self::tell( $customer, 'Taken on loan', sprintf( '%s: order %s, UGX %s on loan. You now owe UGX %s. Pay within %d days.', self::shop(), AH_Shape::order_no( $order ), number_format( $amount ), number_format( $owed ), $days ) );
		if ( class_exists( 'AH_Push' ) ) {
			AH_Push::send( AH_Push::desk( 'manager' ), 'Credit sale UGX ' . number_format( $amount ), sprintf( '%s · %s · now owes UGX %s', AH_Shape::order_no( $order ), $name, number_format( $owed ) ), array( 'kind' => 'credit_sale' ) );
		}
	}

	/** Tell the customer how much to pay before the goods go on credit. */
	public static function ask_to_pay_first( $order, $amount ) {
		self::tell(
			(int) $order->get_customer_id(),
			'Pay UGX ' . number_format( $amount ) . ' first',
			sprintf( '%s: order %s waits for you. Pay UGX %s off your credit at the shop, then you can collect it or we deliver.', self::shop(), AH_Shape::order_no( $order ), number_format( $amount ) )
		);
	}

	/** Take an order's credit back off, when it is cancelled or sent back. */
	public static function reverse_order( $order, $why ) {
		global $wpdb;
		$net = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(amount),0) FROM ' . self::t( 'credit_entries' ) . " WHERE order_id = %d AND kind IN ('sale','reversal')", $order->get_id() ) );
		if ( $net <= 0 ) {
			return;
		}
		self::entry( (int) $order->get_customer_id(), 'reversal', -$net, array( 'order_id' => $order->get_id(), 'note' => $why ) );
	}

	public static function on_move( $order, $to ) {
		if ( 'cancelled' === $to || 'refunded' === $to ) {
			self::reverse_order( $order, AH_Shape::order_no( $order ) . ' cancelled' );
		}
	}

	// -----------------------------------------------------------------

	private static function shop() {
		return get_bloginfo( 'name' ) ?: 'Al Hadeed';
	}

	/** SMS and push to the customer. */
	private static function tell( $customer_id, $title, $text ) {
		$phone = get_user_meta( $customer_id, 'ah_phone', true ) ?: get_user_meta( $customer_id, 'billing_phone', true );
		if ( $phone ) {
			AH_Sms::send( $phone, $text );
		}
		if ( class_exists( 'AH_Push' ) ) {
			AH_Push::send( array( $customer_id ), $title, $text, array( 'kind' => 'credit' ) );
		}
	}

	private static function day( $v, $fallback ) {
		$v = (string) $v;
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) ? $v : $fallback;
	}
}
