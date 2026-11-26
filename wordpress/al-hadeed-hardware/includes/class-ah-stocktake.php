<?php
/**
 * The stock-take: counting what is really on the shelf.
 *
 * The book says what should be there. A count says what is. The manager
 * opens a count for a date, enters what was counted item by item (each
 * line keeps the book figure at the moment it was entered, so later
 * sales do not change what the variance meant), and approves it. Only
 * then is each difference posted to the stock book as an adjustment
 * marked "stock count". A draft changes nothing.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Stocktake {

	public static function routes() {
		$ns      = AH_Rest::NS;
		$manager = AH_Rest::desk( array( 'manager' ) );
		$get     = WP_REST_Server::READABLE;
		$post    = WP_REST_Server::CREATABLE;

		$route = function ( $path, $methods, $cb ) use ( $ns, $manager ) {
			register_rest_route( $ns, $path, array(
				'methods'             => $methods,
				'permission_callback' => $manager,
				'callback'            => array( __CLASS__, $cb ),
			) );
		};
		$route( '/manager/stocktakes', $get, 'index' );
		$route( '/manager/stocktakes/start', $post, 'start' );
		$route( '/manager/stocktakes/(?P<id>\d+)', $get, 'show' );
		$route( '/manager/stocktakes/(?P<id>\d+)/lines', $post, 'save_lines' );
		$route( '/manager/stocktakes/(?P<id>\d+)/approve', $post, 'approve' );
		$route( '/manager/stocktakes/(?P<id>\d+)/delete', $post, 'remove' );
	}

	private static function t( $n ) {
		return AH_Install::table( $n );
	}

	private static function err( $code, $msg, $status = 400 ) {
		return new WP_Error( $code, $msg, array( 'status' => $status ) );
	}

	private static function head( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'stock_counts' ) . ' WHERE id = %d', $id ), ARRAY_A );
	}

	private static function totals( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare(
			'SELECT COUNT(*) AS lines_counted,
			        SUM(CASE WHEN variance <> 0 THEN 1 ELSE 0 END) AS differ,
			        COALESCE(SUM(CASE WHEN variance < 0 THEN variance_value ELSE 0 END),0) AS short_value,
			        COALESCE(SUM(CASE WHEN variance > 0 THEN variance_value ELSE 0 END),0) AS over_value,
			        COALESCE(SUM(variance_value),0) AS net_value
			   FROM ' . self::t( 'stock_count_lines' ) . ' WHERE count_id = %d',
			$id
		), ARRAY_A );
	}

	private static function shape( $h ) {
		$t = self::totals( (int) $h['id'] );
		return array(
			'id'           => (int) $h['id'],
			'date'         => $h['count_date'],
			'status'       => $h['status'],
			'note'         => (string) $h['note'],
			'createdBy'    => (string) $h['created_name'],
			'approvedBy'   => (string) $h['approved_name'],
			'approvedAt'   => $h['approved_at'],
			'createdAt'    => $h['created_at'],
			'counted'      => (int) $t['lines_counted'],
			'differ'       => (int) $t['differ'],
			'shortValue'   => (int) $t['short_value'],
			'overValue'    => (int) $t['over_value'],
			'netValue'     => (int) $t['net_value'],
		);
	}

	public static function index() {
		global $wpdb;
		$rows = $wpdb->get_results( 'SELECT * FROM ' . self::t( 'stock_counts' ) . " WHERE status <> 'deleted' ORDER BY count_date DESC, id DESC LIMIT 100", ARRAY_A );
		return array( 'counts' => array_map( array( __CLASS__, 'shape' ), (array) $rows ) );
	}

	public static function start( $req ) {
		global $wpdb;
		$date = (string) $req->get_param( 'date' );
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) || $date > current_time( 'Y-m-d' ) ) {
			return self::err( 'ah_bad_date', 'Pick the day of the count. It cannot be in the future.' );
		}
		$open = (int) $wpdb->get_var( 'SELECT id FROM ' . self::t( 'stock_counts' ) . " WHERE status = 'draft' LIMIT 1" );
		if ( $open ) {
			return self::err( 'ah_count_open', 'A count is already open. Finish or delete it first.', 409 );
		}
		$user = AH_Auth::current();
		$wpdb->insert( self::t( 'stock_counts' ), array(
			'count_date'   => $date,
			'status'       => 'draft',
			'note'         => trim( sanitize_textarea_field( (string) $req->get_param( 'note' ) ) ),
			'created_by'   => (int) $user->ID,
			'created_name' => $user->display_name,
			'created_at'   => current_time( 'mysql' ),
		) );
		return array( 'count' => self::shape( self::head( (int) $wpdb->insert_id ) ) );
	}

	/** The count, and every item with its book figure and what was counted. */
	public static function show( $req ) {
		global $wpdb;
		$h = self::head( (int) $req['id'] );
		if ( ! $h ) {
			return self::err( 'ah_not_found', 'That count was not found', 404 );
		}
		$lines = array();
		foreach ( (array) $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'stock_count_lines' ) . ' WHERE count_id = %d', $h['id'] ), ARRAY_A ) as $l ) {
			$lines[ (int) $l['product_id'] ] = $l;
		}

		$items = array();
		foreach ( AH_Ledger::items() as $i ) {
			$l       = $lines[ $i['id'] ] ?? null;
			$items[] = array(
				'id'          => $i['id'],
				'name'        => $i['name'],
				'code'        => $i['code'],
				'category'    => $i['category'],
				'unit'        => $i['unit'],
				'cost'        => $i['cost'],
				'bookNow'     => $i['book'],
				'bookAtCount' => $l ? (float) $l['book_qty'] : null,
				'counted'     => $l ? (float) $l['counted_qty'] : null,
				'variance'    => $l ? (float) $l['variance'] : null,
				'varianceValue' => $l ? (int) $l['variance_value'] : null,
			);
			unset( $lines[ $i['id'] ] );
		}
		// A counted item that has since been deleted still shows.
		foreach ( $lines as $pid => $l ) {
			$items[] = array(
				'id' => $pid, 'name' => $l['product_name'], 'code' => '', 'category' => '', 'unit' => '',
				'cost' => (int) $l['unit_cost'], 'bookNow' => null, 'bookAtCount' => (int) $l['book_qty'],
				'counted' => (float) $l['counted_qty'], 'variance' => (float) $l['variance'], 'varianceValue' => (int) $l['variance_value'],
			);
		}

		return array( 'count' => self::shape( $h ), 'items' => $items );
	}

	/**
	 * Save counted figures. Each takes the book stock as it stands right
	 * now; a blank figure takes the item off the count.
	 */
	public static function save_lines( $req ) {
		global $wpdb;
		$h = self::head( (int) $req['id'] );
		if ( ! $h ) {
			return self::err( 'ah_not_found', 'That count was not found', 404 );
		}
		if ( 'draft' !== $h['status'] ) {
			return self::err( 'ah_count_closed', 'This count is approved. Start a new one to count again.', 409 );
		}
		$user  = AH_Auth::current();
		$table = self::t( 'stock_count_lines' );
		$saved = 0;
		foreach ( (array) $req->get_param( 'lines' ) as $line ) {
			$pid = isset( $line['productId'] ) ? (int) $line['productId'] : 0;
			if ( ! $pid ) {
				continue;
			}
			$raw = isset( $line['counted'] ) ? $line['counted'] : null;
			if ( null === $raw || '' === $raw ) {
				$wpdb->delete( $table, array( 'count_id' => (int) $h['id'], 'product_id' => $pid ) );
				continue;
			}
			$counted = round( (float) $raw, 2 );
			if ( $counted < 0 ) {
				return self::err( 'ah_bad_qty', 'A count cannot be below zero' );
			}
			$product = wc_get_product( $pid );
			if ( ! $product ) {
				continue;
			}
			$book = AH_Ledger::book( $pid );
			$cost = AH_Stock::cost_of( $pid );
			$var  = round( $counted - $book, 2 );
			$wpdb->query( $wpdb->prepare(
				"INSERT INTO {$table} (count_id, product_id, product_name, book_qty, counted_qty, variance, unit_cost, variance_value, counted_by, counted_at)
				 VALUES (%d, %d, %s, %f, %f, %f, %d, %d, %d, %s)
				 ON DUPLICATE KEY UPDATE book_qty = VALUES(book_qty), counted_qty = VALUES(counted_qty), variance = VALUES(variance),
				   unit_cost = VALUES(unit_cost), variance_value = VALUES(variance_value), counted_by = VALUES(counted_by), counted_at = VALUES(counted_at)",
				$h['id'], $pid, $product->get_name(), $book, $counted, $var, $cost, (int) round( $var * $cost ), $user->ID, current_time( 'mysql' )
			) );
			++$saved;
		}
		return array( 'saved' => $saved ) + self::show( $req );
	}

	/** Post every difference to the stock book, dated the day of the count. */
	public static function approve( $req ) {
		global $wpdb;
		$h = self::head( (int) $req['id'] );
		if ( ! $h ) {
			return self::err( 'ah_not_found', 'That count was not found', 404 );
		}
		if ( 'draft' !== $h['status'] ) {
			return self::err( 'ah_count_closed', 'This count is already approved', 409 );
		}
		$lines = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'stock_count_lines' ) . ' WHERE count_id = %d', $h['id'] ), ARRAY_A );
		if ( ! $lines ) {
			return self::err( 'ah_count_empty', 'Nothing has been counted yet' );
		}

		$posted = 0;
		foreach ( $lines as $l ) {
			$product = wc_get_product( (int) $l['product_id'] );
			if ( ! $product ) {
				continue;
			}
			if ( abs( (float) $l['variance'] ) >= 0.005 ) {
				AH_Stock::adjust( $product, (float) $l['variance'], 'count', array(
					'note'      => 'stock count' . ( $h['note'] ? ': ' . $h['note'] : '' ),
					'ref'       => 'Count #' . $h['id'],
					'moved_on'  => $h['count_date'],
					'count_id'  => (int) $h['id'],
					'unit_cost' => (int) $l['unit_cost'],
				) );
				++$posted;
			}
			// The count is the truth: the shop's own figure is set to the
			// book, so any drift from before is settled here too.
			$product = wc_get_product( (int) $l['product_id'] );
			if ( ! $product->get_manage_stock() ) {
				$product->set_manage_stock( true );
				$product->save();
			}
			wc_update_product_stock( $product, AH_Ledger::book( $product->get_id() ), 'set' );
		}

		$user = AH_Auth::current();
		$wpdb->update( self::t( 'stock_counts' ), array(
			'status'        => 'approved',
			'approved_by'   => (int) $user->ID,
			'approved_name' => $user->display_name,
			'approved_at'   => current_time( 'mysql' ),
		), array( 'id' => (int) $h['id'] ) );

		$t = self::totals( (int) $h['id'] );
		AH_Flow::log_event( 0, 'manager', 'stock_count_approved', null, null, $user->ID,
			sprintf( 'Count of %s: %d lines, %d differ, net UGX %s', $h['count_date'], $t['lines_counted'], $t['differ'], number_format( (int) $t['net_value'] ) ) );

		return array( 'posted' => $posted, 'count' => self::shape( self::head( (int) $h['id'] ) ) );
	}

	public static function remove( $req ) {
		global $wpdb;
		$h = self::head( (int) $req['id'] );
		if ( ! $h ) {
			return self::err( 'ah_not_found', 'That count was not found', 404 );
		}
		if ( 'deleted' === $h['status'] ) {
			return self::err( 'ah_count_gone', 'This count is already deleted.', 409 );
		}
		if ( 'draft' === $h['status'] ) {
			$wpdb->delete( self::t( 'stock_count_lines' ), array( 'count_id' => (int) $h['id'] ) );
			$wpdb->delete( self::t( 'stock_counts' ), array( 'id' => (int) $h['id'] ) );
			return array( 'ok' => true, 'undone' => 0 );
		}

		// An approved count already changed the stock. Deleting it puts
		// every item back by the same amount, written in the stock book as
		// its own line, so the history shows the count and its undoing.
		$lines  = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'stock_count_lines' ) . ' WHERE count_id = %d', $h['id'] ), ARRAY_A );
		$undone = 0;
		foreach ( (array) $lines as $l ) {
			$var = (float) $l['variance'];
			if ( abs( $var ) < 0.005 ) {
				continue;
			}
			$product = wc_get_product( (int) $l['product_id'] );
			if ( ! $product ) {
				continue;
			}
			AH_Stock::adjust( $product, -$var, 'count_undone', array(
				'note'      => 'Count deleted: stock put back',
				'ref'       => 'Count #' . $h['id'],
				'count_id'  => (int) $h['id'],
				'unit_cost' => (int) $l['unit_cost'],
			) );
			++$undone;
		}
		$wpdb->update( self::t( 'stock_counts' ), array( 'status' => 'deleted' ), array( 'id' => (int) $h['id'] ) );
		$user = AH_Auth::current();
		AH_Flow::log_event( 0, 'manager', 'stock_count_deleted', null, null, $user ? $user->ID : null,
			sprintf( 'Count of %s deleted, %d item(s) put back', $h['count_date'], $undone ) );
		return array( 'ok' => true, 'undone' => $undone );
	}
}
