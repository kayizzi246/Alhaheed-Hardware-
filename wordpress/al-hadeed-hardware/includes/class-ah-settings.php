<?php
/**
 * Settings: the SMS gateway, the shop's name, who may call the API.
 *
 * Everything here has a working default, so the plugin runs the moment
 * it is activated and the shop can be set up in whatever order suits
 * them. The one setting worth changing before taking real orders is
 * `otp_dev_mode` — left on, every login code is 123456.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Settings {

	const OPTION = 'ah_settings';

	public static function defaults() {
		return array(
			'shop_name'     => get_bloginfo( 'name' ),
			'currency'      => 'UGX',
			'sms_provider'  => 'log',
			'sms_api_key'   => '',
			'sms_username'  => '',
			'sms_sender_id' => '',
			'sms_url'       => '',
			// Mail. Without these, messages to suppliers go out through
			// whatever the host provides, which on cheap hosting is
			// usually nothing at all.
			'smtp_host'     => '',
			'smtp_port'     => '587',
			'smtp_secure'   => 'tls',
			'smtp_user'     => '',
			'smtp_pass'     => '',
			'from_email'    => '',
			'reply_email'   => '',
			'otp_dev_mode'  => 'yes',
			'cors_origins'  => '*',
		);
	}

	public static function init() {
		add_action( 'admin_init', array( __CLASS__, 'register' ) );
		add_action( 'admin_post_ah_test_sms', array( __CLASS__, 'test_sms' ) );
		add_action( 'phpmailer_init', array( __CLASS__, 'mailer' ) );
	}

	/**
	 * Point the mailer at a real mail service, if one is configured.
	 *
	 * Mail sent straight from a shared host is routinely refused by the
	 * receiving server — no reverse DNS, no SPF record, a From address
	 * on a domain the host does not own. The supplier never sees it and
	 * nobody at the shop finds out. Configuring a mail service here is
	 * the difference between a message that arrives and one that
	 * quietly vanishes.
	 *
	 * @param PHPMailer $mail The mailer, handed over by reference.
	 */
	public static function mailer( $mail ) {
		$o = wp_parse_args( get_option( self::OPTION, array() ), self::defaults() );

		if ( empty( $o['smtp_host'] ) ) {
			return;
		}

		$mail->isSMTP();
		$mail->Host = $o['smtp_host'];
		$mail->Port = (int) $o['smtp_port'] ? (int) $o['smtp_port'] : 587;

		if ( in_array( $o['smtp_secure'], array( 'tls', 'ssl' ), true ) ) {
			$mail->SMTPSecure = $o['smtp_secure'];
		} else {
			$mail->SMTPSecure  = '';
			$mail->SMTPAutoTLS = false;
		}

		// Some services want a username and password; some accept the
		// host's address alone and are given no credentials at all.
		if ( ! empty( $o['smtp_user'] ) ) {
			$mail->SMTPAuth = true;
			$mail->Username = $o['smtp_user'];
			$mail->Password = $o['smtp_pass'];
		}

		if ( ! empty( $o['from_email'] ) && is_email( $o['from_email'] ) ) {
			$shop = $o['shop_name'] ? $o['shop_name'] : get_bloginfo( 'name' );
			$mail->setFrom( $o['from_email'], $shop, false );
		}
	}

	public static function register() {
		register_setting(
			'ah_settings_group',
			self::OPTION,
			array( 'sanitize_callback' => array( __CLASS__, 'sanitize' ) )
		);
	}

	/** One real message through the saved gateway, and what it answered. */
	public static function test_sms() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Not allowed.', '', array( 'response' => 403 ) );
		}
		check_admin_referer( 'ah_test_sms' );

		$phone = isset( $_POST['phone'] ) ? sanitize_text_field( wp_unslash( $_POST['phone'] ) ) : '';
		$sent  = AH_Sms::send( $phone, AH_Sms::shop_name() . ': test message. SMS is working.' );
		if ( $sent['ok'] && 'log' === $sent['provider'] ) {
			$say = 'Nothing was sent: the gateway is still set to "log". Choose EgoSMS and save first.';
		} elseif ( $sent['ok'] ) {
			$say = 'Accepted by ' . $sent['provider'] . ' for ' . $sent['to'] . '. Check the phone.';
		} else {
			$say = 'Not sent. ' . $sent['provider'] . ' said: ' . $sent['error'];
		}
		set_transient( 'ah_test_sms_' . get_current_user_id(), $say, 60 );
		wp_safe_redirect( wp_get_referer() ?: admin_url() );
		exit;
	}

	public static function sanitize( $input ) {
		$out = array();
		foreach ( self::defaults() as $key => $default ) {
			$value = isset( $input[ $key ] ) ? $input[ $key ] : $default;

			// sanitize_text_field() strips characters that are perfectly
			// legal in a mail password, and a password silently altered
			// on save is an afternoon lost to "but I typed it right".
			$out[ $key ] = in_array( $key, array( 'smtp_pass', 'sms_api_key' ), true ) ? (string) $value : sanitize_text_field( $value );
		}

		// An unticked box is not sent at all, so "missing" means "off".
		// Filling it from the default turned test mode back on at every
		// save: it could never be switched off.
		$out['otp_dev_mode'] = isset( $input['otp_dev_mode'] ) && 'yes' === $input['otp_dev_mode'] ? 'yes' : 'no';

		// A mistyped address here means every message bounces, and the
		// bounce goes somewhere nobody is watching. Better to refuse it
		// at the point it was typed.
		foreach ( array( 'from_email', 'reply_email' ) as $mail_key ) {
			if ( '' !== $out[ $mail_key ] && ! is_email( $out[ $mail_key ] ) ) {
				$out[ $mail_key ] = '';
				add_settings_error(
					self::OPTION,
					'ah_bad_' . $mail_key,
					'That mail address was not valid, so it has been left blank.'
				);
			}
		}
		// A blank origin list would lock every client out; '*' is the
		// honest default and the settings page says what it means.
		if ( '' === $out['cors_origins'] ) {
			$out['cors_origins'] = '*';
		}
		return $out;
	}

	public static function render() {
		if ( ! current_user_can( 'manage_options' ) && ! current_user_can( 'ah_desk_manager' ) ) {
			wp_die( 'You do not have access to this.' );
		}

		$o = wp_parse_args( get_option( self::OPTION, array() ), self::defaults() );
		$api_base = home_url( '/api' );
		?>
		<div class="wrap ah-wrap">
			<h1>Al Hadeed Hardware — Settings</h1>

			<div class="ah-card" style="max-width:860px">
				<h2 style="margin-top:0">Point the apps here</h2>
				<p>The web panel and the phone app both talk to this address. It is the
				only line either of them needs changed.</p>
				<table class="form-table">
					<tr>
						<th>Web panel (<code>web/.env.local</code>)</th>
						<td><code>NEXT_PUBLIC_API_URL=<?php echo esc_html( home_url() ); ?></code></td>
					</tr>
					<tr>
						<th>Phone app (all five <code>.dart</code> files)</th>
						<td><code>const String _apiBase = '<?php echo esc_html( home_url() ); ?>';</code></td>
					</tr>
					<tr>
						<th>Check it works</th>
						<td><a href="<?php echo esc_url( $api_base . '/health' ); ?>" target="_blank"><?php echo esc_html( $api_base ); ?>/health</a></td>
					</tr>
				</table>
			</div>

			<form method="post" action="options.php" style="max-width:860px">
				<?php settings_fields( 'ah_settings_group' ); ?>

				<div class="ah-card">
					<h2 style="margin-top:0">The shop</h2>
					<table class="form-table">
						<tr>
							<th><label for="ah_shop_name">Shop name</label></th>
							<td><input id="ah_shop_name" class="regular-text" type="text"
								name="<?php echo esc_attr( self::OPTION ); ?>[shop_name]"
								value="<?php echo esc_attr( $o['shop_name'] ); ?>">
								<p class="description">Used on receipts and at the start of every SMS.</p></td>
						</tr>
						<tr>
							<th><label for="ah_currency">Currency</label></th>
							<td><input id="ah_currency" class="small-text" type="text"
								name="<?php echo esc_attr( self::OPTION ); ?>[currency]"
								value="<?php echo esc_attr( $o['currency'] ); ?>"></td>
						</tr>
					</table>
				</div>

				<div class="ah-card">
					<h2 style="margin-top:0">SMS</h2>
					<p class="description" style="margin-bottom:12px">Login codes and the order
					confirmation. <strong>log</strong> writes the message to the server's error
					log and sends nothing — free, and useful while setting up.</p>
					<table class="form-table">
						<tr>
							<th><label for="ah_sms_provider">Gateway</label></th>
							<td>
								<select id="ah_sms_provider" name="<?php echo esc_attr( self::OPTION ); ?>[sms_provider]">
									<?php
									foreach ( array(
										'log'            => 'log — write to the debug log, send nothing',
										'egosms'         => 'EgoSMS',
										'africastalking' => "Africa's Talking",
										'generic'        => 'Generic — any JSON POST endpoint',
									) as $value => $label ) {
										printf(
											'<option value="%s"%s>%s</option>',
											esc_attr( $value ),
											selected( $o['sms_provider'], $value, false ),
											esc_html( $label )
										);
									}
									?>
								</select>
							</td>
						</tr>
						<tr>
							<th><label for="ah_sms_username">API username</label></th>
							<td><input id="ah_sms_username" class="regular-text" type="text"
								name="<?php echo esc_attr( self::OPTION ); ?>[sms_username]"
								value="<?php echo esc_attr( $o['sms_username'] ); ?>">
							<p class="description">EgoSMS: both of these are on comms.egosms.co under
							Settings &rsaquo; API Settings. They are not your login password.</p></td>
						</tr>
						<tr>
							<th><label for="ah_sms_api_key">API password / key</label></th>
							<td><input id="ah_sms_api_key" class="regular-text" type="password"
								name="<?php echo esc_attr( self::OPTION ); ?>[sms_api_key]"
								value="<?php echo esc_attr( $o['sms_api_key'] ); ?>"></td>
						</tr>
						<tr>
							<th><label for="ah_sms_sender_id">Sender ID</label></th>
							<td><input id="ah_sms_sender_id" class="regular-text" type="text"
								name="<?php echo esc_attr( self::OPTION ); ?>[sms_sender_id]"
								value="<?php echo esc_attr( $o['sms_sender_id'] ); ?>"
								placeholder="AL HADEED"></td>
						</tr>
						<tr>
							<th><label for="ah_sms_url">Generic gateway URL</label></th>
							<td><input id="ah_sms_url" class="regular-text" type="url"
								name="<?php echo esc_attr( self::OPTION ); ?>[sms_url]"
								value="<?php echo esc_attr( $o['sms_url'] ); ?>"></td>
						</tr>
					</table>
				</div>

				<div class="ah-card">
					<h2 style="margin-top:0">Email to suppliers</h2>
					<p class="description" style="margin-bottom:12px">
						The cashier writes to suppliers from the Suppliers screen. Without a
						mail service set up below, those messages are handed to the web host,
						and most hosts either refuse them outright or deliver them into a spam
						folder. Any mail service will do — the one that came with the shop's
						email address, or a sending service. The Suppliers screen reports
						whether messages are actually getting out.
					</p>
					<table class="form-table">
						<tr>
							<th><label for="ah_smtp_host">Mail server</label></th>
							<td><input id="ah_smtp_host" class="regular-text" type="text"
								name="<?php echo esc_attr( self::OPTION ); ?>[smtp_host]"
								value="<?php echo esc_attr( $o['smtp_host'] ); ?>"
								placeholder="smtp.yourprovider.com">
								<p class="description">Leave this blank to use whatever the host provides.</p></td>
						</tr>
						<tr>
							<th><label for="ah_smtp_port">Port</label></th>
							<td><input id="ah_smtp_port" class="small-text" type="number"
								name="<?php echo esc_attr( self::OPTION ); ?>[smtp_port]"
								value="<?php echo esc_attr( $o['smtp_port'] ); ?>">
								<p class="description">587 for TLS, 465 for SSL.</p></td>
						</tr>
						<tr>
							<th><label for="ah_smtp_secure">Encryption</label></th>
							<td>
								<select id="ah_smtp_secure" name="<?php echo esc_attr( self::OPTION ); ?>[smtp_secure]">
									<?php foreach ( array( 'tls' => 'TLS (usual)', 'ssl' => 'SSL', 'none' => 'None' ) as $value => $label ) : ?>
										<option value="<?php echo esc_attr( $value ); ?>"
											<?php selected( $o['smtp_secure'], $value ); ?>>
											<?php echo esc_html( $label ); ?></option>
									<?php endforeach; ?>
								</select>
							</td>
						</tr>
						<tr>
							<th><label for="ah_smtp_user">Username</label></th>
							<td><input id="ah_smtp_user" class="regular-text" type="text"
								name="<?php echo esc_attr( self::OPTION ); ?>[smtp_user]"
								value="<?php echo esc_attr( $o['smtp_user'] ); ?>"
								autocomplete="off"></td>
						</tr>
						<tr>
							<th><label for="ah_smtp_pass">Password</label></th>
							<td><input id="ah_smtp_pass" class="regular-text" type="password"
								name="<?php echo esc_attr( self::OPTION ); ?>[smtp_pass]"
								value="<?php echo esc_attr( $o['smtp_pass'] ); ?>"
								autocomplete="new-password">
								<p class="description">
									Kept on this site. Where the provider offers a sending key, use
									that rather than the shop's own mail password.
								</p></td>
						</tr>
						<tr>
							<th><label for="ah_from_email">Send as</label></th>
							<td><input id="ah_from_email" class="regular-text" type="email"
								name="<?php echo esc_attr( self::OPTION ); ?>[from_email]"
								value="<?php echo esc_attr( $o['from_email'] ); ?>"
								placeholder="orders@alhadeedhardware.com">
								<p class="description">
									Must be an address on a domain the shop owns, or the receiving
									server will treat it as forged.
								</p></td>
						</tr>
						<tr>
							<th><label for="ah_reply_email">Replies go to</label></th>
							<td><input id="ah_reply_email" class="regular-text" type="email"
								name="<?php echo esc_attr( self::OPTION ); ?>[reply_email]"
								value="<?php echo esc_attr( $o['reply_email'] ); ?>"
								placeholder="shop@alhadeedhardware.com">
								<p class="description">
									Where a supplier's reply lands. Somebody has to actually read it.
								</p></td>
						</tr>
					</table>
				</div>

				<div class="ah-card">
					<h2 style="margin-top:0">Security</h2>
					<table class="form-table">
						<tr>
							<th>Login codes</th>
							<td>
								<label>
									<input type="checkbox" value="yes"
										name="<?php echo esc_attr( self::OPTION ); ?>[otp_dev_mode]"
										<?php checked( $o['otp_dev_mode'], 'yes' ); ?>>
									Test mode — every code is <code>123456</code>
								</label>
								<p class="description" style="color:#b32d2e">
									<strong>Turn this off before taking real orders.</strong> Left on,
									anyone who knows a registered phone number can sign in as that person.
								</p>
							</td>
						</tr>
						<tr>
							<th><label for="ah_cors">Allowed app addresses</label></th>
							<td><input id="ah_cors" class="large-text" type="text"
								name="<?php echo esc_attr( self::OPTION ); ?>[cors_origins]"
								value="<?php echo esc_attr( $o['cors_origins'] ); ?>">
								<p class="description">Comma-separated, e.g.
								<code>https://alhaheed-hardware.vercel.app</code>. <code>*</code> allows
								any site to call the API — fine while testing, worth narrowing once the
								panel has its address.</p></td>
						</tr>
					</table>
				</div>

				<?php submit_button( 'Save settings' ); ?>
			</form>

			<div class="ah-card">
				<h2 style="margin-top:0">Send a test SMS</h2>
				<?php
				$say = get_transient( 'ah_test_sms_' . get_current_user_id() );
				if ( $say ) {
					delete_transient( 'ah_test_sms_' . get_current_user_id() );
					printf( '<p><strong>%s</strong></p>', esc_html( $say ) );
				}
				?>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="ah_test_sms">
					<?php wp_nonce_field( 'ah_test_sms' ); ?>
					<input class="regular-text" type="tel" name="phone" placeholder="0772 123 456" required>
					<button class="button">Send test</button>
					<p class="description">Save the settings first. This uses one SMS of credit.</p>
				</form>
			</div>
		</div>
		<?php
	}
}
