<?php
/**
 * Proof of payment: the screenshot behind a transaction reference.
 *
 * A reference typed by hand is a claim. The mobile money message it
 * came from is the evidence — and it is what Accounts actually wants
 * to look at when the statement and the till disagree. So the cashier
 * can attach the picture, the panel reads the transaction ID off it,
 * and the picture stays with the payment for as long as the payment
 * exists.
 *
 * ── Why not the media library ──
 *
 * Everything in the media library has a public URL. These pictures
 * carry customers' names, phone numbers and balances. They are kept in
 * a folder the web server refuses to serve, and handed out only
 * through an endpoint that checks the desk first.
 *
 * ── Why the reading happens in the browser ──
 *
 * Reading text off a picture on the server would mean either a
 * library PHP shared hosting does not have, or sending the customer's
 * message to an outside service. In the browser it costs the shop
 * nothing and the picture goes nowhere it was not already going.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Proofs {

	/** A phone screenshot is well under this; a raw camera photo may not be. */
	const MAX_BYTES = 8388608; // 8 MB

	const TYPES = array(
		'image/jpeg' => 'jpg',
		'image/png'  => 'png',
		'image/webp' => 'webp',
	);

	public static function routes() {
		$ns = AH_Rest::NS;

		// After the CORS filter (priority 10), so its headers are out first.
		add_filter( 'rest_pre_serve_request', array( __CLASS__, 'stream' ), 20 );

		// Anyone who handles the money may see the proof of it.
		register_rest_route(
			$ns,
			'/payments/(?P<id>\d+)/proof',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => AH_Rest::desk( array( 'cashier', 'accounts', 'manager' ) ),
				'callback'            => array( __CLASS__, 'serve' ),
			)
		);

		// Asked while the cashier is still typing, so a reference that
		// already paid for another order is caught before they press
		// Confirm, not after.
		register_rest_route(
			$ns,
			'/cashier/check-ref',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'permission_callback' => AH_Rest::desk( array( 'cashier', 'manager' ) ),
				'callback'            => array( __CLASS__, 'check_ref' ),
			)
		);
	}

	// -----------------------------------------------------------------
	// References
	// -----------------------------------------------------------------

	/**
	 * One spelling for every reference.
	 *
	 * "mp261119 0934", "MP2611190934" and " mp2611190934 " are the same
	 * transaction. Stored and compared in one form, or the duplicate
	 * check is defeated by a space.
	 */
	public static function normalise_ref( $ref ) {
		return strtoupper( preg_replace( '/\s+/', '', (string) $ref ) );
	}

	/**
	 * The order this reference has already paid for, if any.
	 *
	 * A payment Accounts rejected does not count — the cashier is
	 * expected to record that same transaction again once it has been
	 * sorted out.
	 *
	 * @return array|null { order_id, receipt_no }
	 */
	public static function already_used( $ref, $except_order = 0 ) {
		global $wpdb;
		$ref = self::normalise_ref( $ref );
		if ( '' === $ref ) {
			return null;
		}
		$t = AH_Install::table( 'payments' );

		return $wpdb->get_row(
			$wpdb->prepare(
				"SELECT order_id, receipt_no FROM {$t}
				  WHERE REPLACE(UPPER(transaction_ref), ' ', '') = %s
				    AND verified <> -1
				    AND order_id <> %d
				  ORDER BY id DESC LIMIT 1",
				$ref,
				(int) $except_order
			),
			ARRAY_A
		);
	}

	public static function check_ref( $req ) {
		$hit = self::already_used( $req->get_param( 'ref' ), (int) $req->get_param( 'order' ) );
		if ( ! $hit ) {
			return array( 'used' => false );
		}
		$order = wc_get_order( (int) $hit['order_id'] );
		return array(
			'used'      => true,
			'orderNo'   => $order ? AH_Shape::order_no( $order ) : '#' . $hit['order_id'],
			'receiptNo' => $hit['receipt_no'],
		);
	}

	// -----------------------------------------------------------------
	// Storing the picture
	// -----------------------------------------------------------------

	/** The folder, created on first use with the web server told to keep out. */
	private static function dir() {
		$up  = wp_upload_dir( null, false );
		$dir = trailingslashit( $up['basedir'] ) . 'ah-proofs';

		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
		}
		// Apache reads .htaccess; nginx ignores it, which is why the
		// file names are also unguessable. index.php stops a directory
		// listing on servers that would otherwise give one.
		if ( ! file_exists( $dir . '/.htaccess' ) ) {
			file_put_contents( $dir . '/.htaccess', "Require all denied\nDeny from all\n" );
		}
		if ( ! file_exists( $dir . '/index.php' ) ) {
			file_put_contents( $dir . '/index.php', "<?php // Silence.\n" );
		}
		return $dir;
	}

	/**
	 * Keep an uploaded picture, after checking it really is one.
	 *
	 * The type is decided from the bytes, not from the name or what the
	 * browser claimed: a PHP file renamed payment.jpg is refused.
	 *
	 * @param array $file One entry from $_FILES.
	 * @return string|WP_Error The stored file name.
	 */
	public static function store( $file ) {
		if ( empty( $file ) || ! isset( $file['tmp_name'] ) || UPLOAD_ERR_OK !== (int) $file['error'] ) {
			return new WP_Error( 'ah_proof_upload', 'The picture did not arrive. Try attaching it again.', array( 'status' => 400 ) );
		}
		if ( (int) $file['size'] > self::MAX_BYTES ) {
			return new WP_Error( 'ah_proof_big', 'That picture is over 8 MB. A screenshot of the message is enough.', array( 'status' => 400 ) );
		}

		$info = @getimagesize( $file['tmp_name'] ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		$mime = $info && isset( $info['mime'] ) ? $info['mime'] : '';
		if ( ! isset( self::TYPES[ $mime ] ) ) {
			return new WP_Error( 'ah_proof_type', 'That is not a picture. Attach a screenshot or photo of the payment message.', array( 'status' => 400 ) );
		}

		$sub = current_time( 'Y/m' );
		$dir = self::dir() . '/' . $sub;
		wp_mkdir_p( $dir );

		$name = $sub . '/' . wp_generate_password( 32, false ) . '.' . self::TYPES[ $mime ];
		$dest = self::dir() . '/' . $name;

		if ( ! @move_uploaded_file( $file['tmp_name'], $dest ) && ! @rename( $file['tmp_name'], $dest ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors
			return new WP_Error( 'ah_proof_save', 'The picture could not be saved on the server.', array( 'status' => 500 ) );
		}
		@chmod( $dest, 0640 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors

		return $name;
	}

	/** Remove a stored picture — used when the payment it was for is refused. */
	public static function discard( $name ) {
		$path = self::path( $name );
		if ( $path && file_exists( $path ) ) {
			@unlink( $path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		}
	}

	/** The file on disk, or null if the name tries to climb out of the folder. */
	private static function path( $name ) {
		$name = (string) $name;
		if ( '' === $name || ! preg_match( '#^\d{4}/\d{2}/[A-Za-z0-9]{32}\.(jpg|png|webp)$#', $name ) ) {
			return null;
		}
		return self::dir() . '/' . $name;
	}

	// -----------------------------------------------------------------
	// Handing it back
	// -----------------------------------------------------------------

	public static function serve( $req ) {
		global $wpdb;
		$t   = AH_Install::table( 'payments' );
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT proof_file FROM {$t} WHERE id = %d", (int) $req['id'] ),
			ARRAY_A
		);

		$path = $row ? self::path( $row['proof_file'] ) : null;
		if ( ! $path || ! file_exists( $path ) ) {
			return new WP_Error( 'ah_no_proof', 'No picture was attached to this payment', array( 'status' => 404 ) );
		}

		$ext  = pathinfo( $path, PATHINFO_EXTENSION );
		$mime = array_search( $ext, self::TYPES, true );

		// Not sent from here. The headers that let the panel read this
		// across origins are added in rest_pre_serve_request, which runs
		// after this returns — exit here and the browser refuses the
		// picture. So the file is remembered and streamed from that
		// filter instead, once the CORS headers are already out.
		self::$streaming = $path;

		$response = new WP_REST_Response( null, 200 );
		$response->header( 'Content-Type', $mime ? $mime : 'application/octet-stream' );
		$response->header( 'Content-Length', (string) filesize( $path ) );
		$response->header( 'X-Content-Type-Options', 'nosniff' );
		$response->header( 'Cache-Control', 'private, no-store' );
		return $response;
	}

	/** Set by serve(), read by stream(). */
	private static $streaming = null;

	public static function stream( $served ) {
		if ( ! self::$streaming ) {
			return $served;
		}
		readfile( self::$streaming ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		self::$streaming = null;
		return true;
	}
}
