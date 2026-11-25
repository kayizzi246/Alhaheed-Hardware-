<?php
/**
 * Stock, as the manager keeps it.
 *
 * Every product carries a sale price and a buy price, a reorder level
 * and how many to order, a supplier and a shelf. Every change to the
 * count is a line in the stock book, with who did it and why:
 *
 *   opening     the count a product started with
 *   received    goods in from a supplier, at a price
 *   sold        goods out when the store releases an order (automatic)
 *   restored    goods back on the shelf from a cancelled order (automatic)
 *   returned    a customer brought something back
 *   damaged     broken, spoilt, stolen or lost
 *   own_use     taken off the shelf for the shop itself
 *   count       a physical count, the book set to what is really there
 *   correction  a mistake put right, up or down
 *
 * A count is never typed over without a line here, so "where did ten
 * bags go" always has an answer.
 *
 * The buy price never leaves through the public catalogue: only the
 * manager's routes add it.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Stock {

	const KINDS = array(
		'opening'    => 'Opening stock',
		'received'   => 'Received',
		'sold'       => 'Sold',
		'restored'   => 'Back from a cancelled order',
		'returned'   => 'Returned by a customer',
		'damaged'    => 'Damaged or lost',
		'own_use'    => 'Used by the shop',
		'count'      => 'Stock count',
		'correction' => 'Correction',
	);

	/** What a person may record by hand, and which way it moves the count. */
	const MANUAL = array(
		'received'   => 1,
		'returned'   => 1,
		'damaged'    => -1,
		'own_use'    => -1,
		'count'      => 0,
		'correction' => 0,
	);

	public static function init() {
		add_action( 'woocommerce_reduce_order_item_stock', array( __CLASS__, 'on_sold' ), 10, 3 );
		add_action( 'woocommerce_restore_order_item_stock', array( __CLASS__, 'on_restored' ), 10, 4 );
	}

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

		$route( '/manager/products', array( $get, $post ), array( __CLASS__, 'products' ) );
		$route( '/manager/products/(?P<id>\d+)', $post, array( __CLASS__, 'update' ) );
		$route( '/manager/products/(?P<id>\d+)/stock', $post, array( __CLASS__, 'move' ) );
		$route( '/manager/products/(?P<id>\d+)/moves', $get, array( __CLASS__, 'history' ) );
		$route( '/manager/stock/moves', $get, array( __CLASS__, 'moves' ) );
	}

	// -----------------------------------------------------------------
	// The list
	// -----------------------------------------------------------------

	/** Every product, retired ones too, with what only the manager sees. */
	public static function products( $req ) {
		if ( 'POST' === $req->get_method() ) {
			return self::create( $req );
		}

		$sold = self::sold_since( gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - 30 * DAY_IN_SECONDS ) );
		$rows = array();
		foreach ( wc_get_products( array( 'limit' => -1, 'status' => array( 'publish', 'draft', 'private' ), 'orderby' => 'title', 'order' => 'ASC' ) ) as $product ) {
			$row = self::item( $product, $sold );
			if ( $row ) {
				$rows[] = $row;
			}
		}

		$sum = array(
			'products'     => 0,
			'stockValue'   => 0,
			'retailValue'  => 0,
			'low'          => 0,
			'out'          => 0,
			'noCost'       => 0,
			'profitInStock' => 0,
		);
		foreach ( $rows as $r ) {
			if ( ! $r['active'] ) {
				continue;
			}
			++$sum['products'];
			$sum['stockValue']  += $r['stock_value'];
			$sum['retailValue'] += $r['retail_value'];
			if ( 'out' === $r['state'] ) {
				++$sum['out'];
			} elseif ( 'low' === $r['state'] ) {
				++$sum['low'];
			}
			if ( ! $r['cost'] ) {
				++$sum['noCost'];
			} else {
				// Only where the buy price is known: an unknown cost is not free.
				$sum['profitInStock'] += $r['retail_value'] - $r['stock_value'];
			}
		}

		return array(
			'products'   => $rows,
			'summary'    => $sum,
			'categories' => self::category_names(),
			'suppliers'  => self::supplier_names(),
			'kinds'      => self::KINDS,
		);
	}

	/** A product as the manager's screens need it. */
	public static function item( $product, $sold = null ) {
		$s = AH_Shape::product( $product );
		if ( ! $s ) {
			return null;
		}
		if ( is_numeric( $product ) ) {
			$product = wc_get_product( $product );
		}
		$id      = $product->get_id();
		$tracked = (bool) $product->get_manage_stock();
		$stock   = $tracked ? (int) $product->get_stock_quantity() : null;
		$cost    = (int) get_post_meta( $id, '_ah_cost', true );
		$price   = (int) $s['price'];
		$reorder = (int) $s['reorder_level'];
		$on_hand = max( 0, (int) $stock );

		if ( null === $sold ) {
			$sold = self::sold_since( gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - 30 * DAY_IN_SECONDS ), $id );
		}
		$sold30 = isset( $sold[ $id ] ) ? (int) $sold[ $id ] : 0;

		if ( ! $tracked ) {
			$state = 'untracked';
		} elseif ( $stock <= 0 ) {
			$state = 'out';
		} elseif ( $reorder > 0 && $stock <= $reorder ) {
			$state = 'low';
		} else {
			$state = 'ok';
		}

		return array_merge( $s, array(
			'stock_available' => $stock,
			'tracked'         => $tracked,
			'cost'            => $cost,
			'profit_each'     => $cost ? $price - $cost : null,
			'margin'          => ( $cost && $price ) ? round( ( $price - $cost ) / $price * 100, 1 ) : null,
			'reorder_qty'     => (int) get_post_meta( $id, '_ah_reorder_qty', true ),
			'shelf'           => (string) get_post_meta( $id, '_ah_shelf', true ),
			'supplier'        => AH_Shape::text( (string) get_post_meta( $id, '_ah_supplier', true ) ),
			'stock_value'     => $on_hand * $cost,
			'retail_value'    => $on_hand * $price,
			'sold_30'         => $sold30,
			// At the last thirty days' pace. Null when nothing sold.
			'days_left'       => ( $tracked && $sold30 > 0 ) ? (int) floor( $on_hand / ( $sold30 / 30 ) ) : null,
			'state'           => $state,
			'status_label'    => array(
				'out'       => 'Out of stock',
				'low'       => 'Low',
				'ok'        => 'In stock',
				'untracked' => 'Not counted',
			)[ $state ],
		) );
	}

	/** Units sold per product since a time, from the stock book. */
	private static function sold_since( $since, $product_id = 0 ) {
		global $wpdb;
		$t   = AH_Install::table( 'stock_moves' );
		$sql = $wpdb->prepare( "SELECT product_id, SUM(-qty) AS n FROM {$t} WHERE kind = 'sold' AND created_at >= %s", $since );
		if ( $product_id ) {
			$sql .= $wpdb->prepare( ' AND product_id = %d', $product_id );
		}
		$out = array();
		foreach ( (array) $wpdb->get_results( $sql . ' GROUP BY product_id', ARRAY_A ) as $r ) {
			$out[ (int) $r['product_id'] ] = (int) $r['n'];
		}
		return $out;
	}

	private static function category_names() {
		$out = array();
		foreach ( (array) get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false ) ) as $t ) {
			if ( ! is_wp_error( $t ) && 'uncategorized' !== $t->slug ) {
				$out[] = AH_Shape::text( $t->name );
			}
		}
		sort( $out );
		return $out;
	}

	private static function supplier_names() {
		global $wpdb;
		$t = AH_Install::table( 'suppliers' );
		return array_map( array( 'AH_Shape', 'text' ), (array) $wpdb->get_col( "SELECT name FROM {$t} WHERE active = 1 ORDER BY name" ) );
	}

	// -----------------------------------------------------------------
	// Adding and editing
	// -----------------------------------------------------------------

	public static function create( $req ) {
		$name  = trim( sanitize_text_field( (string) $req->get_param( 'name' ) ) );
		$code  = trim( sanitize_text_field( (string) $req->get_param( 'code' ) ) );
		$price = (int) $req->get_param( 'price' );
		$open  = (int) $req->get_param( 'stockAvailable' );

		if ( strlen( $name ) < 2 ) {
			return self::err( 'ah_no_name', 'Give the product a name', 400 );
		}
		if ( $price <= 0 ) {
			return self::err( 'ah_no_price', 'Give it a sale price', 400 );
		}
		if ( $open < 0 ) {
			return self::err( 'ah_bad_qty', 'Opening stock cannot be below zero', 400 );
		}
		if ( '' === $code ) {
			$code = self::next_code( $name );
		}
		if ( wc_get_product_id_by_sku( $code ) ) {
			return self::err( 'ah_code_taken', sprintf( 'The code %s is already used by another product', $code ), 409 );
		}

		$p = new WC_Product_Simple();
		try {
			$p->set_sku( $code );
		} catch ( WC_Data_Exception $e ) {
			return self::err( 'ah_code_taken', sprintf( 'The code %s is already used by another product', $code ), 409 );
		}
		$p->set_name( $name );
		$p->set_regular_price( (string) $price );
		$p->set_manage_stock( true );
		$p->set_stock_quantity( 0 );
		$p->set_status( false === $req->get_param( 'active' ) ? 'draft' : 'publish' );
		$p->set_catalog_visibility( 'visible' );
		$err = self::apply_details( $p, $req );
		if ( is_wp_error( $err ) ) {
			return $err;
		}
		$id = $p->save();
		if ( ! $id ) {
			return self::err( 'ah_not_saved', 'The product could not be saved', 500 );
		}
		self::apply_meta( $id, $req );

		if ( $open > 0 ) {
			self::set_count( $p, $open, 'opening', array(
				'unit_cost' => (int) get_post_meta( $id, '_ah_cost', true ),
				'note'      => 'Added with the product',
			) );
		}

		return array( 'product' => self::item( $id ) );
	}

	public static function update( $req ) {
		$product = wc_get_product( (int) $req['id'] );
		if ( ! $product ) {
			return self::err( 'ah_not_found', 'Product not found', 404 );
		}

		if ( null !== $req->get_param( 'name' ) ) {
			$name = trim( sanitize_text_field( (string) $req->get_param( 'name' ) ) );
			if ( strlen( $name ) < 2 ) {
				return self::err( 'ah_no_name', 'Give the product a name', 400 );
			}
			$product->set_name( $name );
		}
		if ( null !== $req->get_param( 'code' ) ) {
			$code = trim( sanitize_text_field( (string) $req->get_param( 'code' ) ) );
			if ( '' === $code ) {
				return self::err( 'ah_no_code', 'A product needs a code', 400 );
			}
			$other = wc_get_product_id_by_sku( $code );
			if ( $other && (int) $other !== $product->get_id() ) {
				return self::err( 'ah_code_taken', sprintf( 'The code %s is already used by another product', $code ), 409 );
			}
			try {
				$product->set_sku( $code );
			} catch ( WC_Data_Exception $e ) {
				return self::err( 'ah_code_taken', sprintf( 'The code %s is already used by another product', $code ), 409 );
			}
		}
		if ( null !== $req->get_param( 'price' ) ) {
			$price = (int) $req->get_param( 'price' );
			if ( $price <= 0 ) {
				return self::err( 'ah_no_price', 'The sale price must be more than zero', 400 );
			}
			$product->set_regular_price( (string) $price );
			$product->set_sale_price( '' );
		}
		if ( null !== $req->get_param( 'active' ) ) {
			$product->set_status( $req->get_param( 'active' ) ? 'publish' : 'draft' );
		}
		$err = self::apply_details( $product, $req );
		if ( is_wp_error( $err ) ) {
			return $err;
		}
		$product->save();
		self::apply_meta( $product->get_id(), $req );

		// Older screens send the new count with an edit. It still goes in
		// the book, as a count, rather than quietly replacing the number.
		if ( null !== $req->get_param( 'stockAvailable' ) ) {
			$want = (int) $req->get_param( 'stockAvailable' );
			if ( ! $product->get_manage_stock() || $want !== (int) $product->get_stock_quantity() ) {
				self::set_count( $product, max( 0, $want ), 'count', array( 'note' => 'Changed while editing the product' ) );
			}
		}

		return array( 'product' => self::item( $product->get_id() ) );
	}

	/** Category and description: things on the product itself. */
	private static function apply_details( $product, $req ) {
		if ( null !== $req->get_param( 'category' ) ) {
			$cat = trim( sanitize_text_field( (string) $req->get_param( 'category' ) ) );
			if ( '' === $cat ) {
				$product->set_category_ids( array() );
			} else {
				$term = term_exists( $cat, 'product_cat' );
				if ( ! $term ) {
					$term = wp_insert_term( $cat, 'product_cat' );
				}
				if ( is_wp_error( $term ) ) {
					return self::err( 'ah_bad_category', 'That category could not be made: ' . $term->get_error_message(), 400 );
				}
				$product->set_category_ids( array( (int) $term['term_id'] ) );
			}
		}
		if ( null !== $req->get_param( 'description' ) ) {
			$product->set_short_description( sanitize_textarea_field( (string) $req->get_param( 'description' ) ) );
		}
		return true;
	}

	/** Everything kept beside the product. */
	private static function apply_meta( $id, $req ) {
		$ints = array( 'cost' => '_ah_cost', 'reorderLevel' => '_ah_reorder_level', 'reorderQty' => '_ah_reorder_qty' );
		foreach ( $ints as $param => $key ) {
			if ( null !== $req->get_param( $param ) && '' !== $req->get_param( $param ) ) {
				update_post_meta( $id, $key, max( 0, (int) $req->get_param( $param ) ) );
			}
		}
		$texts = array( 'unit' => '_ah_unit', 'supplier' => '_ah_supplier', 'shelf' => '_ah_shelf' );
		foreach ( $texts as $param => $key ) {
			if ( null !== $req->get_param( $param ) ) {
				$v = trim( sanitize_text_field( (string) $req->get_param( $param ) ) );
				if ( 'unit' === $param && '' === $v ) {
					$v = 'pc';
				}
				update_post_meta( $id, $key, $v );
			}
		}
	}

	/** "AH-CEM-004": the first letters of the name and the next free number. */
	private static function next_code( $name ) {
		$stem = strtoupper( substr( preg_replace( '/[^A-Za-z]/', '', $name ), 0, 3 ) ) ?: 'PRD';
		for ( $i = 1; $i < 10000; $i++ ) {
			$code = sprintf( 'AH-%s-%03d', $stem, $i );
			if ( ! wc_get_product_id_by_sku( $code ) ) {
				return $code;
			}
		}
		return 'AH-' . wp_generate_password( 6, false );
	}

	// -----------------------------------------------------------------
	// Moving stock by hand
	// -----------------------------------------------------------------

	public static function move( $req ) {
		$product = wc_get_product( (int) $req['id'] );
		if ( ! $product ) {
			return self::err( 'ah_not_found', 'Product not found', 404 );
		}
		$kind = (string) $req->get_param( 'kind' );
		if ( ! isset( self::MANUAL[ $kind ] ) ) {
			return self::err( 'ah_bad_kind', 'Choose what happened to the stock', 400 );
		}
		$qty  = (int) $req->get_param( 'qty' );
		$note = trim( sanitize_text_field( (string) $req->get_param( 'note' ) ) );
		$now  = $product->get_manage_stock() ? (int) $product->get_stock_quantity() : 0;
		$unit = get_post_meta( $product->get_id(), '_ah_unit', true ) ?: 'pc';

		if ( 'count' === $kind ) {
			if ( $qty < 0 ) {
				return self::err( 'ah_bad_qty', 'A count cannot be below zero', 400 );
			}
			$target = $qty;
		} elseif ( 'correction' === $kind ) {
			if ( 0 === $qty ) {
				return self::err( 'ah_bad_qty', 'Enter how many to add or take off', 400 );
			}
			if ( strlen( $note ) < 3 ) {
				return self::err( 'ah_no_note', 'Say what the correction is for', 400 );
			}
			$target = $now + $qty;
		} else {
			if ( $qty <= 0 ) {
				return self::err( 'ah_bad_qty', 'Enter how many', 400 );
			}
			$target = $now + self::MANUAL[ $kind ] * $qty;
		}
		if ( $target < 0 ) {
			return self::err( 'ah_not_enough', sprintf( 'There are only %d %s in stock', $now, $unit ), 409 );
		}
		if ( in_array( $kind, array( 'damaged', 'own_use' ), true ) && strlen( $note ) < 3 ) {
			return self::err( 'ah_no_note', 'Say what happened, so the stock book can explain it', 400 );
		}

		$args = array( 'note' => $note );

		if ( 'received' === $kind ) {
			$cost     = (int) $req->get_param( 'unitCost' );
			$supplier = trim( sanitize_text_field( (string) $req->get_param( 'supplier' ) ) );
			$args['ref']      = trim( sanitize_text_field( (string) $req->get_param( 'ref' ) ) );
			$args['supplier'] = $supplier;
			if ( $cost > 0 ) {
				// The buy price is what was last paid: what the shop
				// would pay to put the same thing back on the shelf.
				update_post_meta( $product->get_id(), '_ah_cost', $cost );
				$args['unit_cost'] = $cost;
			}
			if ( $supplier && ! get_post_meta( $product->get_id(), '_ah_supplier', true ) ) {
				update_post_meta( $product->get_id(), '_ah_supplier', $supplier );
			}
		}

		if ( $target === $now && $product->get_manage_stock() ) {
			// A count that agrees with the book is worth writing down too:
			// it says somebody looked.
			self::record( $product->get_id(), $kind, 0, $now, $now, $args );
		} else {
			self::set_count( $product, $target, $kind, $args );
		}

		return array( 'product' => self::item( $product->get_id() ) );
	}

	/** Set the count and write the line that explains it. */
	private static function set_count( $product, $target, $kind, $args = array() ) {
		$before = $product->get_manage_stock() ? (int) $product->get_stock_quantity() : 0;
		if ( ! $product->get_manage_stock() ) {
			$product->set_manage_stock( true );
			$product->save();
		}
		$after = (int) wc_update_product_stock( $product, $target, 'set' );
		if ( empty( $args['unit_cost'] ) ) {
			$args['unit_cost'] = (int) get_post_meta( $product->get_id(), '_ah_cost', true );
		}
		self::record( $product->get_id(), $kind, $after - $before, $before, $after, $args );
	}

	/** One line in the stock book. */
	public static function record( $product_id, $kind, $qty, $before, $after, $args = array() ) {
		global $wpdb;
		$user = AH_Auth::current();
		$wpdb->insert( AH_Install::table( 'stock_moves' ), array(
			'product_id'   => (int) $product_id,
			'kind'         => $kind,
			'qty'          => (int) $qty,
			'stock_before' => (int) $before,
			'stock_after'  => (int) $after,
			'unit_cost'    => isset( $args['unit_cost'] ) ? (int) $args['unit_cost'] : 0,
			'unit_price'   => isset( $args['unit_price'] ) ? (int) $args['unit_price'] : 0,
			'order_id'     => isset( $args['order_id'] ) ? (int) $args['order_id'] : 0,
			'supplier'     => isset( $args['supplier'] ) ? (string) $args['supplier'] : '',
			'ref'          => isset( $args['ref'] ) ? (string) $args['ref'] : '',
			'note'         => isset( $args['note'] ) ? (string) $args['note'] : '',
			'user_id'      => $user ? (int) $user->ID : 0,
			'user_name'    => $user ? $user->display_name : 'The shop',
			'created_at'   => current_time( 'mysql' ),
		) );
	}

	// -----------------------------------------------------------------
	// What the orders do, written down on their own
	// -----------------------------------------------------------------

	public static function on_sold( $item, $change, $order ) {
		if ( empty( $change['product'] ) ) {
			return;
		}
		$product = $change['product'];
		$qty     = max( 1, (int) $item->get_quantity() );
		self::record( $product->get_id(), 'sold', (int) $change['to'] - (int) $change['from'], (int) $change['from'], (int) $change['to'], array(
			'order_id'   => $order->get_id(),
			'unit_cost'  => (int) get_post_meta( $product->get_id(), '_ah_cost', true ),
			'unit_price' => (int) round( (float) $item->get_total() / $qty ),
			'ref'        => AH_Shape::order_no( $order ),
		) );
	}

	public static function on_restored( $item, $new_stock, $old_stock, $order ) {
		$product = $item->get_product();
		if ( ! $product ) {
			return;
		}
		self::record( $product->get_id(), 'restored', (int) $new_stock - (int) $old_stock, (int) $old_stock, (int) $new_stock, array(
			'order_id'  => $order->get_id(),
			'unit_cost' => (int) get_post_meta( $product->get_id(), '_ah_cost', true ),
			'ref'       => AH_Shape::order_no( $order ),
		) );
	}

	// -----------------------------------------------------------------
	// Reading the book
	// -----------------------------------------------------------------

	public static function history( $req ) {
		$product = wc_get_product( (int) $req['id'] );
		if ( ! $product ) {
			return self::err( 'ah_not_found', 'Product not found', 404 );
		}
		return array(
			'product' => self::item( $product ),
			'moves'   => self::read( array( 'product_id' => $product->get_id() ), 300 ),
		);
	}

	public static function moves( $req ) {
		$where = array();
		foreach ( array( 'from', 'to' ) as $k ) {
			$v = (string) $req->get_param( $k );
			if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) ) {
				$where[ $k ] = $v;
			}
		}
		$kind = (string) $req->get_param( 'kind' );
		if ( isset( self::KINDS[ $kind ] ) ) {
			$where['kind'] = $kind;
		}
		$moves = self::read( $where, min( 2000, max( 1, (int) ( $req->get_param( 'limit' ) ?: 500 ) ) ) );

		$in = $out = $in_value = $out_value = 0;
		foreach ( $moves as $m ) {
			if ( $m['qty'] > 0 ) {
				$in       += $m['qty'];
				$in_value += $m['value'];
			} else {
				$out       -= $m['qty'];
				$out_value += $m['value'];
			}
		}
		return array(
			'moves'   => $moves,
			'summary' => array( 'unitsIn' => $in, 'unitsOut' => $out, 'valueIn' => $in_value, 'valueOut' => $out_value ),
			'kinds'   => self::KINDS,
		);
	}

	private static function read( $where, $limit ) {
		global $wpdb;
		$t    = AH_Install::table( 'stock_moves' );
		$sql  = "SELECT m.*, p.post_title AS product_name FROM {$t} m LEFT JOIN {$wpdb->posts} p ON p.ID = m.product_id WHERE 1=1";
		$args = array();
		if ( ! empty( $where['product_id'] ) ) {
			$sql   .= ' AND m.product_id = %d';
			$args[] = $where['product_id'];
		}
		if ( ! empty( $where['kind'] ) ) {
			$sql   .= ' AND m.kind = %s';
			$args[] = $where['kind'];
		}
		if ( ! empty( $where['from'] ) ) {
			$sql   .= ' AND m.created_at >= %s';
			$args[] = $where['from'] . ' 00:00:00';
		}
		if ( ! empty( $where['to'] ) ) {
			$sql   .= ' AND m.created_at <= %s';
			$args[] = $where['to'] . ' 23:59:59';
		}
		$sql .= ' ORDER BY m.id DESC LIMIT ' . (int) $limit;
		$rows = $args ? $wpdb->get_results( $wpdb->prepare( $sql, $args ), ARRAY_A ) : $wpdb->get_results( $sql, ARRAY_A );

		$units = array();
		return array_map( function ( $r ) use ( &$units ) {
			$pid = (int) $r['product_id'];
			if ( ! isset( $units[ $pid ] ) ) {
				$units[ $pid ] = get_post_meta( $pid, '_ah_unit', true ) ?: 'pc';
			}
			return array(
				'id'           => (int) $r['id'],
				'product_id'   => $pid,
				'product_name' => AH_Shape::text( $r['product_name'] ?: 'A deleted product' ),
				'unit'         => $units[ $pid ],
				'kind'         => $r['kind'],
				'kind_label'   => self::KINDS[ $r['kind'] ] ?? $r['kind'],
				'qty'          => (int) $r['qty'],
				'before'       => (int) $r['stock_before'],
				'after'        => (int) $r['stock_after'],
				'unit_cost'    => (int) $r['unit_cost'],
				'unit_price'   => (int) $r['unit_price'],
				'value'        => abs( (int) $r['qty'] ) * (int) $r['unit_cost'],
				'order_id'     => (int) $r['order_id'] ?: null,
				'ref'          => $r['ref'],
				'supplier'     => AH_Shape::text( $r['supplier'] ),
				'note'         => AH_Shape::text( $r['note'] ),
				'by'           => AH_Shape::text( $r['user_name'] ),
				'created_at'   => $r['created_at'],
			);
		}, (array) $rows );
	}

	private static function err( $code, $message, $status ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}
}
