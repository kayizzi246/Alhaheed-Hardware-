<?php
/**
 * Workers and their pay, as the manager keeps them.
 *
 * A worker is anyone the shop pays: the cashier and the store man, but
 * also the loaders, the driver and the guard, who never sign in to
 * anything. A worker may be linked to a desk login; most are not.
 *
 * ── Pay ──
 *
 *   ADVANCE   money given before payday. Filed as an expense against
 *             the worker, so it is in the cash book the day it leaves,
 *             and recovered from the next payslips.
 *
 *   PAYROLL   one payslip per worker per month:
 *               base (the monthly pay, or the day rate × days worked)
 *             + allowance + overtime + bonus      = gross
 *             − deductions − advance recovered     = net
 *
 *   APPROVE   the manager approves the month. Each slip becomes a
 *             "Salary" expense, already approved, for the cashier to
 *             pay out (or booked at once if the manager paid in cash).
 *             When the expense is paid, the slip is paid.
 *
 * So salaries sit with every other expense: in the Expenses list, the
 * cash book and the monthly report, never in a corner of their own.
 *
 * Every route is the manager's alone.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Workers {

	const BASIS = array(
		'monthly' => 'Monthly salary',
		'daily'   => 'Paid by the day',
	);

	const SLIP_STATUS = array(
		'draft'    => 'Draft',
		'approved' => 'Approved, waiting for the cashier',
		'paid'     => 'Paid',
	);

	/** A month of a day-rate worker's pay, before anyone says otherwise. */
	const DEFAULT_DAYS = 26;

	public static function routes() {
		$ns      = AH_Rest::NS;
		$get     = WP_REST_Server::READABLE;
		$post    = WP_REST_Server::CREATABLE;
		$manager = AH_Rest::desk( array( 'manager' ) );

		$route = function ( $path, $methods, $cb ) use ( $ns, $manager ) {
			register_rest_route( $ns, $path, array(
				'methods'             => $methods,
				'permission_callback' => $manager,
				'callback'            => $cb,
			) );
		};

		$route( '/manager/workers', array( $get, $post ), array( __CLASS__, 'workers' ) );
		$route( '/manager/workers/delete', $post, array( __CLASS__, 'delete' ) );
		$route( '/manager/workers/(?P<id>\d+)', array( $get, $post ), array( __CLASS__, 'one' ) );
		$route( '/manager/workers/(?P<id>\d+)/advance', $post, array( __CLASS__, 'advance' ) );
		$route( '/manager/payroll', $get, array( __CLASS__, 'payroll' ) );
		$route( '/manager/payroll/start', $post, array( __CLASS__, 'start' ) );
		$route( '/manager/payroll/approve', $post, array( __CLASS__, 'approve' ) );
		$route( '/manager/payroll/slips/(?P<id>\d+)', $post, array( __CLASS__, 'edit_slip' ) );
		$route( '/manager/payroll/slips/(?P<id>\d+)/delete', $post, array( __CLASS__, 'delete_slip' ) );
	}

	// -----------------------------------------------------------------
	// Workers
	// -----------------------------------------------------------------

	public static function workers( $req ) {
		if ( 'POST' === $req->get_method() ) {
			return self::save( $req, 0 );
		}

		global $wpdb;
		$t    = AH_Install::table( 'workers' );
		$rows = (array) $wpdb->get_results( "SELECT * FROM {$t} ORDER BY status = 'active' DESC, full_name", ARRAY_A );
		$owed = self::advances_owed();

		$out     = array();
		$summary = array( 'active' => 0, 'left' => 0, 'wageBill' => 0, 'advancesOwed' => 0 );
		foreach ( $rows as $r ) {
			$w     = self::shape( $r, $owed );
			$out[] = $w;
			if ( 'active' === $w['status'] ) {
				$summary['active']++;
				$summary['wageBill'] += $w['monthlyPay'];
			} else {
				$summary['left']++;
			}
			$summary['advancesOwed'] += $w['advanceOwed'];
		}

		return array(
			'workers' => $out,
			'summary' => $summary,
			'desks'   => self::desk_people(),
			'basis'   => self::BASIS,
			'methods' => AH_Expenses::methods(),
		);
	}

	public static function one( $req ) {
		$id = (int) $req['id'];
		if ( 'POST' === $req->get_method() ) {
			return self::save( $req, $id );
		}

		$row = self::row( $id );
		if ( ! $row ) {
			return new WP_Error( 'ah_not_found', 'That worker is no longer on the list', array( 'status' => 404 ) );
		}

		global $wpdb;
		$slips = (array) $wpdb->get_results(
			$wpdb->prepare( 'SELECT * FROM ' . AH_Install::table( 'payslips' ) . ' WHERE worker_id = %d ORDER BY period DESC LIMIT 36', $id ),
			ARRAY_A
		);
		$money = (array) $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id FROM ' . AH_Install::table( 'expenses' ) . " WHERE worker_id = %d AND kind IN ('advance','salary') ORDER BY id DESC LIMIT 60",
				$id
			),
			ARRAY_A
		);

		return array(
			'worker'   => self::shape( $row, self::advances_owed() ),
			'payslips' => array_map( array( __CLASS__, 'slip' ), $slips ),
			'payments' => array_values( array_filter( array_map( function ( $r ) {
				return AH_Expenses::get( $r['id'] );
			}, $money ) ) ),
		);
	}

	private static function save( $req, $id ) {
		global $wpdb;
		$t    = AH_Install::table( 'workers' );
		$user = AH_Auth::current();
		$old  = $id ? self::row( $id ) : null;
		if ( $id && ! $old ) {
			return new WP_Error( 'ah_not_found', 'That worker is no longer on the list', array( 'status' => 404 ) );
		}

		$text = function ( $key, $max ) use ( $req, $old ) {
			$col = self::column( $key );
			if ( null === $req->get_param( $key ) ) {
				return $old ? $old[ $col ] : null;
			}
			$v = trim( sanitize_text_field( (string) $req->get_param( $key ) ) );
			return '' === $v ? null : mb_substr( $v, 0, $max );
		};
		$money = function ( $key ) use ( $req, $old ) {
			$v = $req->get_param( $key );
			if ( null === $v || '' === $v ) {
				return $old ? (int) $old[ self::column( $key ) ] : 0;
			}
			return max( 0, AH_Shape::money( $v ) );
		};
		$date = function ( $key ) use ( $req, $old ) {
			$v = $req->get_param( $key );
			if ( null === $v ) {
				return $old ? $old[ self::column( $key ) ] : null;
			}
			$v = substr( (string) $v, 0, 10 );
			return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) ? $v : null;
		};

		$data = array(
			'full_name'  => $text( 'fullName', 191 ),
			'phone'      => $text( 'phone', 32 ),
			'job'        => $text( 'job', 120 ),
			'id_number'  => $text( 'idNumber', 64 ),
			'started_on' => $date( 'startedOn' ),
			'base_pay'   => $money( 'basePay' ),
			'allowance'  => $money( 'allowance' ),
			'pay_number' => $text( 'payNumber', 64 ),
			'bank_name'  => $text( 'bankName', 120 ),
			'kin_name'   => $text( 'kinName', 191 ),
			'kin_phone'  => $text( 'kinPhone', 32 ),
			'address'    => $text( 'address', 255 ),
			'notes'      => null === $req->get_param( 'notes' )
				? ( $old ? $old['notes'] : null )
				: ( trim( sanitize_textarea_field( (string) $req->get_param( 'notes' ) ) ) ?: null ),
			'left_on'    => $date( 'leftOn' ),
			'updated_at' => current_time( 'mysql' ),
		);

		$basis             = (string) $req->get_param( 'payBasis' );
		$data['pay_basis'] = isset( self::BASIS[ $basis ] ) ? $basis : ( $old ? $old['pay_basis'] : 'monthly' );

		$method             = (string) $req->get_param( 'payMethod' );
		$data['pay_method'] = isset( AH_Expenses::methods()[ $method ] ) ? $method : ( $old ? $old['pay_method'] : 'cash' );

		$status         = (string) $req->get_param( 'status' );
		$data['status'] = in_array( $status, array( 'active', 'left' ), true ) ? $status : ( $old ? $old['status'] : 'active' );
		if ( 'left' === $data['status'] && ! $data['left_on'] ) {
			$data['left_on'] = current_time( 'Y-m-d' );
		}
		if ( 'active' === $data['status'] ) {
			$data['left_on'] = null;
		}

		$link = $req->get_param( 'userId' );
		if ( null !== $link ) {
			$link            = (int) $link;
			$data['user_id'] = $link > 0 && AH_Roles::desk_of( get_user_by( 'id', $link ) ) ? $link : null;
		}

		if ( ! $data['full_name'] || mb_strlen( $data['full_name'] ) < 2 ) {
			return new WP_Error( 'ah_no_name', "Enter the worker's name", array( 'status' => 400 ) );
		}
		if ( $data['base_pay'] < 1 ) {
			return new WP_Error(
				'ah_no_pay',
				'daily' === $data['pay_basis'] ? 'Enter the pay for one day' : 'Enter the monthly salary',
				array( 'status' => 400 )
			);
		}

		if ( $id ) {
			$wpdb->update( $t, $data, array( 'id' => $id ) );
			$changes = array();
			foreach ( array( 'base_pay' => 'pay', 'allowance' => 'allowance', 'status' => 'status', 'job' => 'job' ) as $col => $word ) {
				if ( (string) $old[ $col ] !== (string) $data[ $col ] ) {
					$changes[] = $word . ' ' . $old[ $col ] . ' → ' . $data[ $col ];
				}
			}
			self::log( 'worker_updated', $data['full_name'] . ( $changes ? ' · ' . implode( ', ', $changes ) : '' ) );
		} else {
			$data['created_at'] = current_time( 'mysql' );
			$wpdb->insert( $t, $data );
			$id = (int) $wpdb->insert_id;
			if ( ! $id ) {
				return new WP_Error( 'ah_not_saved', 'The worker could not be saved. Try again.', array( 'status' => 500 ) );
			}
			self::log( 'worker_added', $data['full_name'] . ' · ' . ( $data['job'] ?: 'worker' ) . ' · UGX ' . number_format( $data['base_pay'] ) );
		}

		return array( 'worker' => self::shape( self::row( $id ), self::advances_owed() ) );
	}

	/**
	 * Off the list for good. Their paid and approved payslips and the
	 * money they were given stay in the books under their name; only a
	 * draft slip, which never became money, goes with them.
	 */
	public static function delete( $req ) {
		global $wpdb;
		$ids = array_values( array_filter( array_map( 'intval', (array) $req->get_param( 'ids' ) ) ) );
		if ( ! $ids ) {
			return new WP_Error( 'ah_none', 'Choose who to delete', array( 'status' => 400 ) );
		}

		$names = array();
		foreach ( $ids as $id ) {
			$row = self::row( $id );
			if ( ! $row ) {
				continue;
			}
			$wpdb->delete( AH_Install::table( 'payslips' ), array( 'worker_id' => $id, 'status' => 'draft' ) );
			$wpdb->delete( AH_Install::table( 'workers' ), array( 'id' => $id ) );
			$names[] = $row['full_name'];
		}
		if ( ! $names ) {
			return new WP_Error( 'ah_not_found', 'Those workers are already gone', array( 'status' => 404 ) );
		}
		self::log( 'workers_deleted', implode( ', ', $names ) );

		return array( 'deleted' => count( $names ), 'names' => $names );
	}

	/** Money before payday, recovered from the next payslip. */
	public static function advance( $req ) {
		$row = self::row( (int) $req['id'] );
		if ( ! $row ) {
			return new WP_Error( 'ah_not_found', 'That worker is no longer on the list', array( 'status' => 404 ) );
		}
		$amount = AH_Shape::money( $req->get_param( 'amount' ) );
		if ( $amount < 1 ) {
			return new WP_Error( 'ah_no_amount', 'Enter how much is given', array( 'status' => 400 ) );
		}

		$why     = trim( sanitize_text_field( (string) $req->get_param( 'details' ) ) );
		$paid    = 'paid' === $req->get_param( 'settle' );
		$method  = (string) $req->get_param( 'method' );
		$payment = array(
			'method'     => isset( AH_Expenses::methods()[ $method ] ) ? $method : ( $row['pay_method'] ?: 'cash' ),
			'payee'      => $row['full_name'],
			'pay_number' => trim( sanitize_text_field( (string) $req->get_param( 'payNumber' ) ) ) ?: $row['pay_number'],
			'pay_ref'    => trim( sanitize_text_field( (string) $req->get_param( 'payRef' ) ) ) ?: null,
		);

		$id = AH_Expenses::file_approved(
			'advance',
			'Advance to ' . $row['full_name'] . ( $why ? ': ' . $why : '' ),
			$amount,
			$payment,
			$paid,
			array( 'worker_id' => (int) $row['id'] )
		);
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		if ( ! $paid ) {
			AH_Expenses::tell_cashier(
				sprintf( '%s: advance of UGX %s to %s approved. Pay it out from Expenses.', AH_Sms::shop_name(), number_format( $amount ), $row['full_name'] )
			);
		}

		return array(
			'expense' => AH_Expenses::get( $id ),
			'worker'  => self::shape( self::row( (int) $row['id'] ), self::advances_owed() ),
		);
	}

	// -----------------------------------------------------------------
	// Payroll
	// -----------------------------------------------------------------

	public static function payroll( $req ) {
		global $wpdb;
		$period = self::period( $req->get_param( 'period' ) );
		$slips  = (array) $wpdb->get_results(
			$wpdb->prepare( 'SELECT * FROM ' . AH_Install::table( 'payslips' ) . ' WHERE period = %s ORDER BY worker_name', $period ),
			ARRAY_A
		);
		$out = array_map( array( __CLASS__, 'slip' ), $slips );

		$have    = array_map( function ( $s ) { return (int) $s['workerId']; }, $out );
		$missing = array();
		$owed    = self::advances_owed();
		$active  = (array) $wpdb->get_results( 'SELECT * FROM ' . AH_Install::table( 'workers' ) . " WHERE status = 'active' ORDER BY full_name", ARRAY_A );
		foreach ( $active as $w ) {
			if ( ! in_array( (int) $w['id'], $have, true ) ) {
				$missing[] = self::shape( $w, $owed );
			}
		}

		$total = array( 'slips' => count( $out ), 'gross' => 0, 'deductions' => 0, 'advances' => 0, 'net' => 0, 'draft' => 0, 'approved' => 0, 'paid' => 0, 'paidValue' => 0, 'toPay' => 0 );
		foreach ( $out as $s ) {
			$total['gross']      += $s['gross'];
			$total['deductions'] += $s['deductions'];
			$total['advances']   += $s['advanceRecovered'];
			$total['net']        += $s['net'];
			$total[ $s['status'] ]++;
			if ( 'paid' === $s['status'] ) {
				$total['paidValue'] += $s['net'];
			} elseif ( 'approved' === $s['status'] ) {
				$total['toPay'] += $s['net'];
			}
		}

		$months = (array) $wpdb->get_col( 'SELECT DISTINCT period FROM ' . AH_Install::table( 'payslips' ) . ' ORDER BY period DESC LIMIT 24' );

		return array(
			'period'  => $period,
			'slips'   => $out,
			'missing' => $missing,
			'totals'  => $total,
			'months'  => $months,
		);
	}

	/** Draft a slip for every active worker who has none this month. */
	public static function start( $req ) {
		global $wpdb;
		$period = self::period( $req->get_param( 'period' ) );
		$only   = array_filter( array_map( 'intval', (array) $req->get_param( 'ids' ) ) );
		$user   = AH_Auth::current();
		$owed   = self::advances_owed();
		$slips  = AH_Install::table( 'payslips' );

		$active = (array) $wpdb->get_results( 'SELECT * FROM ' . AH_Install::table( 'workers' ) . " WHERE status = 'active'", ARRAY_A );
		$made   = 0;
		foreach ( $active as $w ) {
			if ( $only && ! in_array( (int) $w['id'], $only, true ) ) {
				continue;
			}
			$exists = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$slips} WHERE period = %s AND worker_id = %d", $period, $w['id'] ) );
			if ( $exists ) {
				continue;
			}
			$daily = 'daily' === $w['pay_basis'];
			$days  = $daily ? self::DEFAULT_DAYS : 0;
			$base  = $daily ? (int) $w['base_pay'] * $days : (int) $w['base_pay'];
			$gross = $base + (int) $w['allowance'];
			$back  = min( $owed[ (int) $w['id'] ] ?? 0, $gross );

			$wpdb->insert(
				$slips,
				array(
					'period'            => $period,
					'worker_id'         => (int) $w['id'],
					'worker_name'       => $w['full_name'],
					'job'               => $w['job'],
					'pay_basis'         => $w['pay_basis'],
					'rate'              => (int) $w['base_pay'],
					'days_worked'       => $days,
					'base_pay'          => $base,
					'allowance'         => (int) $w['allowance'],
					'advance_recovered' => $back,
					'gross'             => $gross,
					'net'               => $gross - $back,
					'status'            => 'draft',
					'created_by'        => $user->ID,
					'created_at'        => current_time( 'mysql' ),
				)
			);
			$made++;
		}
		if ( $made ) {
			self::log( 'payroll_started', self::month_name( $period ) . ' · ' . $made . ' payslips' );
		}

		return self::payroll_for( $period ) + array( 'made' => $made );
	}

	public static function edit_slip( $req ) {
		global $wpdb;
		$slip = self::slip_row( (int) $req['id'] );
		if ( ! $slip ) {
			return new WP_Error( 'ah_not_found', 'That payslip is gone', array( 'status' => 404 ) );
		}
		if ( 'draft' !== $slip['status'] ) {
			return new WP_Error( 'ah_locked', 'That payslip is already approved. It can no longer be changed.', array( 'status' => 409 ) );
		}

		$num = function ( $key, $col ) use ( $req, $slip ) {
			$v = $req->get_param( $key );
			return ( null === $v || '' === $v ) ? (int) $slip[ $col ] : max( 0, AH_Shape::money( $v ) );
		};

		$days = $num( 'daysWorked', 'days_worked' );
		$rate = $num( 'rate', 'rate' );
		$base = 'daily' === $slip['pay_basis'] ? $rate * $days : $num( 'basePay', 'base_pay' );
		$data = array(
			'rate'              => 'daily' === $slip['pay_basis'] ? $rate : $base,
			'days_worked'       => $days,
			'base_pay'          => $base,
			'allowance'         => $num( 'allowance', 'allowance' ),
			'overtime'          => $num( 'overtime', 'overtime' ),
			'bonus'             => $num( 'bonus', 'bonus' ),
			'deductions'        => $num( 'deductions', 'deductions' ),
			'advance_recovered' => $num( 'advanceRecovered', 'advance_recovered' ),
		);
		if ( null !== $req->get_param( 'deductionNote' ) ) {
			$data['deduction_note'] = trim( sanitize_text_field( (string) $req->get_param( 'deductionNote' ) ) ) ?: null;
		}
		if ( null !== $req->get_param( 'note' ) ) {
			$data['note'] = trim( sanitize_textarea_field( (string) $req->get_param( 'note' ) ) ) ?: null;
		}

		$owed = self::advances_owed()[ (int) $slip['worker_id'] ] ?? 0;
		if ( $data['advance_recovered'] > $owed ) {
			return new WP_Error(
				'ah_too_much_back',
				$owed ? 'Only UGX ' . number_format( $owed ) . ' of advances is owed.' : 'Nothing is owed in advances.',
				array( 'status' => 400 )
			);
		}

		$data['gross'] = $data['base_pay'] + $data['allowance'] + $data['overtime'] + $data['bonus'];
		$data['net']   = $data['gross'] - $data['deductions'] - $data['advance_recovered'];
		if ( $data['net'] < 0 ) {
			return new WP_Error( 'ah_below_zero', 'Deductions and advances come to more than the pay. Lower one of them.', array( 'status' => 400 ) );
		}

		$wpdb->update( AH_Install::table( 'payslips' ), $data, array( 'id' => (int) $slip['id'] ) );
		return array( 'slip' => self::slip( self::slip_row( (int) $slip['id'] ) ) );
	}

	public static function delete_slip( $req ) {
		global $wpdb;
		$slip = self::slip_row( (int) $req['id'] );
		if ( ! $slip ) {
			return new WP_Error( 'ah_not_found', 'That payslip is gone', array( 'status' => 404 ) );
		}
		if ( 'draft' !== $slip['status'] ) {
			return new WP_Error( 'ah_locked', 'Only a draft payslip can be removed.', array( 'status' => 409 ) );
		}
		$wpdb->delete( AH_Install::table( 'payslips' ), array( 'id' => (int) $slip['id'] ) );
		return array( 'deleted' => true );
	}

	/**
	 * The month is approved: every draft slip (or the chosen ones)
	 * becomes a Salary expense. "cash" means the manager has paid them
	 * all in cash already; otherwise the cashier pays them out.
	 */
	public static function approve( $req ) {
		global $wpdb;
		$period = self::period( $req->get_param( 'period' ) );
		$only   = array_filter( array_map( 'intval', (array) $req->get_param( 'ids' ) ) );
		$cash   = 'cash' === $req->get_param( 'settle' );
		$t      = AH_Install::table( 'payslips' );

		$drafts = (array) $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$t} WHERE period = %s AND status = 'draft' ORDER BY worker_name", $period ),
			ARRAY_A
		);
		if ( $only ) {
			$drafts = array_values( array_filter( $drafts, function ( $s ) use ( $only ) {
				return in_array( (int) $s['id'], $only, true );
			} ) );
		}
		if ( ! $drafts ) {
			return new WP_Error( 'ah_nothing', 'There are no draft payslips to approve for ' . self::month_name( $period ) . '.', array( 'status' => 400 ) );
		}

		$workers = array();
		foreach ( (array) $wpdb->get_results( 'SELECT * FROM ' . AH_Install::table( 'workers' ), ARRAY_A ) as $w ) {
			$workers[ (int) $w['id'] ] = $w;
		}

		$done  = 0;
		$total = 0;
		foreach ( $drafts as $s ) {
			$w   = $workers[ (int) $s['worker_id'] ] ?? null;
			$now = current_time( 'mysql' );

			// All of it went back against advances: nothing to hand over.
			if ( (int) $s['net'] <= 0 ) {
				$wpdb->update( $t, array( 'status' => 'paid', 'approved_at' => $now, 'paid_at' => $now ), array( 'id' => (int) $s['id'] ) );
				$done++;
				continue;
			}

			$payment = array(
				'method'     => $cash ? 'cash' : ( $w && $w['pay_method'] ? $w['pay_method'] : 'cash' ),
				'payee'      => $s['worker_name'],
				'pay_number' => $w ? $w['pay_number'] : null,
			);
			$id = AH_Expenses::file_approved(
				'salary',
				'Salary ' . self::month_name( $period ) . ' · ' . $s['worker_name'] . ( $s['job'] ? ' (' . $s['job'] . ')' : '' ),
				(int) $s['net'],
				$payment,
				$cash,
				array( 'worker_id' => (int) $s['worker_id'], 'payslip_id' => (int) $s['id'] )
			);
			if ( is_wp_error( $id ) ) {
				return $id;
			}
			// Paid in cash just now: book() has already marked the slip
			// paid, so only the approval and the link are written here.
			$wpdb->update( $t, array( 'expense_id' => $id, 'approved_at' => $now ), array( 'id' => (int) $s['id'] ) );
			if ( ! $cash ) {
				$wpdb->update( $t, array( 'status' => 'approved' ), array( 'id' => (int) $s['id'], 'status' => 'draft' ) );
			}
			$done++;
			$total += (int) $s['net'];
		}

		self::log( 'payroll_approved', self::month_name( $period ) . ' · ' . $done . ' payslips · UGX ' . number_format( $total ) . ( $cash ? ' · paid in cash' : '' ) );
		if ( ! $cash && $total ) {
			AH_Expenses::tell_cashier(
				sprintf( '%s: salaries for %s approved, UGX %s. Pay them out from Expenses.', AH_Sms::shop_name(), self::month_name( $period ), number_format( $total ) )
			);
		}

		return self::payroll_for( $period ) + array( 'approved' => $done );
	}

	/** Called when the expense behind a slip is paid out. */
	public static function slip_paid( $slip_id ) {
		global $wpdb;
		$wpdb->update(
			AH_Install::table( 'payslips' ),
			array( 'status' => 'paid', 'paid_at' => current_time( 'mysql' ), 'approved_at' => current_time( 'mysql' ) ),
			array( 'id' => (int) $slip_id )
		);
	}

	// -----------------------------------------------------------------
	// Shapes and sums
	// -----------------------------------------------------------------

	private static function payroll_for( $period ) {
		$r = new WP_REST_Request( 'GET', '/' );
		$r->set_param( 'period', $period );
		return self::payroll( $r );
	}

	/**
	 * What each worker still owes in advances: what they were given
	 * (and has left the drawer) less what payslips have taken back.
	 *
	 * @return array<int,int> worker id => UGX
	 */
	public static function advances_owed() {
		global $wpdb;
		$given = (array) $wpdb->get_results(
			'SELECT worker_id, SUM(amount) AS v FROM ' . AH_Install::table( 'expenses' ) . " WHERE kind = 'advance' AND status = 'paid' AND worker_id IS NOT NULL GROUP BY worker_id",
			ARRAY_A
		);
		$back  = (array) $wpdb->get_results(
			'SELECT worker_id, SUM(advance_recovered) AS v FROM ' . AH_Install::table( 'payslips' ) . " WHERE status IN ('approved','paid') GROUP BY worker_id",
			ARRAY_A
		);
		$out = array();
		foreach ( $given as $g ) {
			$out[ (int) $g['worker_id'] ] = (int) $g['v'];
		}
		foreach ( $back as $b ) {
			$id         = (int) $b['worker_id'];
			$out[ $id ] = max( 0, ( $out[ $id ] ?? 0 ) - (int) $b['v'] );
		}
		return $out;
	}

	private static function shape( $r, $owed ) {
		$daily   = 'daily' === $r['pay_basis'];
		$monthly = $daily ? (int) $r['base_pay'] * self::DEFAULT_DAYS : (int) $r['base_pay'];
		$link    = $r['user_id'] ? get_user_by( 'id', (int) $r['user_id'] ) : null;

		return array(
			'id'          => (int) $r['id'],
			'fullName'    => $r['full_name'],
			'phone'       => $r['phone'],
			'job'         => $r['job'],
			'idNumber'    => $r['id_number'],
			'startedOn'   => $r['started_on'],
			'payBasis'    => $r['pay_basis'],
			'basisLabel'  => self::BASIS[ $r['pay_basis'] ] ?? $r['pay_basis'],
			'basePay'     => (int) $r['base_pay'],
			'allowance'   => (int) $r['allowance'],
			'monthlyPay'  => $monthly + (int) $r['allowance'],
			'payMethod'   => $r['pay_method'] ?: 'cash',
			'methodLabel' => AH_Expenses::methods()[ $r['pay_method'] ?: 'cash' ] ?? $r['pay_method'],
			'payNumber'   => $r['pay_number'],
			'bankName'    => $r['bank_name'],
			'kinName'     => $r['kin_name'],
			'kinPhone'    => $r['kin_phone'],
			'address'     => $r['address'],
			'notes'       => $r['notes'],
			'status'      => $r['status'],
			'leftOn'      => $r['left_on'],
			'userId'      => $r['user_id'] ? (int) $r['user_id'] : null,
			'deskName'    => $link ? $link->display_name : null,
			'desk'        => $link ? AH_Roles::desk_of( $link ) : null,
			'advanceOwed' => (int) ( $owed[ (int) $r['id'] ] ?? 0 ),
			'createdAt'   => $r['created_at'],
		);
	}

	private static function slip( $r ) {
		return array(
			'id'               => (int) $r['id'],
			'period'           => $r['period'],
			'month'            => self::month_name( $r['period'] ),
			'workerId'         => (int) $r['worker_id'],
			'workerName'       => $r['worker_name'],
			'job'              => $r['job'],
			'payBasis'         => $r['pay_basis'],
			'rate'             => (int) $r['rate'],
			'daysWorked'       => (int) $r['days_worked'],
			'basePay'          => (int) $r['base_pay'],
			'allowance'        => (int) $r['allowance'],
			'overtime'         => (int) $r['overtime'],
			'bonus'            => (int) $r['bonus'],
			'deductions'       => (int) $r['deductions'],
			'deductionNote'    => $r['deduction_note'],
			'advanceRecovered' => (int) $r['advance_recovered'],
			'gross'            => (int) $r['gross'],
			'net'              => (int) $r['net'],
			'status'           => $r['status'],
			'statusLabel'      => self::SLIP_STATUS[ $r['status'] ] ?? $r['status'],
			'expenseId'        => $r['expense_id'] ? (int) $r['expense_id'] : null,
			'note'             => $r['note'],
			'createdAt'        => $r['created_at'],
			'approvedAt'       => $r['approved_at'],
			'paidAt'           => $r['paid_at'],
		);
	}

	/** People with a desk login, to link a worker to. */
	private static function desk_people() {
		$out = array();
		foreach ( AH_Staff::desks() as $key => $d ) {
			foreach ( get_users( array( 'role' => $d[0] ) ) as $u ) {
				$out[] = array( 'id' => $u->ID, 'name' => $u->display_name, 'desk' => $key, 'deskLabel' => $d[1], 'phone' => get_user_meta( $u->ID, 'ah_phone', true ) ?: null );
			}
		}
		return $out;
	}

	private static function column( $key ) {
		return strtolower( preg_replace( '/([a-z])([A-Z])/', '$1_$2', $key ) );
	}

	private static function row( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . AH_Install::table( 'workers' ) . ' WHERE id = %d', $id ), ARRAY_A );
	}

	private static function slip_row( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . AH_Install::table( 'payslips' ) . ' WHERE id = %d', $id ), ARRAY_A );
	}

	/** "2026-11" from whatever came in; this month if nothing sensible did. */
	private static function period( $value ) {
		$value = substr( (string) $value, 0, 7 );
		return preg_match( '/^\d{4}-(0[1-9]|1[0-2])$/', $value ) ? $value : current_time( 'Y-m' );
	}

	private static function month_name( $period ) {
		$t = strtotime( $period . '-01' );
		return $t ? date( 'F Y', $t ) : $period;
	}

	private static function log( $action, $note ) {
		$user = AH_Auth::current();
		AH_Flow::log_event( 0, 'manager', $action, null, null, $user ? $user->ID : null, $note );
	}
}
