<?php
/**
 * Pictures and bulk edits, from the web panel.
 *
 * Three jobs the manager used to have to go into wp-admin for:
 *
 *   upload a photograph of a product
 *   bring a price list in from a spreadsheet
 *   take the catalogue back out again
 *
 * The spreadsheet is parsed in the browser, not here. PHP cannot read
 * an .xlsx without a library — the format is a zip of XML — and
 * shipping one into a plugin that has to run on cheap shared hosting
 * is a lot of weight for one screen. The panel already has the file in
 * memory, so it reads it there and sends rows. That also means the
 * person sees what was understood before anything is written.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Catalogue {

	public static function routes() {
		$ns      = AH_Rest::NS;
		$post    = WP_REST_Server::CREATABLE;
		$get     = WP_REST_Server::READABLE;
		$manager = AH_Rest::desk( array( 'manager' ) );

		register_rest_route( $ns, '/manager/products/(?P<id>\d+)/image', array(
			'methods'             => $post,
			'permission_callback' => $manager,
			'callback'            => array( __CLASS__, 'upload_image' ),
		) );

		register_rest_route( $ns, '/manager/products/import', array(
			'methods'             => $post,
			'permission_callback' => $manager,
			'callback'            => array( __CLASS__, 'import' ),
		) );

	}

	// -----------------------------------------------------------------
	// One picture
	// -----------------------------------------------------------------

	/**
	 * Attach an uploaded photograph to a product.
	 *
	 * Sent as multipart, which is the one place this API is not JSON —
	 * base64 in a JSON body would inflate every photo by a third and
	 * push a 4MB picture past the post limit on a lot of shared hosts.
	 */
	public static function upload_image( $req ) {
		$product = wc_get_product( (int) $req['id'] );
		if ( ! $product ) {
			return new WP_Error( 'ah_not_found', 'Product not found', array( 'status' => 404 ) );
		}

		$files = $req->get_file_params();
		if ( empty( $files['file'] ) ) {
			return new WP_Error( 'ah_no_file', 'No picture was sent', array( 'status' => 400 ) );
		}

		$file = $files['file'];

		if ( ! empty( $file['error'] ) ) {
			return new WP_Error(
				'ah_upload_failed',
				'The picture did not arrive in one piece. Try a smaller file.',
				array( 'status' => 400 )
			);
		}

		// Trust the bytes, not the name a browser put on them.
		$check = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] );
		$type  = $check['type'] ? $check['type'] : '';
		if ( ! in_array( $type, array( 'image/jpeg', 'image/png', 'image/webp', 'image/gif' ), true ) ) {
			return new WP_Error(
				'ah_not_an_image',
				'That is not a picture. Use a JPG, PNG or WEBP.',
				array( 'status' => 400 )
			);
		}

		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$attachment_id = media_handle_sideload( $file, 0, $product->get_name() );
		if ( is_wp_error( $attachment_id ) ) {
			return new WP_Error(
				'ah_upload_failed',
				'Could not save the picture: ' . $attachment_id->get_error_message(),
				array( 'status' => 400 )
			);
		}

		set_post_thumbnail( $product->get_id(), $attachment_id );

		return array( 'product' => AH_Shape::product( $product->get_id() ) );
	}

	// -----------------------------------------------------------------
	// A spreadsheet in
	// -----------------------------------------------------------------

	/**
	 * Write rows the panel read out of a spreadsheet.
	 *
	 * Keyed on the code. A row whose code is already on the shelf
	 * updates that product; a new code adds one. Nothing is deleted —
	 * a spreadsheet that happens to be missing a line is a spreadsheet
	 * somebody trimmed, not an instruction to discontinue a product.
	 *
	 * Every row is reported back, so the panel can say "41 updated, 3
	 * added, 2 could not be read" rather than "done".
	 */
	public static function import( $req ) {
		$rows = $req->get_param( 'rows' );
		if ( ! is_array( $rows ) || ! $rows ) {
			return new WP_Error( 'ah_no_rows', 'The file had no rows in it', array( 'status' => 400 ) );
		}
		if ( count( $rows ) > 2000 ) {
			return new WP_Error(
				'ah_too_many',
				'That is more than 2,000 rows. Split the file into smaller ones and bring them in a few at a time.',
				array( 'status' => 400 )
			);
		}

		$added   = 0;
		$updated = 0;
		$failed  = array();

		foreach ( $rows as $i => $row ) {
			$code = isset( $row['code'] ) ? sanitize_text_field( (string) $row['code'] ) : '';
			$name = isset( $row['name'] ) ? sanitize_text_field( (string) $row['name'] ) : '';

			if ( '' === $code ) {
				$failed[] = array( 'row' => $i + 2, 'why' => 'No product code' );
				continue;
			}

			$id      = wc_get_product_id_by_sku( $code );
			$product = $id ? wc_get_product( $id ) : new WC_Product_Simple();

			if ( ! $id ) {
				if ( '' === $name ) {
					$failed[] = array( 'row' => $i + 2, 'why' => 'New product with no name' );
					continue;
				}
				$product->set_sku( $code );
				$product->set_status( 'publish' );
				$product->set_catalog_visibility( 'visible' );
			}

			if ( '' !== $name ) {
				$product->set_name( $name );
			}
			if ( isset( $row['price'] ) && '' !== $row['price'] ) {
				$product->set_regular_price( (string) (int) round( (float) $row['price'] ) );
			}
			if ( isset( $row['description'] ) && '' !== $row['description'] ) {
				$product->set_short_description( sanitize_text_field( (string) $row['description'] ) );
			}

			if ( ! empty( $row['category'] ) ) {
				$name_c = sanitize_text_field( (string) $row['category'] );
				$term   = term_exists( $name_c, 'product_cat' );
				if ( ! $term ) {
					$term = wp_insert_term( $name_c, 'product_cat' );
				}
				if ( ! is_wp_error( $term ) ) {
					$product->set_category_ids( array( (int) $term['term_id'] ) );
				}
			}

			$saved = $product->save();
			if ( ! $saved ) {
				$failed[] = array( 'row' => $i + 2, 'why' => 'Could not be saved' );
				continue;
			}

			if ( isset( $row['unit'] ) && '' !== $row['unit'] ) {
				update_post_meta( $saved, '_ah_unit', sanitize_text_field( (string) $row['unit'] ) );
			}
			$meta = array(
				'reorderLevel' => '_ah_reorder_level',
				'reorderQty'   => '_ah_reorder_qty',
				'cost'         => '_ah_cost',
			);
			foreach ( $meta as $field => $key ) {
				if ( isset( $row[ $field ] ) && '' !== $row[ $field ] ) {
					update_post_meta( $saved, $key, max( 0, (int) round( (float) $row[ $field ] ) ) );
				}
			}
			foreach ( array( 'supplier' => '_ah_supplier', 'shelf' => '_ah_shelf' ) as $field => $key ) {
				if ( isset( $row[ $field ] ) && '' !== $row[ $field ] ) {
					update_post_meta( $saved, $key, sanitize_text_field( (string) $row[ $field ] ) );
				}
			}

			// A new count from a spreadsheet goes in the stock book like any
			// other, so an import never quietly rewrites what is on the shelf.
			if ( isset( $row['stock'] ) && '' !== $row['stock'] ) {
				$count = max( 0, (int) $row['stock'] );
				$fresh = wc_get_product( $saved );
				$was   = $fresh->get_manage_stock() ? (int) $fresh->get_stock_quantity() : null;
				if ( $was !== $count ) {
					if ( ! $fresh->get_manage_stock() ) {
						$fresh->set_manage_stock( true );
						$fresh->save();
					}
					wc_update_product_stock( $fresh, $count, 'set' );
					AH_Stock::record( $saved, $id ? 'count' : 'opening', $count - (int) $was, (int) $was, $count, array(
						'unit_cost' => (int) get_post_meta( $saved, '_ah_cost', true ),
						'note'      => 'From a spreadsheet import',
					) );
				}
			}

			if ( $id ) {
				++$updated;
			} else {
				++$added;
			}
		}

		return array(
			'added'   => $added,
			'updated' => $updated,
			'failed'  => $failed,
		);
	}

	// -----------------------------------------------------------------
	// The catalogue out
	// -----------------------------------------------------------------

	/**
	 * Every product, in the shape the importer reads back.
	 *
	 * Round-trippable on purpose: export, edit the prices in Excel,
	 * import, and the shop has the new prices. That is the whole point
	 * of an export for a shop this size — far more use than a report
	 * nobody can act on.
	 */
	public static function export() {
		$out = array();

		foreach ( wc_get_products( array( 'limit' => -1, 'status' => array( 'publish', 'draft' ) ) ) as $product ) {
			$shaped = AH_Shape::product( $product );
			if ( ! $shaped ) {
				continue;
			}
			$out[] = array(
				'code'         => $shaped['code'],
				'name'         => $shaped['name'],
				'category'     => $shaped['category_name'],
				'price'        => $shaped['price'],
				'cost'         => (int) get_post_meta( $product->get_id(), '_ah_cost', true ),
				'unit'         => $shaped['unit'],
				'stock'        => $shaped['stock_available'],
				'reorderLevel' => $shaped['reorder_level'],
				'reorderQty'   => (int) get_post_meta( $product->get_id(), '_ah_reorder_qty', true ),
				'supplier'     => $shaped['supplier'],
				'shelf'        => (string) get_post_meta( $product->get_id(), '_ah_shelf', true ),
				'description'  => $shaped['description'],
			);
		}

		return array( 'products' => $out );
	}
}
