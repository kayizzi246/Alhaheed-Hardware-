<?php
/**
 * WooCommerce objects, in the exact JSON the apps already expect.
 *
 * The Next.js panel and the FlutterFlow app were written against the
 * Node API, and they read fields like `order_no`, `stock_available`,
 * `line_total` and `ordered_by_name`. WooCommerce calls all of those
 * something else.
 *
 * Rather than rewrite two clients, the translation lives here — in one
 * file, where the mapping can be read top to bottom and checked against
 * what the clients actually use. Change a shape here and both clients
 * change with it.
 *
 * Money is returned as a whole-shilling integer, because that is what
 * the clients format. A WooCommerce price is a decimal string, so every
 * one of them goes through `money()`.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Shape {

	/** WooCommerce's "12345.00" -> 12345, the way the clients want it. */
	/**
	 * A name as a person would write it.
	 *
	 * WordPress stores titles and term names HTML-encoded, so a category
	 * called "Iron & Steel" comes back as "Iron &amp; Steel". That is
	 * correct for a web page, which decodes it on the way in — and wrong
	 * for everything else. The phone app paints the string onto a canvas
	 * and the receipt printer prints bytes, so both of them showed the
	 * ampersand spelled out. JSON is data, not markup: it is decoded
	 * here, once, and every client gets the real name.
	 */
	public static function text( $value ) {
		return html_entity_decode( (string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	}

	public static function money( $value ) {
		return (int) round( (float) $value );
	}

	/** MySQL-ish 'YYYY-MM-DD HH:MM:SS', which is what the clients parse. */
	public static function stamp( $date ) {
		if ( ! $date ) {
			return null;
		}
		if ( is_a( $date, 'WC_DateTime' ) || is_a( $date, 'DateTime' ) ) {
			return $date->date( 'Y-m-d H:i:s' );
		}
		return (string) $date;
	}

	// -----------------------------------------------------------------
	// Products
	// -----------------------------------------------------------------

	/**
	 * A WooCommerce product as the catalogue row the apps draw.
	 *
	 * `code` is the SKU and `unit` is a product attribute (bag, length,
	 * tin…) falling back to "pc" — a hardware shop sells by the bag and
	 * the length, and a price with no unit beside it is half a price.
	 */
	public static function product( $product ) {
		if ( is_numeric( $product ) ) {
			$product = wc_get_product( $product );
		}
		if ( ! $product ) {
			return null;
		}

		$terms    = get_the_terms( $product->get_id(), 'product_cat' );
		$category = ( $terms && ! is_wp_error( $terms ) ) ? $terms[0] : null;

		$unit = $product->get_attribute( 'unit' );
		if ( ! $unit ) {
			$unit = get_post_meta( $product->get_id(), '_ah_unit', true );
		}

		$stock = $product->get_manage_stock()
			? (int) $product->get_stock_quantity()
			: ( $product->is_in_stock() ? 9999 : 0 );

		return array(
			'id'              => $product->get_id(),
			'code'            => $product->get_sku(),
			'name'            => self::text( $product->get_name() ),
			'category_id'     => $category ? $category->term_id : null,
			'category_name'   => $category ? self::text( $category->name ) : null,
			'description'     => wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ),
			'unit'            => $unit ? $unit : 'pc',
			'price'           => self::money( $product->get_price() ),
			'picture'         => wp_get_attachment_url( $product->get_image_id() ) ?: null,
			'stock_available' => $stock,
			'reorder_level'   => (int) get_post_meta( $product->get_id(), '_ah_reorder_level', true ),
			'supplier'        => get_post_meta( $product->get_id(), '_ah_supplier', true ) ?: null,
			'remarks'         => null,
			'active'          => $product->get_status() === 'publish' ? 1 : 0,
		);
	}

	// -----------------------------------------------------------------
	// Users
	// -----------------------------------------------------------------

	/** A WordPress user as the account object the clients hold onto. */
	public static function user( $user ) {
		if ( is_numeric( $user ) ) {
			$user = get_user_by( 'id', $user );
		}
		if ( ! $user ) {
			return null;
		}

		$desk  = AH_Roles::desk_of( $user );
		$name  = $user->display_name ? $user->display_name : $user->user_login;
		$phone = get_user_meta( $user->ID, 'ah_phone', true );
		if ( ! $phone ) {
			$phone = get_user_meta( $user->ID, 'billing_phone', true );
		}

		return array(
			'id'            => (int) $user->ID,
			'fullName'      => $name,
			'phone'         => $phone ? $phone : null,
			'email'         => $user->user_email ? $user->user_email : null,
			'role'          => $desk ? $desk : 'customer',
			'accountType'   => get_user_meta( $user->ID, 'ah_account_type', true ) ?: 'individual',
			'companyId'     => (int) get_user_meta( $user->ID, 'ah_company_id', true ) ?: null,
			'companyName'   => get_user_meta( $user->ID, 'ah_company_name', true ) ?: null,
			'staffRole'     => get_user_meta( $user->ID, 'ah_staff_role', true ) ?: null,
			'spendingLimit' => get_user_meta( $user->ID, 'ah_spending_limit', true ) !== ''
				? (int) get_user_meta( $user->ID, 'ah_spending_limit', true )
				: null,
			'status'        => get_user_meta( $user->ID, 'ah_status', true ) ?: 'active',
			// Where a customer came from: added at the counter, or by
			// ordering on the app. Staff accounts leave these empty.
			'source'        => $desk ? null : ( get_user_meta( $user->ID, 'ah_source', true ) ?: 'app' ),
			'addedBy'       => $desk ? null : self::added_by( $user->ID ),
		);
	}

	private static function added_by( $user_id ) {
		$by = (int) get_user_meta( $user_id, 'ah_added_by', true );
		if ( ! $by ) {
			return null;
		}
		$who = get_user_by( 'id', $by );
		return $who ? $who->display_name : null;
	}

	// -----------------------------------------------------------------
	// Orders
	// -----------------------------------------------------------------

	/**
	 * An order as the list row every screen shows.
	 *
	 * `$full` adds the items, the payment and the audit trail — the
	 * things only the detail views and the tracking screen need, and
	 * three extra queries nobody should pay for on a 100-row list.
	 */
	public static function order( $order, $full = false ) {
		if ( is_numeric( $order ) ) {
			$order = wc_get_order( $order );
		}
		if ( ! $order ) {
			return null;
		}

		$status   = $order->get_status();
		$customer = $order->get_customer_id() ? get_user_by( 'id', $order->get_customer_id() ) : null;
		$name     = trim( $order->get_formatted_billing_full_name() );
		if ( ! $name && $customer ) {
			$name = $customer->display_name;
		}

		$row = array(
			'id'               => $order->get_id(),
			'order_no'         => self::order_no( $order ),
			'customer_id'      => (int) $order->get_customer_id(),
			'company_id'       => (int) $order->get_meta( '_ah_company_id' ) ?: null,
			'company_name'     => $order->get_meta( '_ah_company_name' ) ?: null,
			'status'           => AH_Statuses::to_api( $status ),
			'status_label'     => AH_Statuses::label_of( $status ),
			'current_stage'    => AH_Statuses::stage_of( $status ),
			'subtotal'         => self::money( $order->get_subtotal() ),
			'delivery_fee'     => self::money( $order->get_shipping_total() ),
			'total'            => self::money( $order->get_total() ),
			'fulfilment'       => $order->get_meta( '_ah_fulfilment' ) ?: ( $order->has_shipping_address() ? 'delivery' : 'pickup' ),
			'delivery_address' => $order->get_shipping_address_1()
				? trim( $order->get_shipping_address_1() . ', ' . $order->get_shipping_city(), ', ' )
				: null,
			'notes'            => $order->get_customer_note() ?: null,
			'cancel_reason'    => $order->get_meta( '_ah_cancel_reason' ) ?: null,
			'ordered_by_name'  => $name,
			'ordered_by_phone' => $order->get_billing_phone() ?: null,
			'item_count'       => $order->get_item_count(),
			'source'           => $order->get_meta( '_ah_source' ) ?: 'web',
			'created_at'       => self::stamp( $order->get_date_created() ),
			'updated_at'       => self::stamp( $order->get_date_modified() ),
		);

		if ( ! $full ) {
			return $row;
		}

		$row['items']   = self::items( $order );
		$row['payment'] = AH_Flow::payment_for( $order->get_id() );

		// Where the screenshot sits on disk is nobody's business —
		// customers read this shape too. Whether there is one is enough;
		// the picture itself comes from /payments/{id}/proof, which
		// checks the desk first.
		if ( $row['payment'] ) {
			$row['payment']['has_proof'] = ! empty( $row['payment']['proof_file'] );
			unset( $row['payment']['proof_file'] );
		}
		$row['events']  = AH_Flow::events_for( $order->get_id() );
		return $row;
	}

	/** "AH-10427" — the number the customer reads out at the counter. */
	public static function order_no( $order ) {
		$custom = $order->get_meta( '_ah_order_no' );
		if ( $custom ) {
			return $custom;
		}
		return 'AH-' . $order->get_order_number();
	}

	public static function items( $order ) {
		$out = array();
		foreach ( $order->get_items() as $item ) {
			$product = $item->get_product();
			$qty     = (int) $item->get_quantity();
			$total   = self::money( $item->get_total() );

			$out[] = array(
				'id'           => $item->get_id(),
				'product_id'   => $product ? $product->get_id() : null,
				'product_name' => self::text( $item->get_name() ),
				'code'         => $product ? $product->get_sku() : null,
				'unit'         => $product ? ( $product->get_attribute( 'unit' ) ?: 'pc' ) : 'pc',
				'quantity'     => $qty,
				'unit_price'   => $qty > 0 ? (int) round( $total / $qty ) : $total,
				'line_total'   => $total,
				'qty_released' => (int) $item->get_meta( '_ah_qty_released' ),
			);
		}
		return $out;
	}
}
