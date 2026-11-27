<?php
/**
 * Owner approval.
 *
 * A sale on loan made by a cashier is a request until somebody allowed to
 * approve it says yes: the owner, or a staff member the owner has trusted
 * with loans up to an amount. Nobody ever approves their own request.
 * Until then nothing happens: no loan line, no receipt, no stock off the
 * shelf (the store only gives out paid orders).
 *
 * Supplier payments above the owner's limit wait the same way when a
 * manager who is not the owner records them.
 *
 * What may be done without asking is the owner's to set: per employee,
 * whether they may sell on loan at all, how much they may put on loan
 * without asking, and how much they may approve for others.
 *
 * Every request and decision is a row here and a line in History.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Approvals {

	const OPTION = 'ah_approval_policy';

	private static function t() {
		return AH_Install::table( 'approvals' );
	}

	private static function err( $code, $msg, $status = 400 ) {
		return new WP_Error( $code, $msg, array( 'status' => $status ) );
	}

	public static function routes() {
		$ns    = AH_Rest::NS;
		$desks = AH_Rest::desk( array( 'cashier', 'accounts', 'manager' ) );
		register_rest_route( $ns, '/approvals', array( 'methods' => WP_REST_Server::READABLE, 'permission_callback' => $desks, 'callback' => array( __CLASS__, 'index' ) ) );
		register_rest_route( $ns, '/approvals/(?P<id>\d+)/decide', array( 'methods' => WP_REST_Server::CREATABLE, 'permission_callback' => $desks, 'callback' => array( __CLASS__, 'decide' ) ) );
		register_rest_route( $ns, '/manager/approvals/policy', array(
			array( 'methods' => WP_REST_Server::READABLE, 'permission_callback' => AH_Rest::desk( array( 'manager' ) ), 'callback' => array( __CLASS__, 'get_policy' ) ),
			array( 'methods' => WP_REST_Server::CREATABLE, 'permission_callback' => AH_Rest::desk( array( 'manager' ) ), 'callback' => array( __CLASS__, 'save_policy' ) ),
		) );
	}

	// -----------------------------------------------------------------
	// The rules
	// -----------------------------------------------------------------

	public static function policy() {
		$p = get_option( self::OPTION );
		$p = is_array( $p ) ? $p : array();
		return array(
			'owners'           => array_values( array_map( 'intval', (array) ( $p['owners'] ?? array() ) ) ),
			'supplierPayLimit' => (int) ( $p['supplierPayLimit'] ?? 0 ),
			'staff'            => is_array( $p['staff'] ?? null ) ? $p['staff'] : array(),
		);
	}

	/**
	 * The owner. With nobody named, every manager is: that is how the
	 * shop worked before there was a list.
	 */
	public static function is_owner( $user_id ) {
		$user = get_user_by( 'id', (int) $user_id );
		if ( ! $user ) {
			return false;
		}
		$owners = self::policy()['owners'];
		if ( $owners ) {
			return in_array( (int) $user_id, $owners, true );
		}
		return 'manager' === AH_Roles::desk_of( $user ) || user_can( $user, 'manage_options' );
	}

	/** One employee's loan rights. */
	public static function rules( $user_id ) {
		$s = self::policy()['staff'][ (string) (int) $user_id ] ?? array();
		return array(
			'canRequest'  => array_key_exists( 'canRequest', $s ) ? (bool) $s['canRequest'] : true,
			'autoUpTo'    => (int) ( $s['autoUpTo'] ?? 0 ),
			'approveUpTo' => (int) ( $s['approveUpTo'] ?? 0 ),
		);
	}

	/** May this person decide this request? Never their own. */
	public static function can_decide( $user_id, $row ) {
		if ( (int) $row['requested_by'] === (int) $user_id ) {
			return false;
		}
		if ( self::is_owner( $user_id ) ) {
			return true;
		}
		return 'credit_sale' === $row['kind'] && self::rules( $user_id )['approveUpTo'] >= (int) $row['amount'];
	}

	/** Everyone who may decide a request of this kind and size. */
	private static function deciders( $kind, $amount, $except ) {
		$ids = array();
		foreach ( get_users( array( 'role__in' => array( 'ah_manager', 'ah_cashier', 'ah_accounts', 'administrator' ), 'fields' => 'ID', 'number' => 300 ) ) as $id ) {
			$id = (int) $id;
			if ( $id === (int) $except ) {
				continue;
			}
			if ( self::is_owner( $id ) || ( 'credit_sale' === $kind && self::rules( $id )['approveUpTo'] >= $amount ) ) {
				$ids[] = $id;
			}
		}
		return $ids;
	}

	public static function get_policy() {
		$p     = self::policy();
		$staff = array();
		foreach ( get_users( array( 'role__in' => array( 'ah_manager', 'ah_cashier', 'ah_accounts', 'administrator' ), 'number' => 300 ) ) as $u ) {
			$desk = AH_Roles::desk_of( $u ) ?: ( user_can( $u, 'manage_options' ) ? 'manager' : null );
			if ( ! $desk || 'store' === $desk ) {
				continue;
			}
			$staff[] = array_merge( array(
				'id'    => (int) $u->ID,
				'name'  => $u->display_name,
				'desk'  => $desk,
				'owner' => self::is_owner( $u->ID ),
			), self::rules( $u->ID ) );
		}
		$me = AH_Auth::current();
		return array(
			'owners'           => $p['owners'],
			'supplierPayLimit' => $p['supplierPayLimit'],
			'staff'            => $staff,
			'canEdit'          => $me && self::is_owner( $me->ID ),
		);
	}

	/** Only the owner changes the rules. */
	public static function save_policy( $req ) {
		$me = AH_Auth::current();
		if ( ! $me || ! self::is_owner( $me->ID ) ) {
			return self::err( 'ah_owner_only', 'Only the owner can change who may sell on loan.', 403 );
		}
		$old    = self::policy();
		$owners = array_values( array_filter( array_map( 'intval', (array) $req->get_param( 'owners' ) ) ) );
		// The owner cannot lock themselves out.
		if ( $owners && ! in_array( (int) $me->ID, $owners, true ) ) {
			$owners[] = (int) $me->ID;
		}
		$staff = array();
		foreach ( (array) $req->get_param( 'staff' ) as $s ) {
			$id = (int) ( $s['id'] ?? 0 );
			if ( ! $id ) {
				continue;
			}
			$staff[ (string) $id ] = array(
				'canRequest'  => ! empty( $s['canRequest'] ),
				'autoUpTo'    => max( 0, (int) ( $s['autoUpTo'] ?? 0 ) ),
				'approveUpTo' => max( 0, (int) ( $s['approveUpTo'] ?? 0 ) ),
			);
		}
		update_option( self::OPTION, array(
			'owners'           => $owners,
			'supplierPayLimit' => max( 0, (int) $req->get_param( 'supplierPayLimit' ) ),
			'staff'            => $staff ?: $old['staff'],
		), false );
		AH_Flow::log_event( 0, 'manager', 'approval_rules', null, null, $me->ID, 'Loan and payment approval rules changed' );
		return self::get_policy();
	}

	// -----------------------------------------------------------------
	// Asking
	// -----------------------------------------------------------------

	private static function pending_for( $kind, $ref_id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t() . " WHERE kind = %s AND ref_id = %d AND status = 'pending' LIMIT 1", $kind, $ref_id ), ARRAY_A );
	}

	/**
	 * Called by the cashier's payment before a sale goes on loan. Null:
	 * carry on. An array: the request was made and waits. WP_Error: no.
	 */
	public static function credit_gate( $order, $args, $by, $on_loan ) {
		if ( ! empty( $args['approved'] ) ) {
			return null;
		}
		if ( self::is_owner( $by ) ) {
			return null;
		}
		$rules = self::rules( $by );
		if ( ! $rules['canRequest'] ) {
			return self::err( 'ah_no_loan_right', 'You are not allowed to sell on loan. Take cash, or ask the owner.', 403 );
		}
		if ( self::pending_for( 'credit_sale', $order->get_id() ) ) {
			return self::err( 'ah_waiting', 'This loan is already waiting for the owner.', 409 );
		}
		$customer = (int) $order->get_customer_id();
		if ( ! $customer || ! AH_Credit::account( $customer ) ) {
			return self::err( 'ah_no_account', 'This customer has no loan account. The manager opens one first.', 409 );
		}
		// Small and within the customer's limit: the cashier may finish it.
		if ( $on_loan <= $rules['autoUpTo'] && 0 === AH_Credit::to_pay_first( $customer, $on_loan ) ) {
			return null;
		}
		return self::ask( 'credit_sale', $order->get_id(), $customer, get_user_by( 'id', $customer )->display_name, $on_loan, $by, array(
			'method'      => 'credit',
			'paid_now'    => (int) ( $args['paid_now'] ?? 0 ),
			'paid_method' => (string) ( $args['paid_method'] ?? 'cash' ),
			'paid_ref'    => (string) ( $args['paid_ref'] ?? '' ),
			'total'       => AH_Shape::money( $order->get_total() ),
			'orderNo'     => AH_Shape::order_no( $order ),
		), $order );
	}

	/** A manager who is not the owner paying a supplier above the limit. */
	public static function supplier_gate( $bill, $amount, $payload, $by ) {
		if ( ! empty( $payload['approved'] ) || self::is_owner( $by ) || $amount <= self::policy()['supplierPayLimit'] ) {
			return null;
		}
		if ( self::pending_for( 'supplier_payment', (int) $bill['id'] ) ) {
			return self::err( 'ah_waiting', 'A payment on this bill is already waiting for the owner.', 409 );
		}
		return self::ask( 'supplier_payment', (int) $bill['id'], 0, $bill['supplier'] . ' · ' . $bill['invoice_no'], $amount, $by, $payload, null );
	}

	private static function ask( $kind, $ref_id, $party_id, $party_name, $amount, $by, $payload, $order ) {
		global $wpdb;
		$who  = get_user_by( 'id', (int) $by );
		$snap = array();
		if ( 'credit_sale' === $kind ) {
			$s    = AH_Credit::summary( $party_id );
			$snap = array( 'owed' => $s['owed'], 'limit' => $s['limit'], 'overdue' => $s['overdue'], 'available' => $s['available'] );
		}
		$wpdb->insert( self::t(), array(
			'kind'           => $kind,
			'status'         => 'pending',
			'ref_id'         => (int) $ref_id,
			'party_id'       => (int) $party_id,
			'party_name'     => $party_name,
			'amount'         => (int) $amount,
			'payload'        => wp_json_encode( $payload ),
			'snapshot'       => wp_json_encode( $snap ),
			'requested_by'   => (int) $by,
			'requested_name' => $who ? $who->display_name : '',
			'requested_at'   => current_time( 'mysql' ),
		) );
		$id = (int) $wpdb->insert_id;
		$what = 'credit_sale' === $kind
			? sprintf( '%s wants UGX %s on loan for %s (%s)', $who ? $who->display_name : 'Staff', number_format( $amount ), $party_name, $payload['orderNo'] ?? '' )
			: sprintf( '%s wants to pay %s UGX %s', $who ? $who->display_name : 'Staff', $party_name, number_format( $amount ) );
		AH_Flow::log_event( $order ? $order->get_id() : 0, 'manager', 'approval_requested', null, null, (int) $by, '#' . $id . ' · ' . $what );
		if ( $order ) {
			$order->update_meta_data( '_ah_credit_approval', array( 'id' => $id, 'status' => 'pending', 'by' => $who ? $who->display_name : '', 'at' => current_time( 'mysql' ) ) );
			$order->save();
		}
		if ( class_exists( 'AH_Push' ) ) {
			AH_Push::send( self::deciders( $kind, $amount, $by ), 'credit_sale' === $kind ? 'Loan to approve' : 'Payment to approve', $what, array( 'kind' => 'approval', 'id' => $id ) );
		}
		return array( 'pending' => true, 'approval' => self::shape( self::row( $id ) ) );
	}

	// -----------------------------------------------------------------
	// Deciding
	// -----------------------------------------------------------------

	private static function row( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t() . ' WHERE id = %d', (int) $id ), ARRAY_A );
	}

	public static function decide( $req ) {
		global $wpdb;
		$me      = AH_Auth::current();
		$row     = self::row( (int) $req['id'] );
		$approve = filter_var( $req->get_param( 'approve' ), FILTER_VALIDATE_BOOLEAN );
		$note    = trim( sanitize_textarea_field( (string) $req->get_param( 'note' ) ) );
		if ( ! $row ) {
			return self::err( 'ah_not_found', 'That request was not found', 404 );
		}
		if ( 'pending' !== $row['status'] ) {
			return self::err( 'ah_decided', 'This request has already been decided.', 409 );
		}
		if ( (int) $row['requested_by'] === (int) $me->ID ) {
			return self::err( 'ah_own_request', 'You cannot approve your own request. The owner decides it.', 403 );
		}
		if ( ! self::can_decide( $me->ID, $row ) ) {
			return self::err( 'ah_not_allowed', 'This is above what you may approve. The owner decides it.', 403 );
		}
		if ( ! $approve && mb_strlen( $note ) < 3 ) {
			return self::err( 'ah_need_reason', 'Say why it is refused. The cashier reads this.' );
		}
		$payload = json_decode( (string) $row['payload'], true ) ?: array();
		$done    = '';

		if ( $approve ) {
			if ( 'credit_sale' === $row['kind'] ) {
				// The sale is finished as the cashier who asked, so the
				// receipt and the loan carry their name; the approval
				// carries the owner's.
				$out = AH_Flow::receive_payment( (int) $row['ref_id'], array_merge( $payload, array( 'approved' => true ) ), (int) $row['requested_by'] );
				if ( is_wp_error( $out ) ) {
					return $out;
				}
				$done = $out['payment']['receipt_no'] ?? '';
			} else {
				$bill = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . AH_Install::table( 'supplier_bills' ) . ' WHERE id = %d', (int) $row['ref_id'] ), ARRAY_A );
				if ( ! $bill ) {
					return self::err( 'ah_not_found', 'That bill is gone', 404 );
				}
				$out = AH_Purchasing::record_payment( $bill, (int) $row['amount'], (string) ( $payload['method'] ?? 'bank' ), (string) ( $payload['ref'] ?? '' ), (string) ( $payload['date'] ?? current_time( 'Y-m-d' ) ), get_user_by( 'id', (int) $row['requested_by'] ) );
				if ( is_wp_error( $out ) ) {
					return $out;
				}
			}
		}

		$wpdb->update( self::t(), array(
			'status'       => $approve ? 'approved' : 'rejected',
			'decided_by'   => (int) $me->ID,
			'decided_name' => $me->display_name,
			'decided_at'   => current_time( 'mysql' ),
			'note'         => $note ?: null,
			'done_ref'     => $done ?: null,
		), array( 'id' => (int) $row['id'] ) );

		$order = 'credit_sale' === $row['kind'] ? wc_get_order( (int) $row['ref_id'] ) : null;
		if ( $order ) {
			$order->update_meta_data( '_ah_credit_approval', array(
				'id' => (int) $row['id'], 'status' => $approve ? 'approved' : 'rejected', 'by' => $me->display_name,
				'at' => current_time( 'mysql' ), 'note' => $note,
			) );
			$order->save();
		}
		$what = sprintf( '#%d %s by %s: %s UGX %s%s', $row['id'], $approve ? 'approved' : 'refused', $me->display_name, $row['party_name'], number_format( (int) $row['amount'] ), $note ? ' · ' . $note : '' );
		AH_Flow::log_event( $order ? $order->get_id() : 0, 'manager', $approve ? 'approval_approved' : 'approval_rejected', null, null, $me->ID, $what );
		if ( class_exists( 'AH_Push' ) ) {
			AH_Push::send( array( (int) $row['requested_by'] ), $approve ? 'Approved' : 'Refused', $what, array( 'kind' => 'approval', 'id' => (int) $row['id'] ) );
		}
		return array( 'approval' => self::shape( self::row( (int) $row['id'] ), $me->ID ) );
	}

	/** A paid order no longer needs its loan request. */
	public static function withdraw_for_order( $order_id, $why ) {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( 'UPDATE ' . self::t() . " SET status = 'withdrawn', note = %s, decided_at = %s WHERE kind = 'credit_sale' AND ref_id = %d AND status = 'pending'", $why, current_time( 'mysql' ), $order_id ) );
	}

	// -----------------------------------------------------------------
	// Reading
	// -----------------------------------------------------------------

	private static function shape( $r, $viewer = 0 ) {
		if ( ! $r ) {
			return null;
		}
		$payload = json_decode( (string) $r['payload'], true ) ?: array();
		$snap    = json_decode( (string) $r['snapshot'], true ) ?: array();
		$out     = array(
			'id'          => (int) $r['id'],
			'kind'        => $r['kind'],
			'status'      => $r['status'],
			'amount'      => (int) $r['amount'],
			'partyId'     => (int) $r['party_id'],
			'partyName'   => $r['party_name'],
			'refId'       => (int) $r['ref_id'],
			'orderNo'     => $payload['orderNo'] ?? null,
			'total'       => (int) ( $payload['total'] ?? 0 ),
			'paidNow'     => (int) ( $payload['paid_now'] ?? 0 ),
			'method'      => $payload['method'] ?? null,
			'ref'         => $payload['ref'] ?? null,
			'atRequest'   => $snap,
			'requestedBy' => $r['requested_name'],
			'requestedAt' => $r['requested_at'],
			'decidedBy'   => $r['decided_name'],
			'decidedAt'   => $r['decided_at'],
			'note'        => $r['note'],
			'receipt'     => $r['done_ref'],
			'mine'        => $viewer && (int) $r['requested_by'] === (int) $viewer,
			'canDecide'   => $viewer && 'pending' === $r['status'] && self::can_decide( $viewer, $r ),
		);
		if ( 'credit_sale' === $r['kind'] && 'pending' === $r['status'] && $r['party_id'] ) {
			// What the owner needs to decide: the account now, and how
			// this customer has paid before.
			$s = AH_Credit::summary( (int) $r['party_id'] );
			$out['customer'] = array(
				'phone' => $s['phone'], 'owed' => $s['owed'], 'limit' => $s['limit'], 'overdue' => $s['overdue'],
				'available' => $s['available'], 'status' => $s['status'], 'oldestDays' => $s['oldestDays'],
				'after' => $s['owed'] + (int) $r['amount'],
			);
			$out['history'] = array_values( array_slice( array_filter( AH_Credit::statement( (int) $r['party_id'], 60 ), function ( $l ) {
				return in_array( $l['kind'], array( 'payment', 'sale' ), true );
			} ), 0, 8 ) );
			$out['paidIn90'] = array_sum( array_map( function ( $l ) {
				return 'payment' === $l['kind'] && $l['date'] >= gmdate( 'Y-m-d', time() - 90 * DAY_IN_SECONDS ) ? $l['credit'] : 0;
			}, AH_Credit::statement( (int) $r['party_id'], 500 ) ) );
		}
		return $out;
	}

	/** The lists. Deciders see everything; others see what they asked. */
	public static function index( $req ) {
		global $wpdb;
		$me     = AH_Auth::current();
		$status = in_array( $req->get_param( 'status' ), array( 'pending', 'approved', 'rejected', 'withdrawn', 'all' ), true ) ? $req->get_param( 'status' ) : 'pending';
		$decider = self::is_owner( $me->ID ) || self::rules( $me->ID )['approveUpTo'] > 0;
		$where  = $decider ? '1=1' : $wpdb->prepare( 'requested_by = %d', $me->ID );
		$sql    = 'SELECT * FROM ' . self::t() . " WHERE {$where}" . ( 'all' === $status ? '' : $wpdb->prepare( ' AND status = %s', $status ) );
		$rows   = (array) $wpdb->get_results( $sql . ' ORDER BY ' . ( 'pending' === $status ? 'id ASC' : 'id DESC' ) . ' LIMIT 200', ARRAY_A );
		$counts = array();
		foreach ( (array) $wpdb->get_results( 'SELECT status, COUNT(*) n, SUM(amount) a FROM ' . self::t() . " WHERE {$where} GROUP BY status", ARRAY_A ) as $c ) {
			$counts[ $c['status'] ] = array( 'count' => (int) $c['n'], 'amount' => (int) $c['a'] );
		}
		return array(
			'status'    => $status,
			'counts'    => $counts,
			'decider'   => $decider,
			'owner'     => self::is_owner( $me->ID ),
			'approvals' => array_map( function ( $r ) use ( $me ) {
				return self::shape( $r, $me->ID );
			}, $rows ),
		);
	}
}
