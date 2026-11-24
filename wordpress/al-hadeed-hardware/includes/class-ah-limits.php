<?php
/**
 * How many tries somebody gets before they have to wait.
 *
 * Without this, anyone could try passwords against the manager's
 * account for as long as they liked, guess a six-digit SMS code at
 * leisure — a code accepted any number of wrong answers for its five
 * minutes — and ask for codes without end, spending the shop's SMS
 * credit and filling a customer's phone with texts.
 *
 * Counted per account (or phone number) and per connection, kept in
 * transients so it needs no table and works on any host. A success
 * clears the account's count: a cashier who mistypes twice and then
 * gets it right starts the day fresh.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Limits {

	/**
	 * The rules: how many in how long, and what to tell somebody who
	 * has used them up.
	 */
	private static function rules() {
		return array(
			// Wrong passwords for one account.
			'login_account' => array( 5, 15 * MINUTE_IN_SECONDS, 'Too many wrong passwords for this account. Wait %s, or sign in with an SMS code instead.' ),
			// Wrong passwords from one connection, across any accounts.
			'login_ip'      => array( 20, 15 * MINUTE_IN_SECONDS, 'Too many wrong passwords from this connection. Wait %s and try again.' ),
			// Codes texted to one number.
			'otp_send'      => array( 3, 10 * MINUTE_IN_SECONDS, 'Three codes have already been sent to this number. Wait %s before asking for another.' ),
			// Codes asked for from one connection.
			'otp_send_ip'   => array( 10, HOUR_IN_SECONDS, 'Too many codes asked for from this connection. Wait %s and try again.' ),
			// Wrong codes for one number; on the last, the code stops working.
			'otp_guess'     => array( 5, 10 * MINUTE_IN_SECONDS, 'Too many wrong codes. That code no longer works. Wait %s, then ask for a new one.' ),
		);
	}

	/**
	 * Where the request really came from.
	 *
	 * Behind Cloudflare every request arrives from a Cloudflare address,
	 * which would put the whole country in one bucket. Cloudflare passes
	 * the real one along. The per-account limit does not depend on this,
	 * so a forged header gains nothing against an account.
	 */
	public static function ip() {
		foreach ( array( 'HTTP_CF_CONNECTING_IP', 'REMOTE_ADDR' ) as $key ) {
			if ( ! empty( $_SERVER[ $key ] ) ) {
				$ip = filter_var( wp_unslash( $_SERVER[ $key ] ), FILTER_VALIDATE_IP );
				if ( $ip ) {
					return $ip;
				}
			}
		}
		return 'unknown';
	}

	private static function key( $rule, $who ) {
		return 'ah_lim_' . $rule . '_' . md5( strtolower( (string) $who ) );
	}

	/**
	 * Refuse if the limit is already used up. Does not count anything.
	 *
	 * @return true|WP_Error
	 */
	public static function check( $rule, $who ) {
		$rules = self::rules();
		list( $max, $window, $message ) = $rules[ $rule ];
		$state = get_transient( self::key( $rule, $who ) );

		if ( is_array( $state ) && $state['n'] >= $max ) {
			$wait = max( 1, (int) $state['until'] - time() );
			return new WP_Error(
				'ah_too_many',
				sprintf( $message, self::say_wait( $wait ) ),
				array( 'status' => 429, 'retryAfter' => $wait )
			);
		}
		return true;
	}

	/** Count one more. The window starts at the first try, not the last. */
	public static function hit( $rule, $who ) {
		$rules = self::rules();
		list( , $window ) = $rules[ $rule ];
		$key   = self::key( $rule, $who );
		$state = get_transient( $key );

		if ( ! is_array( $state ) || $state['until'] <= time() ) {
			$state = array( 'n' => 0, 'until' => time() + $window );
		}
		$state['n']++;
		set_transient( $key, $state, max( 1, $state['until'] - time() ) );
		return $state['n'];
	}

	/** Start again, after a success. */
	public static function clear( $rule, $who ) {
		delete_transient( self::key( $rule, $who ) );
	}

	/** How many tries are left — so the screen can warn before the last one. */
	public static function left( $rule, $who ) {
		$rules = self::rules();
		$state = get_transient( self::key( $rule, $who ) );
		$used  = is_array( $state ) ? (int) $state['n'] : 0;
		return max( 0, $rules[ $rule ][0] - $used );
	}

	private static function say_wait( $seconds ) {
		if ( $seconds < 90 ) {
			return 'a minute';
		}
		$minutes = (int) ceil( $seconds / 60 );
		return $minutes . ' minutes';
	}
}
