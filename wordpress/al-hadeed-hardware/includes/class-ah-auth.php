<?php
/**
 * Who is calling the API.
 *
 * The phone app and the Next.js panel hold a bearer token, exactly as
 * they did against the Node API, so neither client had to change how it
 * signs in. The token is issued and checked here.
 *
 * It is a signed statement, not a stored session: `payload.signature`,
 * where the signature is HMAC-SHA256 over the payload using this
 * WordPress installation's own auth salt. Nothing is kept in the
 * database, so there is no session table to grow and no extra query on
 * every request — and changing the salts in wp-config.php signs
 * everybody out, which is the emergency lever worth having.
 *
 * Two ways in, as before:
 *   staff     phone or email + password  (a real WordPress password)
 *   customer  phone + a 6-digit code sent by SMS
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Auth {

	const TTL = 12 * HOUR_IN_SECONDS; // one working day

	private static function secret() {
		// Distinct from WordPress's own cookies, so a token from here is
		// useless as a login cookie and vice versa.
		return wp_salt( 'auth' ) . '|al-hadeed-api';
	}

	private static function b64( $raw ) {
		return rtrim( strtr( base64_encode( $raw ), '+/', '-_' ), '=' );
	}

	private static function unb64( $raw ) {
		return base64_decode( strtr( $raw, '-_', '+/' ) );
	}

	/** Issue a token for a user. */
	public static function issue( $user_id ) {
		$payload = wp_json_encode(
			array(
				'uid' => (int) $user_id,
				'iat' => time(),
				'exp' => time() + self::TTL,
			)
		);
		$body = self::b64( $payload );
		$sig  = self::b64( hash_hmac( 'sha256', $body, self::secret(), true ) );
		return $body . '.' . $sig;
	}

	/**
	 * The user behind a token, or null.
	 *
	 * The signature is compared in constant time: a plain `===` on a
	 * signature leaks how much of it was right through how long the
	 * comparison took.
	 */
	public static function user_from_token( $token ) {
		if ( ! $token || false === strpos( $token, '.' ) ) {
			return null;
		}
		list( $body, $sig ) = explode( '.', $token, 2 );

		$expected = self::b64( hash_hmac( 'sha256', $body, self::secret(), true ) );
		if ( ! hash_equals( $expected, $sig ) ) {
			return null;
		}

		$payload = json_decode( self::unb64( $body ), true );
		if ( ! is_array( $payload ) || empty( $payload['uid'] ) ) {
			return null;
		}
		if ( empty( $payload['exp'] ) || $payload['exp'] < time() ) {
			return null;
		}

		$user = get_user_by( 'id', (int) $payload['uid'] );
		if ( ! $user ) {
			return null;
		}
		if ( 'suspended' === get_user_meta( $user->ID, 'ah_status', true ) ) {
			return null;
		}
		return $user;
	}

	/** The caller of the current REST request, or null. */
	public static function current( $request = null ) {
		static $cache = null;
		if ( null !== $cache ) {
			return $cache ?: null;
		}

		$header = '';
		if ( $request && method_exists( $request, 'get_header' ) ) {
			$header = $request->get_header( 'authorization' );
		}
		if ( ! $header && isset( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
			$header = $_SERVER['HTTP_AUTHORIZATION'];
		}
		// Apache with CGI hides the header unless it is passed through,
		// and plenty of shared hosts are exactly that. The .htaccess
		// shipped with this plugin restores it; this is the fallback.
		if ( ! $header && isset( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
			$header = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
		}

		$user = null;
		if ( $header && preg_match( '/Bearer\s+(.+)/i', $header, $m ) ) {
			$user = self::user_from_token( trim( $m[1] ) );
		}

		// Somebody already signed into wp-admin counts too, which is
		// what makes the desk screens work without a second login.
		if ( ! $user && is_user_logged_in() ) {
			$user = wp_get_current_user();
		}

		$cache = $user ? $user : false;
		return $user;
	}

	/** Find a customer by phone, however either side wrote the number. */
	public static function user_by_phone( $phone ) {
		$phone = AH_Sms::normalise_phone( $phone );
		if ( ! $phone ) {
			return null;
		}

		$users = get_users(
			array(
				'meta_key'   => 'ah_phone',
				'meta_value' => $phone,
				'number'     => 1,
				'fields'     => 'all',
			)
		);
		if ( $users ) {
			return $users[0];
		}

		// Orders placed through the website checkout only ever set the
		// WooCommerce billing field, so it is the fallback.
		$users = get_users(
			array(
				'meta_key'   => 'billing_phone',
				'meta_value' => $phone,
				'number'     => 1,
				'fields'     => 'all',
			)
		);
		return $users ? $users[0] : null;
	}

	// -----------------------------------------------------------------
	// One-time codes
	// -----------------------------------------------------------------

	/** True while the shop is being set up and every code is 123456. */
	public static function dev_mode() {
		return 'yes' === AH_Sms::option( 'otp_dev_mode', 'yes' );
	}

	public static function issue_otp( $phone ) {
		global $wpdb;
		$table = AH_Install::table( 'otp' );
		$phone = AH_Sms::normalise_phone( $phone );

		$code = self::dev_mode() ? '123456' : (string) wp_rand( 100000, 999999 );

		// Any code already out for this number stops working, so an old
		// SMS cannot be used after a new one is asked for.
		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET consumed = 1 WHERE phone = %s AND consumed = 0", $phone ) );

		$wpdb->insert(
			$table,
			array(
				'phone'      => $phone,
				'code'       => $code,
				'expires_at' => gmdate( 'Y-m-d H:i:s', time() + 5 * MINUTE_IN_SECONDS ),
				'consumed'   => 0,
				'created_at' => current_time( 'mysql' ),
			)
		);

		return $code;
	}

	/** Consumes the code. A code works once, whether or not it worked. */
	public static function check_otp( $phone, $code ) {
		global $wpdb;
		$table = AH_Install::table( 'otp' );
		$phone = AH_Sms::normalise_phone( $phone );

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$table}
				  WHERE phone = %s AND code = %s AND consumed = 0 AND expires_at > %s
				  ORDER BY id DESC LIMIT 1",
				$phone,
				(string) $code,
				gmdate( 'Y-m-d H:i:s' )
			)
		);

		if ( ! $row ) {
			return false;
		}
		$wpdb->update( $table, array( 'consumed' => 1 ), array( 'id' => $row->id ) );
		return true;
	}
}
