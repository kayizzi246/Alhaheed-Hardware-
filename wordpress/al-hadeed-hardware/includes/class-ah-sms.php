<?php
/**
 * The SMS gateway.
 *
 * One `send()` for the whole plugin, with the provider chosen in
 * Settings so nothing else knows or cares which company carries the
 * message.
 *
 *   log            writes to the WordPress debug log and sends nothing.
 *                  The default: no account, no credit, no cost, and the
 *                  login codes are readable while you are setting up.
 *   egosms         EgoSMS / Pahappa Comms, the shop's gateway
 *   africastalking another one used in Uganda
 *   generic        any gateway that takes a JSON POST
 *
 * A failure never stops the shop. The cashier still takes the money if
 * the gateway is down; the failure is logged and the caller is told.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Sms {

	/** 0772 123 456 and 772123456 both mean +256772123456. */
	public static function normalise_phone( $raw ) {
		$digits = preg_replace( '/[^\d+]/', '', (string) $raw );
		if ( '' === $digits ) {
			return '';
		}
		if ( '+' === $digits[0] ) {
			return $digits;
		}
		if ( 0 === strpos( $digits, '256' ) ) {
			return '+' . $digits;
		}
		if ( '0' === $digits[0] ) {
			return '+256' . substr( $digits, 1 );
		}
		if ( 9 === strlen( $digits ) ) {
			return '+256' . $digits;
		}
		return $digits;
	}

	public static function option( $key, $default = '' ) {
		$opts = get_option( 'ah_settings', array() );
		return isset( $opts[ $key ] ) && '' !== $opts[ $key ] ? $opts[ $key ] : $default;
	}

	public static function shop_name() {
		return self::option( 'shop_name', get_bloginfo( 'name' ) );
	}

	/**
	 * Send one message.
	 *
	 * @return array{ok:bool,provider:string,to:string,error?:string}
	 */
	public static function send( $phone, $message ) {
		$to       = self::normalise_phone( $phone );
		$provider = self::option( 'sms_provider', 'log' );

		if ( ! $to ) {
			return array( 'ok' => false, 'provider' => $provider, 'to' => '', 'error' => 'no phone number' );
		}

		if ( 'log' === $provider ) {
			// Deliberately loud: a silent no-op gateway is the kind of
			// thing nobody notices until it is in production.
			error_log( "[Al Hadeed SMS — not sent, provider is \"log\"] to {$to}: {$message}" );
			return array( 'ok' => true, 'provider' => $provider, 'to' => $to );
		}

		if ( 'egosms' === $provider ) {
			return self::via_egosms( $to, $message );
		}
		if ( 'africastalking' === $provider ) {
			return self::via_africastalking( $to, $message );
		}
		if ( 'generic' === $provider ) {
			return self::via_generic( $to, $message );
		}

		return array( 'ok' => false, 'provider' => $provider, 'to' => $to, 'error' => 'unknown provider' );
	}

	/**
	 * EgoSMS (Pahappa Comms).
	 *
	 * https://developers.pahappa.com/docs/sending-sms/api-specs-and-usage/
	 * It answers HTTP 200 even when it refuses the message, so `Status` in
	 * the body is what must be read.
	 */
	private static function via_egosms( $to, $message ) {
		$user = trim( self::option( 'sms_username' ) );
		$pass = self::option( 'sms_api_key' );
		if ( '' === $user || '' === $pass ) {
			return self::fail( 'egosms', $to, 'API username or API password is not set' );
		}

		$one = array(
			// International, without the plus.
			'number'   => ltrim( $to, '+' ),
			'message'  => $message,
			'priority' => 0,
		);
		$from = trim( self::option( 'sms_sender_id' ) );
		if ( '' !== $from ) {
			$one['senderid'] = $from;
		}

		$res = wp_remote_post(
			apply_filters( 'ah_egosms_url', 'https://comms.egosms.co/api/v1/json/' ),
			array(
				'timeout' => 20,
				'headers' => array( 'Content-Type' => 'application/json', 'Accept' => 'application/json' ),
				'body'    => wp_json_encode(
					array(
						'method'   => 'SendSms',
						'userdata' => array( 'username' => $user, 'password' => $pass ),
						'msgdata'  => array( $one ),
					)
				),
			)
		);

		if ( is_wp_error( $res ) ) {
			return self::fail( 'egosms', $to, $res->get_error_message() );
		}
		$json = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( ! is_array( $json ) || ! isset( $json['Status'] ) ) {
			return self::fail( 'egosms', $to, 'HTTP ' . wp_remote_retrieve_response_code( $res ) . ', no status in the answer' );
		}
		if ( 'OK' !== strtoupper( (string) $json['Status'] ) ) {
			return self::fail( 'egosms', $to, isset( $json['Message'] ) ? (string) $json['Message'] : 'refused' );
		}
		return array( 'ok' => true, 'provider' => 'egosms', 'to' => $to );
	}

	private static function via_africastalking( $to, $message ) {
		$key  = self::option( 'sms_api_key' );
		$user = self::option( 'sms_username' );
		if ( ! $key || ! $user ) {
			return self::fail( 'africastalking', $to, 'API key or username is not set' );
		}

		$body = array(
			'username' => $user,
			'to'       => $to,
			'message'  => $message,
		);
		$from = self::option( 'sms_sender_id' );
		if ( $from ) {
			$body['from'] = $from;
		}

		$res = wp_remote_post(
			'https://api.africastalking.com/version1/messaging',
			array(
				'timeout' => 20,
				'headers' => array(
					'apiKey'       => $key,
					'Content-Type' => 'application/x-www-form-urlencoded',
					'Accept'       => 'application/json',
				),
				'body'    => $body,
			)
		);

		if ( is_wp_error( $res ) ) {
			return self::fail( 'africastalking', $to, $res->get_error_message() );
		}

		$code = wp_remote_retrieve_response_code( $res );
		$text = wp_remote_retrieve_body( $res );
		if ( $code < 200 || $code >= 300 ) {
			return self::fail( 'africastalking', $to, "HTTP {$code}: " . substr( $text, 0, 200 ) );
		}

		// The gateway answers 201 even when it refused the individual
		// number, so the per-recipient status is what must be read.
		$json  = json_decode( $text, true );
		$first = isset( $json['SMSMessageData']['Recipients'][0] )
			? $json['SMSMessageData']['Recipients'][0]
			: null;

		if ( ! $first ) {
			$msg = isset( $json['SMSMessageData']['Message'] ) ? $json['SMSMessageData']['Message'] : 'no recipients accepted';
			return self::fail( 'africastalking', $to, $msg );
		}
		if ( ! preg_match( '/success/i', $first['status'] ) ) {
			return self::fail( 'africastalking', $to, $first['status'] );
		}

		return array( 'ok' => true, 'provider' => 'africastalking', 'to' => $to );
	}

	private static function via_generic( $to, $message ) {
		$url = self::option( 'sms_url' );
		if ( ! $url ) {
			return self::fail( 'generic', $to, 'SMS URL is not set' );
		}

		$headers = array( 'Content-Type' => 'application/json', 'Accept' => 'application/json' );
		$key     = self::option( 'sms_api_key' );
		if ( $key ) {
			$headers['Authorization'] = 'Bearer ' . $key;
		}

		$res = wp_remote_post(
			$url,
			array(
				'timeout' => 20,
				'headers' => $headers,
				'body'    => wp_json_encode(
					array(
						'to'      => $to,
						'message' => $message,
						'from'    => self::option( 'sms_sender_id' ),
					)
				),
			)
		);

		if ( is_wp_error( $res ) ) {
			return self::fail( 'generic', $to, $res->get_error_message() );
		}
		$code = wp_remote_retrieve_response_code( $res );
		if ( $code < 200 || $code >= 300 ) {
			return self::fail( 'generic', $to, "HTTP {$code}" );
		}
		return array( 'ok' => true, 'provider' => 'generic', 'to' => $to );
	}

	private static function fail( $provider, $to, $error ) {
		error_log( "[Al Hadeed SMS] to {$to} failed: {$error}" );
		return array( 'ok' => false, 'provider' => $provider, 'to' => $to, 'error' => $error );
	}

	// -----------------------------------------------------------------
	// The messages themselves, worded once and used everywhere
	// -----------------------------------------------------------------

	public static function otp_message( $code ) {
		return sprintf(
			'%s is your %s code. It expires in 5 minutes. Do not share it with anyone.',
			$code,
			self::shop_name()
		);
	}

	public static function order_placed_message( $order ) {
		$total = self::option( 'currency', 'UGX' ) . ' ' . number_format( AH_Shape::money( $order->get_total() ) );
		$no    = AH_Shape::order_no( $order );
		$how   = $order->has_shipping_address()
			? 'We will deliver once payment is confirmed.'
			: 'Collect at the shop once payment is confirmed.';

		return sprintf(
			'%s: order %s received, %s. Pay at the cashier and quote %s. %s',
			self::shop_name(), $no, $total, $no, $how
		);
	}

	/** What the customer is told as the order moves between desks. */
	public static function status_message( $order, $api_status ) {
		$no   = AH_Shape::order_no( $order );
		$shop = self::shop_name();

		switch ( $api_status ) {
			case 'paid':
				return "{$shop}: payment received for order {$no}. Accounts are checking it now.";
			case 'payment_verified':
				return "{$shop}: payment confirmed for order {$no}. The store is preparing your goods.";
			case 'released':
				return "{$shop}: order {$no} is ready. Thank you.";
			case 'rejected':
				return "{$shop}: we could not match the payment for order {$no}. Please come to the cashier with your receipt.";
			case 'cancelled':
				return "{$shop}: order {$no} has been cancelled.";
			case 'refunded':
				return "{$shop}: a refund has been approved for order {$no}.";
			default:
				return null;
		}
	}
}
