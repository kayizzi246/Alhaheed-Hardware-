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
						batches, so a few thousand products is fine — leave the tab open
						until it finishes.
					</li>
				</ol>

				<p class="ah-row" style="margin-top:16px">
					<a class="button button-primary ah-go" href="<?php echo esc_url( $importer ); ?>">Open the importer</a>
					<a class="button" href="<?php echo esc_url( $template ); ?>">Download a template CSV</a>
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
