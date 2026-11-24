<?php
/**
 * Suppliers, and writing to them from inside the shop.
 *
 * Until now the cashier has done this by hand: open a mail app, find
 * the supplier's address, type out what the shop has run out of, hope
 * the figures were copied correctly. The shop keeps no record of it
 * and nobody else can see what was asked for.
 *
 * So this does three things, and deliberately only three:
 *
 *   1. Holds the suppliers, so an address is typed once and not
 *      remembered wrongly at seven in the morning.
 *   2. Drafts the restock request from what is actually low on the
 *      shelf, so the figures come out of the shop rather than out of
 *      somebody's head.
 *   3. Keeps every message that was sent, with who sent it and whether
 *      it left the building.
 *
 * Point 3 is the one that matters later. "I already emailed them" is
 * not a fact anybody can check unless it was written down, and a
 * supplier who says they never received anything is otherwise an
 * argument nobody can win.
 *
 * ── A warning worth repeating ──
 *
 * Mail leaving a cheap host is unreliable. wp_mail() returning true
 * means it was handed off, not that it arrived — and on a host with no
 * mail route it returns false. Both outcomes are recorded as they
 * happen, and the screen says which. The shop should put a real SMTP
 * service behind it before relying on this for anything that matters.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Suppliers {

	public static function routes() {
		$ns     = AH_Rest::NS;
		$get    = WP_REST_Server::READABLE;
		$post   = WP_REST_Server::CREATABLE;
		$patch  = WP_REST_Server::EDITABLE;

		// The cashier does this work, so the cashier can do all of it.
		// The store man may read the list — he is the one who knows
		// what has run out — but ordering is not his job.
		$ordering = AH_Rest::desk( array( 'cashier', 'manager' ) );
		$reading  = AH_Rest::desk( array( 'cashier', 'manager', 'accounts', 'store' ) );

		register_rest_route( $ns, '/suppliers', array(
			array(
				'methods'             => $get,
				'permission_callback' => $reading,
				'callback'            => array( __CLASS__, 'index' ),
			),
			array(
				'methods'             => $post,
				'permission_callback' => $ordering,
				'callback'            => array( __CLASS__, 'create' ),
			),
		) );

		register_rest_route( $ns, '/suppliers/(?P<id>\d+)', array(
			'methods'             => $patch,
			'permission_callback' => $ordering,
			'callback'            => array( __CLASS__, 'update' ),
		) );

		// What to ask for: everything at or below its reorder level.
		register_rest_route( $ns, '/suppliers/restock', array(
			'methods'             => $get,
			'permission_callback' => $reading,
			'callback'            => array( __CLASS__, 'restock' ),
		) );

		register_rest_route( $ns, '/suppliers/(?P<id>\d+)/email', array(
			'methods'             => $post,
			'permission_callback' => $ordering,
			'callback'            => array( __CLASS__, 'send' ),
		) );

		register_rest_route( $ns, '/suppliers/mail', array(
			'methods'             => $get,
			'permission_callback' => $reading,
			'callback'            => array( __CLASS__, 'mail_log' ),
		) );
	}

	// -----------------------------------------------------------------
	// The suppliers themselves
	// -----------------------------------------------------------------

	public static function index() {
		global $wpdb;
		$t = AH_Install::table( 'suppliers' );

		$rows = $wpdb->get_results( "SELECT * FROM {$t} ORDER BY active DESC, name ASC", ARRAY_A );

		return array(
			'suppliers' => array_map( array( __CLASS__, 'shape' ), (array) $rows ),
			'canSend'   => in_array( AH_Roles::desk_of( AH_Auth::current() ), array( 'cashier', 'manager' ), true ),
			// Said plainly, because a cashier who believes a message
			// was sent when the host silently dropped it is worse off
			// than one who knows to telephone instead.
			'mailReady' => self::mail_configured(),
		);
	}

	private static function shape( $row ) {
		return array(
			'id'       => (int) $row['id'],
			'name'     => AH_Shape::text( $row['name'] ),
			'contact'  => AH_Shape::text( $row['contact_name'] ),
			'email'    => $row['email'],
			'phone'    => $row['phone'],
			'supplies' => AH_Shape::text( $row['supplies'] ),
			'notes'    => AH_Shape::text( $row['notes'] ),
			'active'   => (int) $row['active'] === 1,
			'lastMail' => $row['last_mail_at'],
		);
	}

	public static function create( $req ) {
		global $wpdb;
		$t = AH_Install::table( 'suppliers' );

		$name  = sanitize_text_field( (string) $req->get_param( 'name' ) );
		$email = sanitize_email( (string) $req->get_param( 'email' ) );

		if ( mb_strlen( $name ) < 2 ) {
			return new WP_Error( 'ah_no_name', 'Give the supplier a name', array( 'status' => 400 ) );
		}
		if ( ! $email || ! is_email( $email ) ) {
			return new WP_Error(
				'ah_bad_email',
				'That is not an email address the shop can send to',
				array( 'status' => 400 )
			);
		}

		// Two rows for the same address means two halves of the history
		// and a cashier writing to whichever they happened to open.
		$clash = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$t} WHERE email = %s", $email ) );
		if ( $clash ) {
			return new WP_Error(
				'ah_duplicate',
				'A supplier with that email address is already on the list',
				array( 'status' => 409 )
			);
		}

		$wpdb->insert(
			$t,
			array(
				'name'         => $name,
				'contact_name' => sanitize_text_field( (string) $req->get_param( 'contact' ) ),
				'email'        => $email,
				'phone'        => AH_Sms::normalise_phone( (string) $req->get_param( 'phone' ) ),
				'supplies'     => sanitize_text_field( (string) $req->get_param( 'supplies' ) ),
				'notes'        => sanitize_textarea_field( (string) $req->get_param( 'notes' ) ),
				'active'       => 1,
				'created_by'   => get_current_user_id(), // set by the token since the auth fix
				'created_at'   => current_time( 'mysql' ),
			)
		);

		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $wpdb->insert_id ), ARRAY_A );

		return array( 'supplier' => self::shape( $row ) );
	}

	public static function update( $req ) {
		global $wpdb;
		$t  = AH_Install::table( 'suppliers' );
		$id = (int) $req->get_param( 'id' );

		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ), ARRAY_A );
		if ( ! $row ) {
			return new WP_Error( 'ah_not_found', 'That supplier is not on the list', array( 'status' => 404 ) );
		}

		$fields = array();

		foreach ( array( 'name' => 'name', 'contact' => 'contact_name', 'supplies' => 'supplies' ) as $param => $column ) {
			if ( null !== $req->get_param( $param ) ) {
				$fields[ $column ] = sanitize_text_field( (string) $req->get_param( $param ) );
			}
		}
		if ( null !== $req->get_param( 'notes' ) ) {
			$fields['notes'] = sanitize_textarea_field( (string) $req->get_param( 'notes' ) );
		}
		if ( null !== $req->get_param( 'phone' ) ) {
			$fields['phone'] = AH_Sms::normalise_phone( (string) $req->get_param( 'phone' ) );
		}
		if ( null !== $req->get_param( 'email' ) ) {
			$email = sanitize_email( (string) $req->get_param( 'email' ) );
			if ( ! is_email( $email ) ) {
				return new WP_Error( 'ah_bad_email', 'That is not an email address the shop can send to', array( 'status' => 400 ) );
			}
			$fields['email'] = $email;
		}
		if ( null !== $req->get_param( 'active' ) ) {
			$fields['active'] = $req->get_param( 'active' ) ? 1 : 0;
		}

		if ( ! $fields ) {
			return new WP_Error( 'ah_nothing', 'Nothing to change', array( 'status' => 400 ) );
		}

		$wpdb->update( $t, $fields, array( 'id' => $id ) );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ), ARRAY_A );

		return array( 'supplier' => self::shape( $row ) );
	}

	// -----------------------------------------------------------------
	// What to ask for
	// -----------------------------------------------------------------

	/**
	 * Everything at or below its reorder level.
	 *
	 * Grouped by the supplier named on the product, so the cashier
	 * opening Mukasa Hardware's draft is not handed the whole shop's
	 * shortages and left to work out which are his.
	 */
	public static function restock( $req ) {
		$wanted = sanitize_text_field( (string) $req->get_param( 'supplier' ) );

		$ids = wc_get_products(
			array(
				'status' => 'publish',
				'limit'  => -1,
				'return' => 'ids',
			)
		);

		$low = array();

		foreach ( $ids as $id ) {
			$product = wc_get_product( $id );
			if ( ! $product || ! $product->get_manage_stock() ) {
				continue;
			}

			$stock   = (int) $product->get_stock_quantity();
			$reorder = (int) get_post_meta( $id, '_ah_reorder_level', true );
			if ( $reorder <= 0 || $stock > $reorder ) {
				continue;
			}

			$supplier = (string) get_post_meta( $id, '_ah_supplier', true );
			if ( $wanted && 0 !== strcasecmp( trim( $supplier ), trim( $wanted ) ) ) {
				continue;
			}

			$low[] = array(
				'code'     => $product->get_sku(),
				'name'     => AH_Shape::text( $product->get_name() ),
				'unit'     => get_post_meta( $id, '_ah_unit', true ) ?: 'pcs',
				'stock'    => $stock,
				'reorder'  => $reorder,
				// What to ask for. Enough to get back above the reorder
				// level with the same again as headroom, rounded up —
				// ordering exactly the shortfall means ordering again
				// next week.
				'suggest'  => max( 1, ( $reorder * 2 ) - $stock ),
				'supplier' => AH_Shape::text( $supplier ),
			);
		}

		// Worst first, measured as how much of the reorder level is
		// left rather than how many units short it is. Two tins of
		// paint out of ten is closer to running out than eighteen iron
		// bars out of fifty, even though the bars are short by more.
		usort( $low, function ( $a, $b ) {
			$left_a = $a['reorder'] > 0 ? $a['stock'] / $a['reorder'] : 0;
			$left_b = $b['reorder'] > 0 ? $b['stock'] / $b['reorder'] : 0;
			return $left_a <=> $left_b;
		} );

		return array( 'items' => $low );
	}

	// -----------------------------------------------------------------
	// Sending
	// -----------------------------------------------------------------

	public static function send( $req ) {
		global $wpdb;

		$t   = AH_Install::table( 'suppliers' );
		$log = AH_Install::table( 'supplier_mail' );
		$id  = (int) $req->get_param( 'id' );

		$supplier = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ), ARRAY_A );
		if ( ! $supplier ) {
			return new WP_Error( 'ah_not_found', 'That supplier is not on the list', array( 'status' => 404 ) );
		}
		if ( ! (int) $supplier['active'] ) {
			return new WP_Error(
				'ah_inactive',
				'That supplier is marked as one the shop no longer uses. Put them back on the list first.',
				array( 'status' => 409 )
			);
		}

		$subject = sanitize_text_field( (string) $req->get_param( 'subject' ) );
		$body    = (string) $req->get_param( 'body' );
		// The body is a message a person typed, so paragraphs survive,
		// but it is going out over the shop's name — no markup.
		$body    = trim( wp_strip_all_tags( $body ) );

		if ( mb_strlen( $subject ) < 3 ) {
			return new WP_Error( 'ah_no_subject', 'Give the message a subject', array( 'status' => 400 ) );
		}
		if ( mb_strlen( $body ) < 10 ) {
			return new WP_Error( 'ah_no_body', 'There is no message to send', array( 'status' => 400 ) );
		}

		$user = AH_Auth::current();
		$shop = AH_Sms::shop_name();

		// Replies belong with the shop, not with whichever address the
		// host happens to send as.
		$reply_to = AH_Sms::option( 'reply_email' ) ?: get_option( 'admin_email' );

		$headers = array(
			'Content-Type: text/plain; charset=UTF-8',
			sprintf( 'From: %s <%s>', $shop, self::from_address() ),
			sprintf( 'Reply-To: %s <%s>', $shop, $reply_to ),
		);

		$signed = $body . "\n\n--\n" . $user->display_name . "\n" . $shop;

		// A send that throws is still a send that failed, and a row in
		// the log explaining why is more use than a 500.
		$ok    = false;
		$error = '';
		try {
			$ok = wp_mail( $supplier['email'], $subject, $signed, $headers );
			if ( ! $ok ) {
				$error = 'The server would not send it. The shop needs an email service set up.';
			}
		} catch ( Exception $e ) {
			$error = $e->getMessage();
		}

		$wpdb->insert(
			$log,
			array(
				'supplier_id' => $id,
				'to_email'    => $supplier['email'],
				'subject'     => $subject,
				'body'        => $signed,
				'item_count'  => (int) $req->get_param( 'itemCount' ),
				'sent_by'     => $user->ID,
				'sent_name'   => $user->display_name,
				'status'      => $ok ? 'sent' : 'failed',
				'error'       => $error,
				'created_at'  => current_time( 'mysql' ),
			)
		);

		if ( $ok ) {
			$wpdb->update( $t, array( 'last_mail_at' => current_time( 'mysql' ) ), array( 'id' => $id ) );
		}

		if ( ! $ok ) {
			return new WP_Error(
				'ah_mail_failed',
				$error ?: 'The message could not be sent',
				array( 'status' => 502 )
			);
		}

		return array(
			'sent'     => true,
			'to'       => $supplier['email'],
			'supplier' => AH_Shape::text( $supplier['name'] ),
		);
	}

	public static function mail_log( $req ) {
		global $wpdb;
		$log = AH_Install::table( 'supplier_mail' );
		$t   = AH_Install::table( 'suppliers' );

		$id    = (int) $req->get_param( 'supplier' );
		$where = $id ? $wpdb->prepare( 'WHERE m.supplier_id = %d', $id ) : '';

		$rows = $wpdb->get_results(
			"SELECT m.*, s.name AS supplier_name
			   FROM {$log} m LEFT JOIN {$t} s ON s.id = m.supplier_id
			   {$where} ORDER BY m.id DESC LIMIT 100",
			ARRAY_A
		);

		return array(
			'mail' => array_map(
				function ( $r ) {
					return array(
						'id'       => (int) $r['id'],
						'supplier' => AH_Shape::text( $r['supplier_name'] ),
						'to'       => $r['to_email'],
						'subject'  => AH_Shape::text( $r['subject'] ),
						'body'     => $r['body'],
						'items'    => (int) $r['item_count'],
						'sentBy'   => $r['sent_name'],
						'status'   => $r['status'],
						'error'    => $r['error'],
						'at'       => $r['created_at'],
					);
				},
				(array) $rows
			),
		);
	}

	// -----------------------------------------------------------------
	// Mail plumbing
	// -----------------------------------------------------------------

	/** The address the shop sends as, on the site's own domain. */
	private static function from_address() {
		$configured = AH_Sms::option( 'from_email' );
		if ( $configured && is_email( $configured ) ) {
			return $configured;
		}

		// A From: address on somebody else's domain is the fastest way
		// into a spam folder, so this falls back to the shop's own.
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		$host = preg_replace( '/^www\./i', '', (string) $host );

		return $host ? 'orders@' . $host : get_option( 'admin_email' );
	}

	/**
	 * Whether mail is actually getting out.
	 *
	 * This first asked whether a mail service had hooked itself in.
	 * That was a guess dressed as a fact — it answered "yes" on a host
	 * that then refused every message, which is worse than saying
	 * nothing, because a cashier who is told mail works stops checking.
	 *
	 * So it reports the only thing that is really known: what happened
	 * to the messages the shop has already tried to send. A host that
	 * dropped the last five will drop the sixth.
	 */
	private static function mail_configured() {
		global $wpdb;
		$log = AH_Install::table( 'supplier_mail' );

		$recent = $wpdb->get_results(
			"SELECT status FROM {$log} ORDER BY id DESC LIMIT 10",
			ARRAY_A
		);

		$tried  = count( $recent );
		$failed = 0;
		foreach ( $recent as $r ) {
			if ( 'sent' !== $r['status'] ) {
				$failed++;
			}
		}

		if ( 0 === $tried ) {
			return array(
				'working' => null,
				'from'    => self::from_address(),
				'note'    => 'Nothing has been sent from here yet. Send one to yourself first to check the shop can actually get mail out.',
			);
		}

		if ( $failed === $tried ) {
			return array(
				'working' => false,
				'from'    => self::from_address(),
				'note'    => sprintf(
					'The last %d %s failed to send. The shop needs an email service set up before this will work. Telephone the supplier in the meantime.',
					$tried,
					1 === $tried ? 'message' : 'messages'
				),
			);
		}

		return array(
			'working' => true,
			'from'    => self::from_address(),
			'note'    => $failed
				? sprintf( '%d of the last %d messages failed to send.', $failed, $tried )
				: 'Messages are getting out.',
		);
	}
}
