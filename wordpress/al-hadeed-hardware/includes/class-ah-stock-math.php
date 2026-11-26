<?php
/**
 * The stock-control arithmetic, on its own.
 *
 * No database and no WordPress in here: every function takes plain
 * numbers and gives plain numbers back, so the rules can be tested by
 * themselves (tests/run.php) and read in one place.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || defined( 'AH_TESTING' ) || exit;

class AH_Stock_Math {

	/** Uganda's VAT. Margins are worked out on amounts without it. */
	const VAT = 0.18;

	/** Days of stock below which an item is reordered. */
	const REORDER_DAYS = 15;

	/** No sale in this many days, with stock on the shelf: dead stock. */
	const DEAD_DAYS = 180;

	/** More than this many days of stock: slow. */
	const SLOW_DAYS = 180;

	/** The window average daily sales are taken over. */
	const SALES_WINDOW = 90;

	/** Zakat on a month's profit. */
	const ZAKAT_RATE = 0.025;

	/**
	 * Book stock: every line in the stock book added up. Purchases are
	 * positive, sales negative, adjustments either way.
	 *
	 * @param int[] $lines The qty of each line.
	 */
	public static function book_stock( array $lines ) {
		$total = 0;
		foreach ( $lines as $q ) {
			$total += (int) $q;
		}
		return $total;
	}

	/** Units sold a day, over the last 90 days. */
	public static function avg_daily_sales( $sold_in_window, $window = self::SALES_WINDOW ) {
		return $window > 0 ? max( 0, (float) $sold_in_window ) / $window : 0.0;
	}

	/**
	 * How many days the shelf lasts at the current rate. Null when the
	 * item does not sell, which is "for ever", not zero.
	 */
	public static function days_of_stock( $book, $avg_daily ) {
		if ( $avg_daily <= 0 ) {
			return null;
		}
		return round( max( 0, $book ) / $avg_daily, 1 );
	}

	/** Reorder now: under 15 days left, or below the minimum level. */
	public static function needs_reorder( $book, $min_level, $days ) {
		if ( null !== $days && $days < self::REORDER_DAYS ) {
			return true;
		}
		return $min_level > 0 && $book < $min_level;
	}

	public static function suggested_order( $book, $min_level ) {
		return max( 0, (int) $min_level - (int) $book );
	}

	/** Stock on the shelf and nothing sold for 180 days, or ever. */
	public static function is_dead( $book, $days_since_sale ) {
		return $book > 0 && ( null === $days_since_sale || $days_since_sale > self::DEAD_DAYS );
	}

	public static function is_slow( $days ) {
		return null !== $days && $days > self::SLOW_DAYS;
	}

	/**
	 * What would stop a sale line, before any override.
	 *
	 * @param int $book     Book stock now.
	 * @param int $reserved Already sold and paid for, not yet released.
	 * @param int $qty      This sale.
	 * @param int $price    Selling price for one.
	 * @param int $cost     Latest purchase cost for one (0 when unknown).
	 * @return string[]     'negative_stock' and/or 'below_cost'.
	 */
	public static function sale_problems( $book, $reserved, $qty, $price, $cost ) {
		$out = array();
		if ( (int) $book - (int) $reserved - (int) $qty < 0 ) {
			$out[] = 'negative_stock';
		}
		if ( $cost > 0 && $price < $cost ) {
			$out[] = 'below_cost';
		}
		return $out;
	}

	/** An amount without VAT, when the amounts include it. */
	public static function ex_vat( $amount, $vat_included = true ) {
		return $vat_included ? (int) round( $amount / ( 1 + self::VAT ) ) : (int) $amount;
	}

	/** Gross margin as a percentage of sales, one decimal. */
	public static function margin( $sales, $cost ) {
		return $sales > 0 ? round( ( $sales - $cost ) / $sales * 100, 1 ) : null;
	}

	/** This month two points or more under the six-month average. */
	public static function margin_alert( $this_month, $six_month_avg ) {
		if ( null === $this_month || null === $six_month_avg ) {
			return false;
		}
		return $this_month <= $six_month_avg - 2;
	}

	/**
	 * Zakat for one month: 2.5% of the profit of the days in that year
	 * AND that month. January 2026 is not January 2025.
	 *
	 * @param string $month 'YYYY-MM'.
	 * @param array  $rows  Each [ 'date' => 'YYYY-MM-DD…', 'profit' => int ].
	 */
	public static function zakat( $month, array $rows ) {
		$profit = self::profit_in_month( $month, $rows );
		return (int) round( max( 0, $profit ) * self::ZAKAT_RATE );
	}

	public static function profit_in_month( $month, array $rows ) {
		if ( ! preg_match( '/^\d{4}-\d{2}$/', (string) $month ) ) {
			return 0;
		}
		$sum = 0;
		foreach ( $rows as $r ) {
			if ( substr( (string) $r['date'], 0, 7 ) === $month ) {
				$sum += (int) $r['profit'];
			}
		}
		return $sum;
	}
}
