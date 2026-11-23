<?php
/**
 * Money going out that is not a customer's order.
 *
 * Transport, fuel, a part for the grinder, lunch for the crew, and the
 * store taking something off the shelf for the shop's own use rather
 * than selling it.
 *
 * ── How one moves ──
 *
 *   ANY DESK   raises it                         → raised
 *       ▼
 *   MANAGER    approves or declines              → approved / declined
 *       ▼
 *   CASHIER    hands the money over, books it    → paid
 *
 * The manager approves everything. That is the point of the thing: a
 * cashier who can pay out whatever they like is a cashier with no
 * limit, and the shop finds out at the end of the month.
 *
 * Nothing here is ever visible to a customer. Every route is behind a
 * desk capability, and none of it touches the order endpoints the app
 * talks to.
 *
 * ── Why not the cash book ──
 *
 * The cash book is a record of money that moved. An expense is a
 * request that has not moved yet and may never — declined ones must
 * not sit in the book looking like spending. A cash_book row is
 * written only when the cashier actually pays, and the two are linked,
 * so the book still balances against the drawer.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Expenses {

	/** What an expense can be. */
	public static function kinds() {
		return array(
			'expense'   => 'Shop expense',
			'stock_use' => 'Stock taken for the shop',
			'float'     => 'Float for the till',
			'advance'   => 'Advance to staff',
		);
	}

	public static function routes() {
		$ns   = AH_Rest::NS;
		$get  = WP_REST_Server::READABLE;
		$post = WP_REST_Server::CREATABLE;

		// Raising one is open to every desk — the store man who needs a
		// part should not have to find the manager to ask to ask.
		$any_desk = AH_Rest::desk( array( 'cashier', 'accounts', 'store', 'manager' ) );
		$manager  = AH_Rest::desk( array( 'manager' ) );
		$cashier  = AH_Rest::desk( array( 'cashier', 'manager' ) );

		register_rest_route( $ns, '/expenses', array(
			array(
				'methods'             => $get,
				'permission_callback' => $any_desk,
				'callback'            => array( __CLASS__, 'index' ),
			),
			array(
				'methods'             => $post,
				'permission_callback' => $any_desk,
				'callback'            => array( __CLASS__, 'raise' ),
			),
		) );

		register_rest_route( $ns, '/expenses/(?P<id>\d+)/decide', array(
			'methods'             => $post,
			'permission_callback' => $manager,
			'callback'            => array( __CLASS__, 'decide' ),
		) );

		register_rest_route( $ns, '/expenses/(?P<id>\d+)/pay', array(
			'methods'             => $post,
			'permission_callback' => $cashier,
			'callback'            => array( __CLASS__, 'pay' ),
		) );
	}

	// -----------------------------------------------------------------
	// Reading
	// -----------------------------------------------------------------

	public static function index( $req ) {
		global $wpdb;
		$t    = AH_Install::table( 'expenses' );
		$user = AH_Auth::current();
		$desk = AH_Roles::desk_of( $user );

		$where  = array( '1=1' );
		$params = array();

		$status = $req->get_param( 'status' );
		if ( $status && 'all' !== $status ) {
			$where[]  = 'status = %s';
			$params[] = sanitize_text_field( $status );
		}

		// A cashier or a store man sees the shop's expenses — they have
		// to, to pay them and to know their own were dealt with. They
		// just cannot approve one.
		$sql = "SELECT * FROM {$t} WHERE " . implode( ' AND ', $where ) . ' ORDER BY id DESC LIMIT 200';
		$rows = $params
			? $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A )
			: $wpdb->get_results( $sql, ARRAY_A );

		$out = array_map( array( __CLASS__, 'shape' ), (array) $rows );

		return array(
			'expenses' => $out,
			'summary'  => self::summary(),
			'canApprove' => 'manager' === $desk,
			'canPay'     => in_array( $desk, array( 'cashier', 'manager' ), true ),
		);
	}

	private static function summary() {
		global $wpdb;
		$t     = AH_Install::table( 'expenses' );
		$today = current_time( 'Y-m-d' );

		return array(
			'waiting'      => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t} WHERE status = 'raised'" ),
			'to_pay'       => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t} WHERE status = 'approved'" ),
			'waiting_value'=> (int) $wpdb->get_var( "SELECT COALESCE(SUM(amount),0) FROM {$t} WHERE status = 'raised'" ),
			'paid_today'   => (int) $wpdb->get_var(
				$wpdb->prepare( "SELECT COALESCE(SUM(amount),0) FROM {$t} WHERE status = 'paid' AND DATE(paid_at) = %s", $today )
			),
		);
	}

	private static function shape( $row ) {
		$who = function ( $id ) {
			if ( ! $id ) {
				return null;
			}
			$u = get_user_by( 'id', (int) $id );
			return $u ? $u->display_name : null;
		};

		$kinds = self::kinds();

		return array(
			'id'            => (int) $row['id'],
			'ref'           => $row['ref'],
			'kind'          => $row['kind'],
			'kind_label'    => isset( $kinds[ $row['kind'] ] ) ? $kinds[ $row['kind'] ] : $row['kind'],
			'details'       => $row['details'],
			'amount'        => (int) $row['amount'],
			'method'        => $row['method'],
			'status'        => $row['status'],
			'status_label'  => self::label( $row['status'] ),
			'raised_by'     => $who( $row['raised_by'] ),
			'raised_desk'   => $row['raised_desk'],
			'decided_by'    => $who( $row['decided_by'] ),
			'decided_at'    => $row['decided_at'],
			'decision_note' => $row['decision_note'],
			'paid_by'       => $who( $row['paid_by'] ),
			'paid_at'       => $row['paid_at'],
			'created_at'    => $row['created_at'],
		);
	}

	public static function label( $status ) {
		return array(
			'raised'   => 'Waiting for the manager',
			'approved' => 'Approved — waiting for the cashier',
			'declined' => 'Declined',
			'paid'     => 'Paid',
		)[ $status ] ?? $status;
	}

	// -----------------------------------------------------------------
	// Raising
	// -----------------------------------------------------------------

	public static function raise( $req ) {
		global $wpdb;

		$user    = AH_Auth::current();
		$desk    = AH_Roles::desk_of( $user );
		$details = trim( (string) $req->get_param( 'details' ) );
		$amount  = (int) $req->get_param( 'amount' );
		$kind    = (string) $req->get_param( 'kind' );

		if ( ! isset( self::kinds()[ $kind ] ) ) {
			$kind = 'expense';
		}
		if ( strlen( $details ) < 3 ) {
			return new WP_Error( 'ah_no_details', 'Say what the money is for', array( 'status' => 400 ) );
		}
		if ( $amount < 1 ) {
			return new WP_Error( 'ah_no_amount', 'Enter how much is needed', array( 'status' => 400 ) );
		}

		$ref = self::next_ref();

		$wpdb->insert(
			AH_Install::table( 'expenses' ),
			array(
				'ref'         => $ref,
				'kind'        => $kind,
				'details'     => sanitize_text_field( $details ),
				'amount'      => $amount,
				'method'      => sanitize_text_field( (string) $req->get_param( 'method' ) ) ?: null,
				'status'      => 'raised',
				'raised_by'   => $user->ID,
				'raised_desk' => $desk ? $desk : 'manager',
				'created_at'  => current_time( 'mysql' ),
			)
		);
		$id = (int) $wpdb->insert_id;

		AH_Flow::log_event( 0, $desk ? $desk : 'manager', 'expense_raised', $user->ID, $ref . ' · ' . $details . ' · ' . $amount );

		// The manager is the one who has to act, so the manager is told.
		self::tell(
			'manager',
			sprintf(
				'%s: %s raised %s for %s — %s. Approve it in the panel.',
				AH_Sms::shop_name(),
				$user->display_name,
				AH_Shape::money( $amount ) ? 'UGX ' . number_format( $amount ) : '',
				self::kinds()[ $kind ],
				$details
			)
		);

		return array( 'expense' => self::find( $id ) );
	}

	// -----------------------------------------------------------------
	// Deciding
	// -----------------------------------------------------------------

	public static function decide( $req ) {
		global $wpdb;

		$id  = (int) $req['id'];
		$row = self::row( $id );
		if ( ! $row ) {
			return new WP_Error( 'ah_not_found', 'That request no longer exists', array( 'status' => 404 ) );
		}
		if ( 'raised' !== $row['status'] ) {
			return new WP_Error(
				'ah_already_decided',
				'That one has already been ' . self::label( $row['status'] ) . '.',
				array( 'status' => 409 )
			);
		}

		$user    = AH_Auth::current();
		$approve = filter_var( $req->get_param( 'approve' ), FILTER_VALIDATE_BOOLEAN );
		$note    = sanitize_text_field( (string) $req->get_param( 'note' ) );

		// The manager may approve a different figure from the one asked
		// for — "take 50,000 not 80,000" is a normal answer, and making
		// them decline and have it raised again is not.
		$amount = $req->get_param( 'amount' );
		$amount = ( null !== $amount && (int) $amount > 0 ) ? (int) $amount : (int) $row['amount'];

		if ( ! $approve && strlen( $note ) < 3 ) {
			return new WP_Error( 'ah_no_reason', 'Say why it is declined — whoever asked will read it', array( 'status' => 400 ) );
		}

		$wpdb->update(
			AH_Install::table( 'expenses' ),
			array(
				'status'        => $approve ? 'approved' : 'declined',
				'amount'        => $amount,
				'decided_by'    => $user->ID,
				'decided_at'    => current_time( 'mysql' ),
				'decision_note' => $note ?: null,
			),
			array( 'id' => $id )
		);

		AH_Flow::log_event(
			0, 'manager', $approve ? 'expense_approved' : 'expense_declined', $user->ID,
			$row['ref'] . ( $note ? ' · ' . $note : '' )
		);

		// Whoever asked is told either way — an unanswered request is
		// the thing people chase, and chasing is what this replaces.
		self::tell_user(
			(int) $row['raised_by'],
			$approve
				? sprintf( '%s: %s approved — UGX %s. The cashier will pay it out.', AH_Sms::shop_name(), $row['ref'], number_format( $amount ) )
				: sprintf( '%s: %s was declined. %s', AH_Sms::shop_name(), $row['ref'], $note )
		);

		// And the cashier, because it is now their job.
		if ( $approve ) {
			self::tell(
				'cashier',
				sprintf(
					'%s: %s approved for UGX %s — %s. Pay it out and book it.',
					AH_Sms::shop_name(), $row['ref'], number_format( $amount ), $row['details']
				)
			);
		}

		return array( 'expense' => self::find( $id ) );
	}

	// -----------------------------------------------------------------
	// Paying
	// -----------------------------------------------------------------

	public static function pay( $req ) {
		global $wpdb;

		$id  = (int) $req['id'];
		$row = self::row( $id );
		if ( ! $row ) {
			return new WP_Error( 'ah_not_found', 'That request no longer exists', array( 'status' => 404 ) );
		}
		if ( 'approved' !== $row['status'] ) {
			return new WP_Error(
				'ah_not_approved',
				'raised' === $row['status']
					? 'The manager has not approved that yet.'
					: 'That one is already ' . self::label( $row['status'] ) . '.',
				array( 'status' => 409 )
			);
		}

		$user   = AH_Auth::current();
		$method = sanitize_text_field( (string) $req->get_param( 'method' ) ) ?: 'cash';

		// The cash book only learns about it now, because only now did
		// money actually leave the drawer.
		$wpdb->insert(
			AH_Install::table( 'cash_book' ),
			array(
				'entry_date'  => current_time( 'Y-m-d' ),
				'details'     => $row['ref'] . ' · ' . $row['details'],
				'cash_in'     => 0,
				'cash_out'    => (int) $row['amount'],
				'method'      => $method,
				'recorded_by' => $user->ID,
				'created_at'  => current_time( 'mysql' ),
			)
		);
		$book_id = (int) $wpdb->insert_id;

		$wpdb->update(
			AH_Install::table( 'expenses' ),
			array(
				'status'       => 'paid',
				'method'       => $method,
				'paid_by'      => $user->ID,
				'paid_at'      => current_time( 'mysql' ),
				'cash_book_id' => $book_id,
			),
			array( 'id' => $id )
		);

		AH_Flow::log_event( 0, 'cashier', 'expense_paid', $user->ID, $row['ref'] . ' · UGX ' . number_format( (int) $row['amount'] ) );

		self::tell_user(
			(int) $row['raised_by'],
			sprintf( '%s: %s has been paid out — UGX %s.', AH_Sms::shop_name(), $row['ref'], number_format( (int) $row['amount'] ) )
		);
		self::tell(
			'manager',
			sprintf( '%s: %s paid out by %s — UGX %s.', AH_Sms::shop_name(), $row['ref'], $user->display_name, number_format( (int) $row['amount'] ) )
		);

		return array( 'expense' => self::find( $id ) );
	}

	// -----------------------------------------------------------------
	// Plumbing
	// -----------------------------------------------------------------

	private static function row( $id ) {
		global $wpdb;
		$t = AH_Install::table( 'expenses' );
		return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$t} WHERE id = %d", $id ), ARRAY_A );
	}

	private static function find( $id ) {
		$row = self::row( $id );
		return $row ? self::shape( $row ) : null;
	}

	/** EX-00001, and so on. */
	private static function next_ref() {
		global $wpdb;
		$t = AH_Install::table( 'expenses' );
		$n = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t}" ) + 1;
		return sprintf( 'EX-%05d', $n );
	}

	/** Text everybody on a desk. */
	private static function tell( $desk, $message ) {
		foreach ( get_users( array( 'role' => 'ah_' . $desk ) ) as $user ) {
			self::tell_user( $user->ID, $message );
		}
	}

	private static function tell_user( $user_id, $message ) {
		$phone = get_user_meta( $user_id, 'ah_phone', true );
		if ( $phone ) {
			AH_Sms::send( $phone, $message );
		}
	}
}
