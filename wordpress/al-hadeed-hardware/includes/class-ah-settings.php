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
			'otp_dev_mode'  => 'yes',
			'cors_origins'  => '*',
		);
	}

	public static function init() {
		add_action( 'admin_init', array( __CLASS__, 'register' ) );
	}

	public static function register() {
		register_setting(
			'ah_settings_group',
			self::OPTION,
			array( 'sanitize_callback' => array( __CLASS__, 'sanitize' ) )
		);
	}

	public static function sanitize( $input ) {
		$out = array();
		foreach ( self::defaults() as $key => $default ) {
			$value       = isset( $input[ $key ] ) ? $input[ $key ] : $default;
			$out[ $key ] = sanitize_text_field( $value );
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
							<th><label for="ah_sms_username">Username</label></th>
							<td><input id="ah_sms_username" class="regular-text" type="text"
								name="<?php echo esc_attr( self::OPTION ); ?>[sms_username]"
								value="<?php echo esc_attr( $o['sms_username'] ); ?>"></td>
						</tr>
						<tr>
							<th><label for="ah_sms_api_key">API key</label></th>
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
		</div>
		<?php
	}
}
