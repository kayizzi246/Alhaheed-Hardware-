<?php
/**
 * Bringing the shop's product list in from a spreadsheet.
 *
 * WooCommerce already ships a CSV product importer that reads the file
 * in batches, so a list of several thousand products does not time out
 * halfway through and leave the catalogue half-built. Writing a second
 * importer would mean rediscovering all of that, badly.
 *
 * So this does not import anything. It teaches the importer that is
 * already there about the two fields this shop needs and WooCommerce
 * has no concept of:
 *
 *   Unit           what the thing is sold by — bag, length, tin, kg.
 *                  A price with no unit beside it is half a price in a
 *                  hardware shop.
 *   Reorder level  the count below which the manager wants telling.
 *
 * Both appear in the importer's column-mapping screen like any other
 * field, and are matched automatically when the column is named
 * sensibly.
 *
 * The SKU is the product code the app and the pick list show, so it is
 * the one column that must be right.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Import {

	public static function init() {
		// Offer the two fields in the mapping dropdown.
		add_filter( 'woocommerce_csv_product_import_mapping_options', array( __CLASS__, 'columns' ) );

		// Guess the mapping when the heading is an obvious name for it,
		// so most files need no mapping at all.
		add_filter( 'woocommerce_csv_product_import_mapping_default_columns', array( __CLASS__, 'guesses' ) );

		// Save them once WooCommerce has created or updated the product.
		add_filter( 'woocommerce_product_import_pre_insert_product_object', array( __CLASS__, 'stash' ), 10, 2 );
		add_action( 'woocommerce_product_import_inserted_product_object', array( __CLASS__, 'save' ), 10, 2 );

		// Export them again, so a round trip does not lose them.
		add_filter( 'woocommerce_product_export_column_names', array( __CLASS__, 'columns' ) );
		add_filter( 'woocommerce_product_export_product_default_columns', array( __CLASS__, 'columns' ) );
		add_filter( 'woocommerce_product_export_product_column_ah_unit', array( __CLASS__, 'export_unit' ), 10, 2 );
		add_filter( 'woocommerce_product_export_product_column_ah_reorder_level', array( __CLASS__, 'export_reorder' ), 10, 2 );

		add_action( 'admin_menu', array( __CLASS__, 'menu' ), 20 );
	}

	public static function columns( $options ) {
		$options['ah_unit']          = 'Unit (bag, length, tin…)';
		$options['ah_reorder_level'] = 'Reorder level';
		return $options;
	}

	/**
	 * Headings we will match without being asked.
	 *
	 * Spreadsheets come with whatever the person who made them typed,
	 * so the common spellings are all here. Anything else can still be
	 * mapped by hand on the importer's second screen.
	 */
	public static function guesses( $columns ) {
		foreach ( array( 'unit', 'units', 'sold by', 'sold in', 'measure', 'uom' ) as $name ) {
			$columns[ $name ] = 'ah_unit';
		}
		foreach ( array( 'reorder level', 'reorder', 'reorder at', 'minimum stock', 'min stock', 'reorder point' ) as $name ) {
			$columns[ $name ] = 'ah_reorder_level';
		}
		return $columns;
	}

	/**
	 * The importer hands the raw row here before saving. The two values
	 * are kept on the object so `save()` can write them once the
	 * product has an id.
	 */
	public static function stash( $product, $data ) {
		if ( isset( $data['ah_unit'] ) ) {
			$product->update_meta_data( '_ah_unit', sanitize_text_field( (string) $data['ah_unit'] ) );
		}
		if ( isset( $data['ah_reorder_level'] ) && '' !== $data['ah_reorder_level'] ) {
			$product->update_meta_data( '_ah_reorder_level', (int) $data['ah_reorder_level'] );
		}
		return $product;
	}

	/**
	 * A belt-and-braces second write.
	 *
	 * update_meta_data on the object is enough in current WooCommerce,
	 * but the importer has changed shape before and a product that
	 * imports without its unit is a product the app shows as "pc".
	 */
	public static function save( $product, $data ) {
		$id = is_object( $product ) ? $product->get_id() : (int) $product;
		if ( ! $id ) {
			return;
		}
		if ( ! empty( $data['ah_unit'] ) ) {
			update_post_meta( $id, '_ah_unit', sanitize_text_field( (string) $data['ah_unit'] ) );
		}
		if ( isset( $data['ah_reorder_level'] ) && '' !== $data['ah_reorder_level'] ) {
			update_post_meta( $id, '_ah_reorder_level', (int) $data['ah_reorder_level'] );
		}
	}

	public static function export_unit( $value, $product ) {
		return get_post_meta( $product->get_id(), '_ah_unit', true );
	}

	public static function export_reorder( $value, $product ) {
		return get_post_meta( $product->get_id(), '_ah_reorder_level', true );
	}

	// -----------------------------------------------------------------
	// A page that explains the file, and hands over a template
	// -----------------------------------------------------------------

	public static function menu() {
		add_submenu_page(
			'al-hadeed',
			'Import products',
			'Import products',
			'ah_desk_manager',
			'al-hadeed-import',
			array( __CLASS__, 'render' )
		);
	}

	/** The columns the importer understands, and what each one is for. */
	private static function spec() {
		return array(
			array( 'SKU', 'yes', 'AH-CEM-001', 'The product code. The app, the receipt and the pick list all show it, and it is how a re-import knows it is updating a product rather than adding a second one.' ),
			array( 'Name', 'yes', 'Hima Cement 50kg', 'What the customer reads.' ),
			array( 'Regular price', 'yes', '34000', 'Whole shillings. No commas, no "UGX".' ),
			array( 'Stock', 'recommended', '120', 'How many are on the shelf now.' ),
			array( 'Unit', 'recommended', 'bag', 'What it is sold by. Shown next to every quantity.' ),
			array( 'Reorder level', 'recommended', '20', 'Below this, it shows as low stock.' ),
			array( 'Categories', 'optional', 'Cement', 'Becomes the filter in the app. Nested with >.' ),
			array( 'Description', 'optional', '32.5N, Hima', '' ),
			array( 'In stock?', 'optional', '1', 'Leave blank and the stock count decides.' ),
		);
	}

	public static function render() {
		if ( ! current_user_can( 'ah_desk_manager' ) ) {
			wp_die( 'You do not have access to this.' );
		}

		$importer = admin_url( 'edit.php?post_type=product&page=product_importer' );
		$template = add_query_arg( array( 'ah_template' => 1, '_wpnonce' => wp_create_nonce( 'ah_template' ) ), admin_url( 'admin.php?page=al-hadeed-import' ) );
		$sample   = add_query_arg( array( 'ah_install_sample' => 1, '_wpnonce' => wp_create_nonce( 'ah_install_sample' ) ), admin_url( 'admin.php?page=al-hadeed-import' ) );

		// What the sample installer just did. Without this the button
		// redirects back to an identical page and the person has no
		// idea whether anything happened — so they press it again.
		if ( isset( $_GET['ah_added'] ) ) {
			$added = (int) $_GET['ah_added'];
			$kept  = isset( $_GET['ah_kept'] ) ? (int) $_GET['ah_kept'] : 0;

			if ( $added > 0 ) {
				printf(
					'<div class="notice notice-success is-dismissible"><p><strong>%d %s added.</strong> %s'
					. ' <a href="%s">See them in the catalogue</a>.</p></div>',
					$added,
					$added === 1 ? 'product' : 'products',
					$kept
						? esc_html( sprintf(
							'%d %s already on the shelf and were left alone.',
							$kept,
							1 === $kept ? 'product was' : 'products were'
						) )
						: '',
					esc_url( admin_url( 'edit.php?post_type=product' ) )
				);
			} else {
				printf(
					'<div class="notice notice-info is-dismissible"><p><strong>Nothing to add.</strong>'
					. ' All %d sample products are already on the shelf, so none were touched.</p></div>',
					$kept
				);
			}
		}
		?>
		<div class="wrap ah-wrap">
			<header class="ah-head">
				<div>
					<h1>Import products</h1>
					<p class="ah-sub">From the shop's spreadsheet, however long it is.</p>
				</div>
			</header>

			<div class="ah-card">
				<h2>Three steps</h2>
				<ol class="ah-steps">
					<li>
						<strong>Save the spreadsheet as CSV.</strong>
						In Excel: <em>File → Save As → CSV UTF-8 (Comma delimited)</em>.
						The importer reads CSV, not .xlsx.
					</li>
					<li>
						<strong>Check the column headings</strong> against the list below.
						They do not have to be in any particular order, and anything the
						importer cannot place can be matched by hand on its second screen.
					</li>
					<li>
						<strong>Run the importer.</strong> It works through the file in
						batches, so a few thousand products is fine. Leave the tab open
						until it finishes.
					</li>
				</ol>

				<p class="ah-row" style="margin-top:16px">
					<a class="button button-primary ah-go" href="<?php echo esc_url( $importer ); ?>">Open the importer</a>
					<a class="button" href="<?php echo esc_url( $template ); ?>">Download a template CSV</a>
					<a class="button button-secondary" href="<?php echo esc_url( $sample ); ?>">Put 25 sample products on the shelf</a>
				</p>

				<p class="ah-t" style="font-size:13px;margin-top:10px">
					<strong>New shop?</strong> Download the sample catalogue and import it. It
					is twenty-five things an ironmonger actually sells: cement, iron bars,
					roofing sheets, paint, tools, each with a picture, so the app and the
					desks have something real on them from the first minute. The prices are
					in the right range but they are a starting point: change them before you
					trade.
				</p>
			</div>

			<h2 class="ah-section">The columns</h2>
			<div class="ah-card ah-flush">
				<table class="ah-table">
					<thead>
						<tr><th>Heading</th><th>Needed</th><th>Example</th><th>What it is</th></tr>
					</thead>
					<tbody>
						<?php foreach ( self::spec() as $row ) : ?>
							<tr>
								<td><strong><?php echo esc_html( $row[0] ); ?></strong></td>
								<td>
									<span class="ah-chip <?php echo 'yes' === $row[1] ? 'ah-chip-amber' : ( 'recommended' === $row[1] ? 'ah-chip-blue' : '' ); ?>">
										<?php echo esc_html( $row[1] ); ?>
									</span>
								</td>
								<td><code><?php echo esc_html( $row[2] ); ?></code></td>
								<td class="ah-t" style="font-size:13px"><?php echo esc_html( $row[3] ); ?></td>
							</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
			</div>

			<div class="ah-card">
				<h2>Worth knowing before a big file</h2>
				<ul class="ah-bullets">
					<li><strong>Re-importing is how you update prices.</strong> Match on SKU and tick
						<em>Update existing products</em>; the importer changes what is in the file
						and leaves everything else alone.</li>
					<li><strong>Take a backup first.</strong> There is no undo. Export the current
						catalogue from <em>Products → Export</em> and keep the file.</li>
					<li><strong>Prices are whole shillings.</strong> A cell formatted as currency in
						Excel can save as <code>"UGX 34,000"</code>, which imports as nothing.
						Format the column as a plain number before saving.</li>
					<li><strong>A missing unit becomes "pc".</strong> Nothing breaks, but every
						quantity in the app reads "2 pc" instead of "2 bags".</li>
					<li><strong>Try ten rows first.</strong> Copy the first ten into their own file,
						import that, and look at the result in the app before committing
						the whole list.</li>
				</ul>
			</div>
		</div>
		<?php
	}

	// -----------------------------------------------------------------
	// A catalogue to start from
	// -----------------------------------------------------------------

	/**
	 * Twenty-five things an ironmonger in Kampala actually sells.
	 *
	 * This exists so a new shop has something on the shelf the moment
	 * the plugin is installed — the app, the desks and the reports all
	 * look broken against an empty catalogue, and "import your own
	 * spreadsheet first" is a poor way to meet a system.
	 *
	 * The prices are in the right range for 2026 but they are a
	 * starting point, not a price list. Change them before you trade.
	 */
	private static function sample_rows() {
		return array(
			array( 'AH-CEM-001', 'Hima Cement 50kg', 'Cement', 34000, 'bag', 240, 40, '32.5N, general purpose' ),
			array( 'AH-CEM-002', 'Tororo Cement 50kg', 'Cement', 33000, 'bag', 180, 40, '32.5N' ),
			array( 'AH-CEM-003', 'Concrete Block 6in', 'Cement', 3200, 'piece', 900, 200, 'Solid, 400×200×150mm' ),
			array( 'AH-IRN-001', 'Iron Bar Y12 (12m)', 'Iron & Steel', 42000, 'length', 96, 50, 'Deformed, high tensile' ),
			array( 'AH-IRN-002', 'Iron Bar Y10 (12m)', 'Iron & Steel', 29000, 'length', 120, 50, 'Deformed, high tensile' ),
			array( 'AH-IRN-003', 'Angle Bar 2in (6m)', 'Iron & Steel', 48000, 'length', 40, 15, 'Mild steel, 5mm' ),
			array( 'AH-IRN-004', 'Binding Wire 16g', 'Iron & Steel', 9500, 'kg', 150, 30, 'Soft annealed' ),
			array( 'AH-ROF-001', 'Iron Sheet 28G (3m)', 'Roofing', 38500, 'sheet', 85, 20, 'Pre-painted, box profile' ),
			array( 'AH-ROF-002', 'Iron Sheet 30G (3m)', 'Roofing', 31000, 'sheet', 110, 20, 'Galvanised, corrugated' ),
			array( 'AH-ROF-003', 'Roofing Nails 3in', 'Roofing', 8500, 'kg', 200, 40, 'Twisted shank, with washer' ),
			array( 'AH-PNT-001', 'Wall Paint 20L (Silk)', 'Paints', 185000, 'tin', 14, 6, 'Vinyl silk, interior' ),
			array( 'AH-PNT-002', 'Gloss Paint 4L', 'Paints', 62000, 'tin', 30, 10, 'Oil based, for wood and metal' ),
			array( 'AH-PNT-003', 'Paint Brush 4in', 'Paints', 7000, 'piece', 75, 20, 'Synthetic bristle' ),
			array( 'AH-TLS-001', 'Wire Nails 4in', 'Tools', 7500, 'kg', 260, 40, 'Bright, sold per kg' ),
			array( 'AH-TLS-002', 'Claw Hammer 16oz', 'Tools', 22000, 'piece', 38, 10, 'Fibreglass handle' ),
			array( 'AH-TLS-003', 'Tape Measure 5m', 'Tools', 12000, 'piece', 52, 15, 'Auto-lock, metric' ),
			array( 'AH-TLS-004', 'Wheelbarrow (Heavy duty)', 'Tools', 165000, 'piece', 12, 4, 'Steel tray, pneumatic wheel' ),
			array( 'AH-PLM-001', 'PVC Pipe 4in (6m)', 'Plumbing', 27000, 'length', 64, 20, 'Class B, for waste' ),
			array( 'AH-PLM-002', 'Water Tank 1000L', 'Plumbing', 420000, 'piece', 8, 3, 'UV stabilised, 3 layer' ),
			array( 'AH-ELE-001', 'Electric Cable 2.5mm (90m)', 'Electrical', 235000, 'roll', 10, 4, 'Single core, copper' ),
			array( 'AH-ELE-002', 'LED Bulb 12W', 'Electrical', 11000, 'piece', 140, 30, 'E27, warm white' ),
			array( 'AH-TMB-001', 'Timber 4×2 (14ft)', 'Timber', 18000, 'piece', 160, 40, 'Eucalyptus, seasoned' ),
			array( 'AH-HWR-001', 'Padlock 50mm', 'Hardware', 18000, 'piece', 44, 12, 'Brass, three keys' ),
			array( 'AH-HWR-002', 'Door Hinge 4in', 'Hardware', 6500, 'pair', 90, 25, 'Stainless steel' ),
			array( 'AH-HWR-003', 'Wood Screws 2in', 'Hardware', 9000, 'kg', 120, 30, 'Countersunk, sold per kg' ),
		);
	}

	/**
	 * Put the sample catalogue on the shelf.
	 *
	 * Written straight through WooCommerce rather than handed to the CSV
	 * importer, for one reason: the importer fetches images over HTTP,
	 * and a server asking for its own URL fails on more hosts than you
	 * would think — a container that cannot see its own published port,
	 * a firewall that blocks loopback, a site behind basic auth. The
	 * pictures are already on this disk, so they are copied from there
	 * and nothing leaves the machine.
	 *
	 * Safe to run twice: a SKU that already exists is left alone, so
	 * nobody loses a price they have edited.
	 */
	public static function install_sample() {
		if ( empty( $_GET['ah_install_sample'] ) || ! current_user_can( 'ah_desk_manager' ) ) {
			return;
		}
		check_admin_referer( 'ah_install_sample' );

		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$added = 0;
		$kept  = 0;

		foreach ( self::sample_rows() as $row ) {
			list( $sku, $name, $category, $price, $unit, $stock, $reorder, $description ) = $row;

			if ( wc_get_product_id_by_sku( $sku ) ) {
				++$kept;
				continue;
			}

			$product = new WC_Product_Simple();
			$product->set_name( $name );
			$product->set_sku( $sku );
			$product->set_regular_price( (string) $price );
			$product->set_short_description( $description );
			$product->set_manage_stock( true );
			$product->set_stock_quantity( $stock );
			$product->set_stock_status( 'instock' );
			$product->set_status( 'publish' );
			$product->set_catalog_visibility( 'visible' );

			$term = term_exists( $category, 'product_cat' );
			if ( ! $term ) {
				$term = wp_insert_term( $category, 'product_cat' );
			}
			if ( ! is_wp_error( $term ) ) {
				$product->set_category_ids( array( (int) $term['term_id'] ) );
			}

			$product->update_meta_data( '_ah_unit', $unit );
			$product->update_meta_data( '_ah_reorder_level', $reorder );

			$id = $product->save();
			if ( ! $id ) {
				continue;
			}

			self::attach_picture( $id, $sku, $name );
			++$added;
		}

		wp_safe_redirect(
			add_query_arg(
				array( 'page' => 'al-hadeed-import', 'ah_added' => $added, 'ah_kept' => $kept ),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * Copy one of the shipped pictures into the media library and hang
	 * it on the product.
	 *
	 * The file is copied first, because media_handle_sideload MOVES
	 * what it is given — pointing it at the plugin's own file would
	 * empty the folder the second time somebody ran this.
	 */
	private static function attach_picture( $product_id, $sku, $name ) {
		$source = AH_PATH . 'assets/products/' . $sku . '.jpg';
		if ( ! file_exists( $source ) ) {
			return;
		}

		$temp = wp_tempnam( $sku . '.jpg' );
		if ( ! $temp || ! copy( $source, $temp ) ) {
			return;
		}

		$file = array(
			'name'     => $sku . '.jpg',
			'type'     => 'image/jpeg',
			'tmp_name' => $temp,
			'size'     => filesize( $temp ),
		);

		$attachment_id = media_handle_sideload( $file, 0, $name );

		if ( is_wp_error( $attachment_id ) ) {
			@unlink( $temp );
			return;
		}
		set_post_thumbnail( $product_id, $attachment_id );
	}

	/** Hands over a template with the headings already right. */
	public static function template() {
		if ( empty( $_GET['ah_template'] ) || ! current_user_can( 'ah_desk_manager' ) ) {
			return;
		}
		check_admin_referer( 'ah_template' );

		$rows = array(
			array( 'SKU', 'Name', 'Regular price', 'Stock', 'Unit', 'Reorder level', 'Categories', 'Description' ),
			array( 'AH-CEM-001', 'Hima Cement 50kg', '34000', '120', 'bag', '20', 'Cement', '32.5N' ),
			array( 'AH-IRN-001', 'Iron Bar Y12 (12m)', '42000', '18', 'length', '50', 'Iron & Steel', '' ),
			array( 'AH-ROF-001', 'Iron Sheet 28G (3m)', '38500', '64', 'sheet', '15', 'Roofing', 'Pre-painted' ),
			array( 'AH-PNT-001', 'Wall Paint 20L (Silk)', '185000', '4', 'tin', '10', 'Paints', '' ),
			array( 'AH-TLS-001', 'Wire Nails 4in', '7500', '200', 'kg', '40', 'Tools', 'Sold per kg' ),
		);

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="al-hadeed-products-template.csv"' );

		$out = fopen( 'php://output', 'w' );
		// Excel opens a UTF-8 CSV as mojibake without this.
		fprintf( $out, chr( 0xEF ) . chr( 0xBB ) . chr( 0xBF ) );
		foreach ( $rows as $row ) {
			fputcsv( $out, $row );
		}
		fclose( $out );
		exit;
	}
}

add_action( 'admin_init', array( 'AH_Import', 'template' ) );
add_action( 'admin_init', array( 'AH_Import', 'install_sample' ) );
