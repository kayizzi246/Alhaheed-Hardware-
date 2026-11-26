<?php
/**
 * Closing the till, and who did what out of the ordinary.
 *
 * At closing the cashier counts the cash in the drawer. The book already
 * knows what should be there: the cash they took less the cash they paid
 * out, from the cash book. The difference is over or short, kept under
 * their name, and a difference needs a word of explanation. A close
 * cannot be redone: a second count after the first did not match is how
 * a shortage gets tidied away.
 *
 * The exceptions report puts each person's unusual moves side by side
 * for a period: cancellations, rejected payments, overrides, write-offs,
 * price changes, till differences. Patterns stand out there that no
 * single record shows.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Till {

	public static function routes() {
		$ns   = AH_Rest::NS;
		$get  = WP_REST_Server::READABLE;
		$post = WP_REST_Server::CREATABLE;
		register_rest_route( $ns, '/cashier/close', array(
			array(
				'methods'             => $get,
				'permission_callback' => AH_Rest::desk( array( 'cashier', 'manager' ) ),
				'callback'            => array( __CLASS__, 'mine' ),
			),
			array(
				'methods'             => $post,
				'permission_callback' => AH_Rest::desk( array( 'cashier', 'manager' ) ),
				'callback'            => array( __CLASS__, 'close' ),
			),
		) );
		foreach ( array( '/manager/tills' => 'tills', '/manager/exceptions' => 'exceptions' ) as $path => $cb ) {
			register_rest_route( $ns, $path, array(
				'methods'             => $get,
				'permission_callback' => AH_Rest::desk( array( 'manager' ) ),
				'callback'            => array( __CLASS__, $cb ),
			) );
		}
	}

	private static function err( $code, $msg, $status = 400 ) {
		return new WP_Error( $code, $msg, array( 'status' => $status ) );
	}

	/** What should be in this cashier's drawer for the day. */
	public static function expected( $user_id, $date ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare(
			'SELECT COALESCE(SUM(cash_in - cash_out),0) FROM ' . AH_Install::table( 'cash_book' ) . " WHERE recorded_by = %d AND entry_date = %s AND method = 'cash'",
			$user_id, $date
		) );
	}

	private static function closed( $user_id, $date ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . AH_Install::table( 'till_closes' ) . ' WHERE cashier_id = %d AND close_date = %s', $user_id, $date ), ARRAY_A );
	}

	private static function shape( $r ) {
		return array(
			'id'        => (int) $r['id'],
			'date'      => $r['close_date'],
			'cashier'   => $r['cashier_name'],
			'expected'  => (int) $r['expected'],
			'counted'   => (int) $r['counted'],
			'overShort' => (int) $r['over_short'],
			'note'      => (string) $r['note'],
			'at'        => $r['created_at'],
		);
	}

	public static function mine( $req ) {
		$me   = AH_Auth::current();
		$date = current_time( 'Y-m-d' );
		$done = self::closed( $me->ID, $date );
		return array(
			'date'     => $date,
			// Shown only once the drawer is counted: a cashier who can see
			// the figure first can simply count to it.
			'expected' => $done ? self::expected( $me->ID, $date ) : null,
			'close'    => $done ? self::shape( $done ) : null,
		);
	}

	public static function close( $req ) {
		global $wpdb;
		$me      = AH_Auth::current();
		$date    = current_time( 'Y-m-d' );
		$counted = $req->get_param( 'counted' );
		$note    = trim( sanitize_textarea_field( (string) $req->get_param( 'note' ) ) );
		if ( null === $counted || '' === $counted || (int) $counted < 0 ) {
			return self::err( 'ah_no_count', 'Count the cash in the drawer and enter the total' );
		}
		if ( self::closed( $me->ID, $date ) ) {
			return self::err( 'ah_closed', 'Today is already closed. A count cannot be changed after it is entered.', 409 );
		}
		$expected = self::expected( $me->ID, $date );
		$diff     = AH_Stock_Math::over_short( $expected, (int) $counted );
		if ( 0 !== $diff && mb_strlen( $note ) < 5 ) {
			return new WP_Error( 'ah_explain', sprintf( 'The drawer is %s %s. Say why before closing.', 0 > $diff ? 'short by' : 'over by', 'UGX ' . number_format( abs( $diff ) ) ), array( 'status' => 400, 'overShort' => $diff ) );
		}
		$wpdb->insert( AH_Install::table( 'till_closes' ), array(
			'close_date'   => $date,
			'cashier_id'   => (int) $me->ID,
			'cashier_name' => $me->display_name,
			'expected'     => $expected,
			'counted'      => (int) $counted,
			'over_short'   => $diff,
			'note'         => $note,
			'created_at'   => current_time( 'mysql' ),
		) );
		AH_Flow::log_event( 0, 'cashier', 'till_closed', null, null, $me->ID,
			sprintf( 'Counted UGX %s, expected UGX %s%s', number_format( (int) $counted ), number_format( $expected ), $diff ? ( $diff < 0 ? ', SHORT ' : ', over ' ) . number_format( abs( $diff ) ) : ', exact' ) );
		return array( 'close' => self::shape( self::closed( $me->ID, $date ) ), 'expected' => $expected );
	}

	private static function range( $req ) {
		$to   = (string) $req->get_param( 'to' );
		$from = (string) $req->get_param( 'from' );
		$to   = preg_match( '/^\d{4}-\d{2}-\d{2}$/', $to ) ? $to : current_time( 'Y-m-d' );
		$from = preg_match( '/^\d{4}-\d{2}-\d{2}$/', $from ) ? $from : gmdate( 'Y-m-d', strtotime( $to . ' -30 days' ) );
		return array( $from, $to );
	}

	public static function tills( $req ) {
		global $wpdb;
		list( $from, $to ) = self::range( $req );
		$rows = (array) $wpdb->get_results( $wpdb->prepare(
			'SELECT * FROM ' . AH_Install::table( 'till_closes' ) . ' WHERE close_date BETWEEN %s AND %s ORDER BY close_date DESC, id DESC',
			$from, $to
		), ARRAY_A );
		// Days a cashier took cash and never closed.
		$open = (array) $wpdb->get_results( $wpdb->prepare(
			'SELECT cb.entry_date AS d, cb.recorded_by AS u, SUM(cb.cash_in - cb.cash_out) AS expected
			   FROM ' . AH_Install::table( 'cash_book' ) . ' cb
			   LEFT JOIN ' . AH_Install::table( 'till_closes' ) . " tc ON tc.close_date = cb.entry_date AND tc.cashier_id = cb.recorded_by
			  WHERE cb.method = 'cash' AND cb.entry_date BETWEEN %s AND %s AND cb.entry_date < %s AND tc.id IS NULL AND cb.recorded_by > 0
			  GROUP BY cb.entry_date, cb.recorded_by HAVING SUM(cb.cash_in) > 0",
			$from, $to, current_time( 'Y-m-d' )
		), ARRAY_A );
		$not_closed = array();
		foreach ( $open as $o ) {
			$u            = get_user_by( 'id', (int) $o['u'] );
			$not_closed[] = array( 'date' => $o['d'], 'cashier' => $u ? $u->display_name : 'Unknown', 'expected' => (int) $o['expected'] );
		}
		return array(
			'from'      => $from,
			'to'        => $to,
			'closes'    => array_map( array( __CLASS__, 'shape' ), $rows ),
			'notClosed' => $not_closed,
			'short'     => array_sum( array_map( function ( $r ) { return min( 0, (int) $r['over_short'] ); }, $rows ) ),
			'over'      => array_sum( array_map( function ( $r ) { return max( 0, (int) $r['over_short'] ); }, $rows ) ),
		);
	}

	/** Each person's unusual moves over a period, side by side. */
	public static function exceptions( $req ) {
		global $wpdb;
		list( $from, $to ) = self::range( $req );
		$end = $to . ' 23:59:59';
		$people = array();
		$add = function ( $uid, $name, $key, $n = 1, $value = 0 ) use ( &$people ) {
			$uid = (int) $uid;
			if ( ! isset( $people[ $uid ] ) ) {
				$u               = $uid ? get_user_by( 'id', $uid ) : null;
				$people[ $uid ]  = array(
					'userId'      => $uid,
					'name'        => $u ? $u->display_name : ( $uid ? ( $name ?: 'Unknown' ) : 'System' ),
					'desk'        => $u ? ( AH_Roles::desk_of( $u ) ?: ( in_array( 'customer', (array) $u->roles, true ) ? 'customer' : 'left' ) ) : '',
					'cancelled'   => 0,
					'rejected'    => 0,
					'overrides'   => 0,
					'writeOffs'   => 0,
					'writeOffValue' => 0,
					'priceChanges'=> 0,
					'deleted'     => 0,
					'tillShort'   => 0,
					'tillOver'    => 0,
					'partReleases'=> 0,
				);
			}
			$people[ $uid ][ $key ] += $n;
			if ( $value ) {
				$people[ $uid ][ $key . 'Value' ] = ( $people[ $uid ][ $key . 'Value' ] ?? 0 ) + $value;
			}
		};

		$ev = AH_Install::table( 'events' );
		foreach ( (array) $wpdb->get_results( $wpdb->prepare(
			"SELECT handled_by, handler_name, action, COUNT(*) AS n FROM {$ev}
			  WHERE created_at BETWEEN %s AND %s AND action IN ('cancelled','price_changed','products_deleted','part_released')
			  GROUP BY handled_by, handler_name, action",
			$from, $end
		), ARRAY_A ) as $r ) {
			$key = array( 'cancelled' => 'cancelled', 'price_changed' => 'priceChanges', 'products_deleted' => 'deleted', 'part_released' => 'partReleases' )[ $r['action'] ];
			$add( $r['handled_by'], $r['handler_name'], $key, (int) $r['n'] );
		}
		// A rejected payment counts against the cashier who took it.
		foreach ( (array) $wpdb->get_results( $wpdb->prepare(
			'SELECT cashier_id, cashier_name, COUNT(*) AS n FROM ' . AH_Install::table( 'payments' ) . ' WHERE verified = -1 AND created_at BETWEEN %s AND %s GROUP BY cashier_id, cashier_name',
			$from, $end
		), ARRAY_A ) as $r ) {
			$add( $r['cashier_id'], $r['cashier_name'], 'rejected', (int) $r['n'] );
		}
		foreach ( (array) $wpdb->get_results( $wpdb->prepare(
			'SELECT user_id, user_name, COUNT(*) AS n FROM ' . AH_Install::table( 'overrides' ) . ' WHERE created_at BETWEEN %s AND %s GROUP BY user_id, user_name',
			$from, $end
		), ARRAY_A ) as $r ) {
			$add( $r['user_id'], $r['user_name'], 'overrides', (int) $r['n'] );
		}
		foreach ( (array) $wpdb->get_results( $wpdb->prepare(
			'SELECT user_id, user_name, COUNT(*) AS n, SUM(-qty * unit_cost) AS v FROM ' . AH_Install::table( 'stock_moves' ) . "
			  WHERE ( kind IN ('damaged','own_use') OR ( kind IN ('count','correction') AND qty < 0 AND COALESCE(note,'') NOT LIKE 'Count deleted%' ) )
			    AND COALESCE(moved_on, DATE(created_at)) BETWEEN %s AND %s
			  GROUP BY user_id, user_name",
			$from, $to
		), ARRAY_A ) as $r ) {
			$add( $r['user_id'], $r['user_name'], 'writeOffs', (int) $r['n'] );
			$people[ (int) $r['user_id'] ]['writeOffValue'] += (int) $r['v'];
		}
		foreach ( (array) $wpdb->get_results( $wpdb->prepare(
			'SELECT cashier_id, cashier_name, SUM(CASE WHEN over_short < 0 THEN over_short ELSE 0 END) AS s, SUM(CASE WHEN over_short > 0 THEN over_short ELSE 0 END) AS o
			   FROM ' . AH_Install::table( 'till_closes' ) . ' WHERE close_date BETWEEN %s AND %s GROUP BY cashier_id, cashier_name',
			$from, $to
		), ARRAY_A ) as $r ) {
			$add( $r['cashier_id'], $r['cashier_name'], 'tillShort', (int) $r['s'] );
			$people[ (int) $r['cashier_id'] ]['tillOver'] += (int) $r['o'];
		}

		$list = array_values( $people );
		usort( $list, function ( $a, $b ) {
			$score = function ( $p ) {
				return $p['cancelled'] + 2 * $p['rejected'] + 2 * $p['overrides'] + $p['writeOffs'] + ( $p['tillShort'] < 0 ? 3 : 0 );
			};
			return $score( $b ) <=> $score( $a );
		} );
		return array( 'from' => $from, 'to' => $to, 'people' => $list );
	}
}
