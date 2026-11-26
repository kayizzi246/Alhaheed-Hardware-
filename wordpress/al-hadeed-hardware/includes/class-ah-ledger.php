<?php
/**
 * Stock control: what the stock book says, read whole.
 *
 * Book stock is never a stored figure. It is the sum of every line in
 * the stock book for the item (purchases in, sales out, counts and
 * corrections either way), worked out in one query each time it is
 * asked for. There is no row limit on any of it: an item first sold on
 * the fifty-thousandth line is counted like one sold on the first.
 *
 * WooCommerce keeps its own running count, which the shop and the app
 * read to show what is available. It is kept in step by every move, and
 * any item where the two disagree is reported rather than hidden.
 *
 * The arithmetic itself lives in AH_Stock_Math, where it is tested.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Ledger {

	public static function routes() {
		$ns      = AH_Rest::NS;
		$manager = AH_Rest::desk( array( 'manager' ) );
		$get     = WP_REST_Server::READABLE;

		foreach ( array(
			'/manager/stock/control'                 => 'control',
			'/manager/stock/margins'                 => 'margins',
			'/manager/products/(?P<id>\d+)/ledger'   => 'ledger',
			'/manager/stock/overrides'               => 'overrides',
		) as $path => $cb ) {
			register_rest_route( $ns, $path, array(
				'methods'             => $get,
				'permission_callback' => $manager,
				'callback'            => array( __CLASS__, $cb ),
			) );
		}
	}

	/** Do the shop's prices and costs include 18% VAT? */
	public static function vat_included() {
		return 'no' !== AH_Settings::get( 'vat_included' );
	}

	/** The date a line belongs to: the day typed in, or the day it was saved. */
	private static function day_sql() {
		return 'COALESCE(moved_on, DATE(created_at))';
	}

	// -----------------------------------------------------------------
	// Per item
	// -----------------------------------------------------------------

	/**
	 * Book stock for one item, or for all of them.
	 *
	 * @return int|array<int,int>
	 */
	public static function book( $product_id = null ) {
		global $wpdb;
		$t = AH_Install::table( 'stock_moves' );
		if ( null !== $product_id ) {
			return (float) $wpdb->get_var( $wpdb->prepare( "SELECT COALESCE(SUM(qty),0) FROM {$t} WHERE product_id = %d", $product_id ) );
		}
		$out = array();
		foreach ( (array) $wpdb->get_results( "SELECT product_id, COALESCE(SUM(qty),0) AS q FROM {$t} GROUP BY product_id", ARRAY_A ) as $r ) {
			$out[ (int) $r['product_id'] ] = round( (float) $r['q'], 2 );
		}
		return $out;
	}

	/**
	 * Goods sold and paid for that have not left the store yet. The book
	 * only takes them off when they are released, so a sale checked
	 * against the book alone could sell the same plate twice.
	 *
	 * @return array<int,int> product_id => qty
	 */
	public static function reserved( $product_id = null ) {
		global $wpdb;
		$items = $wpdb->prefix . 'woocommerce_order_items';
		$meta  = $wpdb->prefix . 'woocommerce_order_itemmeta';
		$open  = "'wc-ah-paid','wc-ah-verified','wc-processing'";
		$only  = $product_id ? $wpdb->prepare( ' AND pid.meta_value = %d', $product_id ) : '';

		if ( self::hpos() ) {
			$from = "{$wpdb->prefix}wc_orders o ON o.id = i.order_id AND o.status IN ({$open}) AND o.type = 'shop_order'";
			$done = "LEFT JOIN {$wpdb->prefix}wc_orders_meta red ON red.order_id = o.id AND red.meta_key = '_order_stock_reduced'";
		} else {
			$from = "{$wpdb->posts} o ON o.ID = i.order_id AND o.post_status IN ({$open}) AND o.post_type = 'shop_order'";
			$done = "LEFT JOIN {$wpdb->postmeta} red ON red.post_id = o.ID AND red.meta_key = '_order_stock_reduced'";
		}
		$rows = $wpdb->get_results(
			"SELECT pid.meta_value AS product_id, SUM(qty.meta_value - COALESCE(rel.meta_value,0)) AS q
			   FROM {$items} i
			   JOIN {$from}
			   {$done}
			   JOIN {$meta} pid ON pid.order_item_id = i.order_item_id AND pid.meta_key = '_product_id'
			   JOIN {$meta} qty ON qty.order_item_id = i.order_item_id AND qty.meta_key = '_qty'
			   LEFT JOIN {$meta} rel ON rel.order_item_id = i.order_item_id AND rel.meta_key = '_ah_qty_released'
			  WHERE i.order_item_type = 'line_item'
			    AND ( red.meta_value IS NULL OR red.meta_value NOT IN ('yes','1') ){$only}
			  GROUP BY pid.meta_value",
			ARRAY_A
		);
		$out = array();
		foreach ( (array) $rows as $r ) {
			$out[ (int) $r['product_id'] ] = round( (float) $r['q'], 2 );
		}
		return $out;
	}

	private static function hpos() {
		return class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' )
			&& \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
	}

	/**
	 * Every product with the figures stock control needs, from a fixed
	 * handful of queries however many products and lines there are.
	 */
	public static function items() {
		global $wpdb;
		$t   = AH_Install::table( 'stock_moves' );
		$day = self::day_sql();

		$products = $wpdb->get_results(
			"SELECT ID, post_title FROM {$wpdb->posts}
			  WHERE post_type = 'product' AND post_status IN ('publish','private','draft')",
			ARRAY_A
		);
		if ( ! $products ) {
			return array();
		}
		$ids  = implode( ',', array_map( 'intval', wp_list_pluck( $products, 'ID' ) ) );
		$keys = "'_sku','_price','_ah_cost','_ah_avg_cost','_ah_reorder_level','_ah_unit','_stock','_manage_stock'";
		$meta = array();
		foreach ( (array) $wpdb->get_results( "SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta} WHERE post_id IN ({$ids}) AND meta_key IN ({$keys})", ARRAY_A ) as $m ) {
			$meta[ (int) $m['post_id'] ][ $m['meta_key'] ] = $m['meta_value'];
		}

		$book = self::book();
		$res  = self::reserved();

		// Sales in the last 90 days, net of anything brought back from a
		// cancelled order, and the last day anything sold.
		$since = gmdate( 'Y-m-d', strtotime( current_time( 'Y-m-d' ) . ' -' . AH_Stock_Math::SALES_WINDOW . ' days' ) );
		$sold  = array();
		foreach ( (array) $wpdb->get_results( $wpdb->prepare(
			"SELECT product_id, -SUM(qty) AS q FROM {$t} WHERE kind IN ('sold','restored') AND {$day} > %s GROUP BY product_id",
			$since
		), ARRAY_A ) as $r ) {
			$sold[ (int) $r['product_id'] ] = max( 0, round( (float) $r['q'], 2 ) );
		}
		$last = array();
		foreach ( (array) $wpdb->get_results( "SELECT product_id, MAX({$day}) AS d FROM {$t} WHERE kind = 'sold' GROUP BY product_id", ARRAY_A ) as $r ) {
			$last[ (int) $r['product_id'] ] = $r['d'];
		}
		$cats = array();
		foreach ( (array) $wpdb->get_results(
			"SELECT tr.object_id, t.name FROM {$wpdb->term_relationships} tr
			   JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'product_cat'
			   JOIN {$wpdb->terms} t ON t.term_id = tt.term_id
			  WHERE tr.object_id IN ({$ids})",
			ARRAY_A
		) as $c ) {
			$cats[ (int) $c['object_id'] ] = AH_Shape::text( $c['name'] );
		}

		$today = strtotime( current_time( 'Y-m-d' ) );
		$out   = array();
		foreach ( $products as $p ) {
			$id = (int) $p['ID'];
			$m  = isset( $meta[ $id ] ) ? $meta[ $id ] : array();
			$b     = isset( $book[ $id ] ) ? $book[ $id ] : 0;
			$cost  = (int) ( $m['_ah_cost'] ?? 0 );
			$avgc  = (int) ( $m['_ah_avg_cost'] ?? 0 ) ?: $cost;
			$min   = (int) ( $m['_ah_reorder_level'] ?? 0 );
			$avg   = AH_Stock_Math::avg_daily_sales( $sold[ $id ] ?? 0 );
			$days  = AH_Stock_Math::days_of_stock( $b, $avg );
			$ls    = $last[ $id ] ?? null;
			$since_sale = $ls ? (int) floor( ( $today - strtotime( $ls ) ) / DAY_IN_SECONDS ) : null;
			$shelf = 'yes' === ( $m['_manage_stock'] ?? '' ) ? (int) ( $m['_stock'] ?? 0 ) : null;

			$out[] = array(
				'id'             => $id,
				'name'           => AH_Shape::text( $p['post_title'] ),
				'code'           => (string) ( $m['_sku'] ?? '' ),
				'category'       => $cats[ $id ] ?? '',
				'unit'           => (string) ( $m['_ah_unit'] ?? 'pc' ) ?: 'pc',
				'price'          => (int) round( (float) ( $m['_price'] ?? 0 ) ),
				'cost'           => $cost,
				'book'           => $b,
				'reserved'       => $res[ $id ] ?? 0,
				'avgCost'        => $avgc,
				// Stock is worth what it cost, on average, not what the
				// last delivery happened to cost.
				'value'          => max( 0, $b ) * $avgc,
				'minLevel'       => $min,
				'sold90'         => $sold[ $id ] ?? 0,
				'avgDaily'       => round( $avg, 2 ),
				'daysOfStock'    => $days,
				'lastSale'       => $ls,
				'daysSinceSale'  => $since_sale,
				'reorder'        => AH_Stock_Math::needs_reorder( $b, $min, $days ),
				'suggestedQty'   => AH_Stock_Math::suggested_order( $b, $min ),
				'dead'           => AH_Stock_Math::is_dead( $b, $since_sale ),
				'slow'           => AH_Stock_Math::is_slow( $days ),
				// The shop's own running count, when it has drifted from the book.
				'shelfMismatch'  => null !== $shelf && $shelf !== $b ? $shelf : null,
			);
		}
		return $out;
	}

	// -----------------------------------------------------------------
	// The dashboard
	// -----------------------------------------------------------------

	public static function control() {
		$items = self::items();

		$value = 0;
		$in    = 0;
		$out   = 0;
		$book  = 0;
		$sold  = 0;
		foreach ( $items as $i ) {
			$value += $i['value'];
			$book  += max( 0, $i['book'] );
			$sold  += $i['sold90'];
			if ( $i['book'] > 0 ) {
				++$in;
			} else {
				++$out;
			}
		}

		$reorder = array_values( array_filter( $items, function ( $i ) { return $i['reorder']; } ) );
		foreach ( $reorder as &$r ) {
			$r['orderCost'] = $r['suggestedQty'] * $r['cost'];
		}
		unset( $r );
		usort( $reorder, function ( $a, $b ) {
			return ( $a['daysOfStock'] ?? 1e9 ) <=> ( $b['daysOfStock'] ?? 1e9 ) ?: $a['book'] <=> $b['book'];
		} );

		$slow = array_values( array_filter( $items, function ( $i ) { return $i['dead'] || $i['slow']; } ) );
		usort( $slow, function ( $a, $b ) { return $b['value'] <=> $a['value']; } );

		$negative = array_values( array_filter( $items, function ( $i ) { return $i['book'] < 0; } ) );
		$drift    = array_values( array_filter( $items, function ( $i ) { return null !== $i['shelfMismatch']; } ) );

		$months = self::months( 12 );
		$now    = end( $months );
		$prev   = prev( $months );

		$losses     = self::losses();
		$unreleased = self::unreleased();
		$overrides  = self::recent_overrides();
		$alert      = self::alert( $months );

		// What the owner should look at today, in plain words, worst first.
		$todo = array();
		if ( $negative ) {
			$todo[] = array( 'level' => 'bad', 'text' => sprintf( '%d %s below zero. More was sold than bought. Enter the missing delivery, or count it.', count( $negative ), count( $negative ) === 1 ? 'item is' : 'items are' ), 'link' => '#negative' );
		}
		if ( $unreleased ) {
			$todo[] = array( 'level' => 'bad', 'text' => sprintf( '%d paid %s not given to the customer after 1 day. Check the goods.', count( $unreleased ), count( $unreleased ) === 1 ? 'order is' : 'orders are' ), 'link' => '#unreleased' );
		}
		if ( $alert['raised'] ) {
			$todo[] = array( 'level' => 'bad', 'text' => sprintf( 'Profit this month is %s%%. Normal is %s%%. Check your selling prices.', $alert['current'], $alert['average'] ), 'link' => '/manager/margins' );
		}
		if ( $losses['monthValue'] > 0 ) {
			$todo[] = array( 'level' => 'warn', 'text' => sprintf( 'UGX %s of stock lost this month.', number_format( $losses['monthValue'] ) ), 'link' => '#losses' );
		}
		if ( $overrides ) {
			$todo[] = array( 'level' => 'warn', 'text' => sprintf( '%d %s allowed by you against the rules this month.', count( $overrides ), count( $overrides ) === 1 ? 'sale was' : 'sales were' ), 'link' => '#overrides' );
		}
		if ( $reorder ) {
			$todo[] = array( 'level' => 'warn', 'text' => sprintf( '%d %s to buy again. Cost about UGX %s.', count( $reorder ), count( $reorder ) === 1 ? 'item' : 'items', number_format( array_sum( wp_list_pluck( $reorder, 'orderCost' ) ) ) ), 'link' => '#reorder' );
		}
		// Money: the till and the suppliers.
		$tills = AH_Till::tills( new WP_REST_Request( 'GET', '/' ) );
		if ( $tills['short'] < 0 ) {
			array_unshift( $todo, array( 'level' => 'bad', 'text' => sprintf( 'Cash missing from the till: UGX %s this month. See who.', number_format( -$tills['short'] ) ), 'link' => '/manager/exceptions' ) );
		}
		if ( $tills['notClosed'] ) {
			array_unshift( $todo, array( 'level' => 'bad', 'text' => sprintf( '%d %s the cashier did not count the cash.', count( $tills['notClosed'] ), count( $tills['notClosed'] ) === 1 ? 'day' : 'days' ), 'link' => '/manager/exceptions' ) );
		}
		$buying    = AH_Purchasing::overview();
		$over      = array_filter( $buying['bills'], function ( $b ) { return $b['match'] && 'over_billed' === $b['match']['state'] && $b['owed'] > 0; } );
		$overdue   = array_filter( $buying['bills'], function ( $b ) { return $b['overdue']; } );
		if ( $over ) {
			array_unshift( $todo, array( 'level' => 'bad', 'text' => sprintf( '%d supplier %s for more than came. Do not pay the extra.', count( $over ), count( $over ) === 1 ? 'bill charges' : 'bills charge' ), 'link' => '/manager/purchasing' ) );
		}
		if ( $overdue ) {
			$todo[] = array( 'level' => 'warn', 'text' => sprintf( '%d supplier %s late to pay: UGX %s.', count( $overdue ), count( $overdue ) === 1 ? 'bill is' : 'bills are', number_format( array_sum( wp_list_pluck( $overdue, 'owed' ) ) ) ), 'link' => '/manager/purchasing' );
		}
		if ( $buying['receivedNoPo'] ) {
			$todo[] = array( 'level' => 'info', 'text' => sprintf( '%d %s came with no order this month.', $buying['receivedNoPo'], 1 === $buying['receivedNoPo'] ? 'delivery' : 'deliveries' ), 'link' => '/manager/purchasing' );
		}

		$no_price = count( array_filter( $items, function ( $i ) { return $i['price'] <= 0; } ) );
		if ( $no_price ) {
			$todo[] = array( 'level' => 'info', 'text' => sprintf( '%d %s no price. They cannot be sold.', $no_price, 1 === $no_price ? 'product has' : 'products have' ), 'link' => '/manager/products' );
		}
		$last_count = self::last_count();
		if ( ! $last_count || ( strtotime( current_time( 'Y-m-d' ) ) - strtotime( $last_count ) ) > 30 * DAY_IN_SECONDS ) {
			$todo[] = array( 'level' => 'info', 'text' => $last_count ? sprintf( 'Last stock count: %s. Count every month.', $last_count ) : 'Stock was never counted. Count it now.', 'link' => '/manager/stock-take' );
		}

		return array(
			'todo'       => $todo,
			'losses'     => $losses,
			'unreleased' => $unreleased,
			'overrides'  => $overrides,
			'lastCount'  => $last_count,
			'summary'  => array(
				'stockValue'   => $value,
				'items'        => count( $items ),
				'inStock'      => $in,
				'outOfStock'   => $out,
				'daysOfStock'  => AH_Stock_Math::days_of_stock( $book, AH_Stock_Math::avg_daily_sales( $sold ) ),
				'reorderCost'  => array_sum( wp_list_pluck( $reorder, 'orderCost' ) ),
				'slowValue'    => array_sum( wp_list_pluck( $slow, 'value' ) ),
			),
			'margin'   => array(
				'thisMonth' => $now,
				'lastMonth' => $prev ?: null,
				'alert'     => $alert,
			),
			'reorder'  => $reorder,
			'slow'     => $slow,
			'negative' => $negative,
			'drift'    => $drift,
			'months'   => array_values( $months ),
			'vatIncluded' => self::vat_included(),
		);
	}

	/**
	 * Stock that left without being sold: written off, used by the shop,
	 * short at a count, corrected down. Who recorded each, and what it
	 * was worth at cost.
	 */
	public static function losses() {
		global $wpdb;
		$t     = AH_Install::table( 'stock_moves' );
		$day   = self::day_sql();
		$since = gmdate( 'Y-m-d', strtotime( current_time( 'Y-m-d' ) . ' -90 days' ) );
		$month = current_time( 'Y-m' );
		$where = "( kind IN ('damaged','own_use') OR ( kind IN ('count','correction') AND qty < 0 ) )";
		$rows  = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, product_id, kind, -qty AS qty, unit_cost, note, ref, user_name, {$day} AS day
			   FROM {$t} WHERE {$where} AND {$day} >= %s ORDER BY day DESC, id DESC",
			$since
		), ARRAY_A );
		$out   = array();
		$month_value = 0;
		$value_90    = 0;
		foreach ( (array) $rows as $r ) {
			$v = (int) $r['qty'] * (int) $r['unit_cost'];
			$value_90 += $v;
			if ( substr( $r['day'], 0, 7 ) === $month ) {
				$month_value += $v;
			}
			$out[] = array(
				'id'    => (int) $r['id'],
				'date'  => $r['day'],
				'name'  => AH_Shape::text( get_the_title( (int) $r['product_id'] ) ) ?: 'Deleted product',
				'what'  => 'count' === $r['kind'] ? 'Short at a count' : ( AH_Stock::KINDS[ $r['kind'] ] ?? $r['kind'] ),
				'qty'   => (float) $r['qty'],
				'value' => $v,
				'note'  => (string) $r['note'],
				'by'    => (string) $r['user_name'],
			);
		}
		return array( 'monthValue' => $month_value, 'value90' => $value_90, 'lines' => $out );
	}

	/**
	 * Paid for more than a day ago and still not released. Either the
	 * customer has not come, or the goods left without the store
	 * recording it; both are worth a look.
	 */
	public static function unreleased() {
		$cut = strtotime( current_time( 'mysql' ) ) - DAY_IN_SECONDS;
		$out = array();
		foreach ( wc_get_orders( array( 'status' => array( 'ah-paid', 'ah-verified', 'processing' ), 'limit' => -1 ) ) as $o ) {
			$paid_at = $o->get_date_modified() ? $o->get_date_modified()->getOffsetTimestamp() : 0;
			if ( $paid_at && $paid_at > $cut ) {
				continue;
			}
			$row   = AH_Shape::order( $o );
			$out[] = array(
				'id'       => $row['id'],
				'orderNo'  => $row['order_no'],
				'customer' => $row['company_name'] ?: $row['ordered_by_name'],
				'total'    => $row['total'],
				'status'   => $row['status_label'],
				'since'    => $paid_at ? gmdate( 'Y-m-d H:i', $paid_at ) : '',
				'days'     => $paid_at ? (int) floor( ( strtotime( current_time( 'mysql' ) ) - $paid_at ) / DAY_IN_SECONDS ) : null,
			);
		}
		return $out;
	}

	private static function recent_overrides() {
		global $wpdb;
		$t = AH_Install::table( 'overrides' );
		return (array) $wpdb->get_results( $wpdb->prepare(
			"SELECT id, rule, detail, reason, user_name, created_at FROM {$t} WHERE created_at >= %s ORDER BY id DESC",
			gmdate( 'Y-m-d', strtotime( current_time( 'Y-m-d' ) . ' -30 days' ) )
		), ARRAY_A );
	}

	private static function last_count() {
		global $wpdb;
		return $wpdb->get_var( 'SELECT MAX(count_date) FROM ' . AH_Install::table( 'stock_counts' ) . " WHERE status = 'approved'" );
	}

	// -----------------------------------------------------------------
	// Margins and zakat
	// -----------------------------------------------------------------

	/**
	 * Month by month: sales, cost of sales, profit, margin and zakat,
	 * all without VAT, plus purchases. A sale counts in the month the
	 * goods left the store, at the cost of the latest purchase then.
	 *
	 * @return array<string,array> 'YYYY-MM' => figures, oldest first.
	 */
	public static function months( $count = 12 ) {
		global $wpdb;
		$t   = AH_Install::table( 'stock_moves' );
		$day = self::day_sql();
		$vat = self::vat_included();

		$keys = array();
		$base = strtotime( current_time( 'Y-m-01' ) );
		for ( $i = $count - 1; $i >= 0; $i-- ) {
			$keys[] = gmdate( 'Y-m', strtotime( "-{$i} months", $base ) );
		}
		$from = $keys[0] . '-01';

		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT DATE_FORMAT({$day}, '%%Y-%%m') AS m,
			        SUM(CASE WHEN kind IN ('sold','restored') THEN -qty * unit_price ELSE 0 END) AS sales,
			        SUM(CASE WHEN kind IN ('sold','restored') THEN -qty * unit_cost ELSE 0 END) AS cost,
			        SUM(CASE WHEN kind = 'received' THEN qty * unit_cost ELSE 0 END) AS bought,
			        SUM(CASE WHEN kind = 'sold' AND unit_cost > 0 AND unit_price < unit_cost THEN 1 ELSE 0 END) AS below
			   FROM {$t}
			  WHERE {$day} >= %s
			  GROUP BY m",
			$from
		), ARRAY_A );
		$by = array();
		foreach ( (array) $rows as $r ) {
			$by[ $r['m'] ] = $r;
		}

		$out = array();
		foreach ( $keys as $k ) {
			$r      = $by[ $k ] ?? array( 'sales' => 0, 'cost' => 0, 'bought' => 0, 'below' => 0 );
			$sales  = AH_Stock_Math::ex_vat( (int) $r['sales'], $vat );
			$cost   = AH_Stock_Math::ex_vat( (int) $r['cost'], $vat );
			$profit = $sales - $cost;
			$out[ $k ] = array(
				'month'      => $k,
				'sales'      => $sales,
				'cost'       => $cost,
				'profit'     => $profit,
				'margin'     => AH_Stock_Math::margin( $sales, $cost ),
				'purchases'  => AH_Stock_Math::ex_vat( (int) $r['bought'], $vat ),
				'belowCost'  => (int) $r['below'],
				'zakat'      => AH_Stock_Math::zakat( $k, array( array( 'date' => $k . '-01', 'profit' => $profit ) ) ),
			);
		}
		return $out;
	}

	/** This month against the six before it. */
	private static function alert( array $months ) {
		$list = array_values( $months );
		$now  = array_pop( $list );
		$six  = array_filter(
			wp_list_pluck( array_slice( $list, -6 ), 'margin' ),
			function ( $m ) { return null !== $m; }
		);
		$avg = $six ? round( array_sum( $six ) / count( $six ), 1 ) : null;
		return array(
			'average' => $avg,
			'current' => $now['margin'],
			'raised'  => AH_Stock_Math::margin_alert( $now['margin'], $avg ),
		);
	}

	/**
	 * The margins page: twelve months, and for one chosen month every
	 * line sold below cost, grouped by item.
	 */
	public static function margins( $req ) {
		global $wpdb;
		$t     = AH_Install::table( 'stock_moves' );
		$day   = self::day_sql();
		$month = (string) $req->get_param( 'month' );
		if ( ! preg_match( '/^\d{4}-\d{2}$/', $month ) ) {
			$month = current_time( 'Y-m' );
		}
		$months = self::months( 12 );

		$lines = $wpdb->get_results( $wpdb->prepare(
			"SELECT product_id, ref, -qty AS qty, unit_price, unit_cost, {$day} AS day
			   FROM {$t}
			  WHERE kind = 'sold' AND unit_cost > 0 AND unit_price < unit_cost
			    AND DATE_FORMAT({$day}, '%%Y-%%m') = %s
			  ORDER BY day DESC, id DESC",
			$month
		), ARRAY_A );

		$vat    = self::vat_included();
		$groups = array();
		foreach ( (array) $lines as $l ) {
			$id = (int) $l['product_id'];
			if ( ! isset( $groups[ $id ] ) ) {
				$groups[ $id ] = array(
					'productId' => $id,
					'name'      => AH_Shape::text( get_the_title( $id ) ) ?: 'Deleted product',
					'code'      => (string) get_post_meta( $id, '_sku', true ),
					'lines'     => 0,
					'qty'       => 0,
					'sales'     => 0,
					'cost'      => 0,
					'loss'      => 0,
					'refs'      => array(),
				);
			}
			$g = &$groups[ $id ];
			$q = (float) $l['qty'];
			++$g['lines'];
			$g['qty']   += $q;
			$g['sales'] += AH_Stock_Math::ex_vat( $q * (int) $l['unit_price'], $vat );
			$g['cost']  += AH_Stock_Math::ex_vat( $q * (int) $l['unit_cost'], $vat );
			$g['loss']   = $g['cost'] - $g['sales'];
			$g['refs'][] = array( 'ref' => $l['ref'], 'day' => $l['day'], 'qty' => $q, 'price' => (int) $l['unit_price'], 'cost' => (int) $l['unit_cost'] );
			unset( $g );
		}
		$groups = array_values( $groups );
		usort( $groups, function ( $a, $b ) { return $b['loss'] <=> $a['loss']; } );

		return array(
			'month'       => $month,
			'months'      => array_values( $months ),
			'alert'       => self::alert( $months ),
			'belowCost'   => $groups,
			'vatIncluded' => $vat,
		);
	}

	// -----------------------------------------------------------------
	// One item's ledger
	// -----------------------------------------------------------------

	/**
	 * Every line for one product, oldest first, with what came in, what
	 * went out and the balance after each.
	 */
	public static function ledger( $req ) {
		global $wpdb;
		$id      = (int) $req['id'];
		$product = wc_get_product( $id );
		if ( ! $product ) {
			return new WP_Error( 'ah_not_found', 'Product not found', array( 'status' => 404 ) );
		}
		$t    = AH_Install::table( 'stock_moves' );
		$day  = self::day_sql();
		$rows = $wpdb->get_results( $wpdb->prepare(
			"SELECT id, kind, qty, unit_cost, unit_price, order_id, supplier, ref, note, user_name, created_at, {$day} AS day
			   FROM {$t} WHERE product_id = %d ORDER BY day ASC, id ASC",
			$id
		), ARRAY_A );

		$names = self::order_names( array_filter( array_map( 'intval', wp_list_pluck( (array) $rows, 'order_id' ) ) ) );

		$balance = 0;
		$totals  = array( 'in' => 0, 'out' => 0, 'purchased' => 0, 'sold' => 0, 'adjusted' => 0 );
		$out     = array();
		foreach ( (array) $rows as $r ) {
			$q        = (float) $r['qty'];
			$balance += $q;
			if ( $q > 0 ) {
				$totals['in'] += $q;
			} else {
				$totals['out'] += -$q;
			}
			if ( 'received' === $r['kind'] ) {
				$totals['purchased'] += $q;
			} elseif ( in_array( $r['kind'], array( 'sold', 'restored' ), true ) ) {
				$totals['sold'] += -$q;
			} else {
				$totals['adjusted'] += $q;
			}
			$oid   = (int) $r['order_id'];
			$out[] = array(
				'id'        => (int) $r['id'],
				'date'      => $r['day'],
				'time'      => $r['created_at'],
				'kind'      => $r['kind'],
				'kindLabel' => AH_Stock::KINDS[ $r['kind'] ] ?? $r['kind'],
				'in'        => $q > 0 ? $q : 0,
				'out'       => $q < 0 ? -$q : 0,
				'balance'   => $balance,
				'unitCost'  => (int) $r['unit_cost'],
				'unitPrice' => (int) $r['unit_price'],
				'ref'       => (string) $r['ref'],
				'party'     => 'received' === $r['kind'] ? (string) $r['supplier'] : ( $names[ $oid ] ?? '' ),
				'note'      => (string) $r['note'],
				'by'        => (string) $r['user_name'],
			);
		}

		$item = null;
		foreach ( self::items() as $i ) {
			if ( $i['id'] === $id ) {
				$item = $i;
				break;
			}
		}

		return array(
			'product' => AH_Stock::item( $product ),
			'stock'   => $item,
			'totals'  => $totals + array( 'book' => $balance ),
			// Newest first is how people read a statement on a screen.
			'lines'   => array_reverse( $out ),
		);
	}

	/** Who each order was for, without loading every order. */
	private static function order_names( array $ids ) {
		global $wpdb;
		$ids = array_unique( $ids );
		if ( ! $ids ) {
			return array();
		}
		$in  = implode( ',', $ids );
		$out = array();
		if ( self::hpos() ) {
			$rows = $wpdb->get_results( "SELECT order_id AS id, TRIM(CONCAT(COALESCE(first_name,''),' ',COALESCE(last_name,''))) AS n FROM {$wpdb->prefix}wc_order_addresses WHERE address_type = 'billing' AND order_id IN ({$in})", ARRAY_A );
		} else {
			$rows = $wpdb->get_results( "SELECT f.post_id AS id, TRIM(CONCAT(COALESCE(f.meta_value,''),' ',COALESCE(l.meta_value,''))) AS n FROM {$wpdb->postmeta} f LEFT JOIN {$wpdb->postmeta} l ON l.post_id = f.post_id AND l.meta_key = '_billing_last_name' WHERE f.meta_key = '_billing_first_name' AND f.post_id IN ({$in})", ARRAY_A );
		}
		foreach ( (array) $rows as $r ) {
			$out[ (int) $r['id'] ] = $r['n'] ?: 'Walk-in customer';
		}
		return $out;
	}

	// -----------------------------------------------------------------
	// Overrides
	// -----------------------------------------------------------------

	/** Write down a rule the manager chose to bend. */
	public static function override( $rule, $reason, $args = array() ) {
		global $wpdb;
		$user = AH_Auth::current();
		$wpdb->insert( AH_Install::table( 'overrides' ), array(
			'rule'       => $rule,
			'product_id' => (int) ( $args['product_id'] ?? 0 ),
			'order_id'   => (int) ( $args['order_id'] ?? 0 ),
			'detail'     => (string) ( $args['detail'] ?? '' ),
			'reason'     => $reason,
			'user_id'    => $user ? (int) $user->ID : 0,
			'user_name'  => $user ? $user->display_name : '',
			'created_at' => current_time( 'mysql' ),
		) );
		return (int) $wpdb->insert_id;
	}

	public static function overrides() {
		global $wpdb;
		$t = AH_Install::table( 'overrides' );
		return array( 'overrides' => (array) $wpdb->get_results( "SELECT * FROM {$t} ORDER BY id DESC LIMIT 300", ARRAY_A ) );
	}
}
