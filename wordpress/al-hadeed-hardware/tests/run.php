<?php
/**
 * Stock-control tests. No WordPress needed:
 *
 *   php tests/run.php
 *
 * Exits non-zero if anything fails, so it can gate a build.
 */

define( 'AH_TESTING', true );
require __DIR__ . '/../includes/class-ah-stock-math.php';

$failed = 0;
$passed = 0;

function check( $name, $got, $want ) {
	global $failed, $passed;
	if ( $got === $want ) {
		++$passed;
		echo "  ok   {$name}\n";
		return;
	}
	++$failed;
	echo "  FAIL {$name}: got " . var_export( $got, true ) . ', wanted ' . var_export( $want, true ) . "\n";
}

$M = 'AH_Stock_Math';

echo "Stock balance\n";
// Two purchases, three sales, a count that found two short, a return.
check( 'purchases minus sales plus adjustments', $M::book_stock( array( 100, 50, -30, -45, -10, -2, 3 ) ), 66 );
check( 'nothing in the book is zero', $M::book_stock( array() ), 0 );
check( 'can go below zero, and says so', $M::book_stock( array( 5, -8 ) ), -3 );
// No row limit: the 70,000th line counts like the first.
$lines = array_fill( 0, 70000, -1 );
$lines[] = 80000;
check( 'every line counts, however many', $M::book_stock( $lines ), 10000 );

echo "Negative-stock block\n";
check( 'enough on the shelf', $M::sale_problems( 10, 0, 10, 5000, 4000 ), array() );
check( 'one too many', $M::sale_problems( 10, 0, 11, 5000, 4000 ), array( 'negative_stock' ) );
check( 'sold and waiting to be released counts as gone', $M::sale_problems( 10, 4, 7, 5000, 4000 ), array( 'negative_stock' ) );
check( 'already below zero blocks any sale', $M::sale_problems( -2, 0, 1, 5000, 4000 ), array( 'negative_stock' ) );

echo "Below-cost block\n";
check( 'price under the latest buy price', $M::sale_problems( 10, 0, 1, 3900, 4000 ), array( 'below_cost' ) );
check( 'price equal to cost is allowed', $M::sale_problems( 10, 0, 1, 4000, 4000 ), array() );
check( 'no buy price recorded yet is not blocked', $M::sale_problems( 10, 0, 1, 100, 0 ), array() );
check( 'both at once', $M::sale_problems( 0, 0, 1, 3000, 4000 ), array( 'negative_stock', 'below_cost' ) );

echo "Days of stock and reorder\n";
check( '90 sold in 90 days is 1 a day', $M::avg_daily_sales( 90 ), 1.0 );
check( '264 sold in 90 days, 1 left', $M::days_of_stock( 1, $M::avg_daily_sales( 264 ) ), 0.3 );
check( '30 on the shelf at 2 a day', $M::days_of_stock( 30, 2.0 ), 15.0 );
check( 'an item that does not sell has no end date', $M::days_of_stock( 30, 0.0 ), null );
check( 'under 15 days: reorder', $M::needs_reorder( 20, 0, 14.9 ), true );
check( 'exactly 15 days: not yet', $M::needs_reorder( 30, 0, 15.0 ), false );
check( 'below the minimum level: reorder', $M::needs_reorder( 5, 10, null ), true );
check( 'suggested order tops up to the minimum', $M::suggested_order( 4, 10 ), 6 );
check( 'never a negative order', $M::suggested_order( 40, 10 ), 0 );

echo "Slow and dead stock\n";
check( 'no sale for 181 days with stock: dead', $M::is_dead( 5, 181 ), true );
check( 'never sold, with stock: dead', $M::is_dead( 5, null ), true );
check( 'nothing on the shelf is not dead stock', $M::is_dead( 0, 400 ), false );
check( 'over 180 days of stock: slow', $M::is_slow( 181.0 ), true );

echo "Margin and VAT\n";
check( 'VAT taken off 118,000', $M::ex_vat( 118000 ), 100000 );
check( 'left alone when prices exclude VAT', $M::ex_vat( 118000, false ), 118000 );
check( 'margin on 100,000 sales and 92,000 cost', $M::margin( 100000, 92000 ), 8.0 );
check( '3.6 against a 7.5 average raises the alert', $M::margin_alert( 3.6, 7.5 ), true );
check( '6.0 against 7.5 does not', $M::margin_alert( 6.0, 7.5 ), false );
check( 'exactly 2 points under raises it', $M::margin_alert( 5.5, 7.5 ), true );

echo "Zakat month and year\n";
$rows = array(
	array( 'date' => '2025-01-15', 'profit' => 1000000 ),
	array( 'date' => '2026-01-03', 'profit' => 400000 ),
	array( 'date' => '2026-01-28', 'profit' => 600000 ),
	array( 'date' => '2026-02-01', 'profit' => 999999 ),
);
check( 'January 2026 only, not January 2025', $M::profit_in_month( '2026-01', $rows ), 1000000 );
check( 'zakat is 2.5% of that month', $M::zakat( '2026-01', $rows ), 25000 );
check( 'January 2025 on its own', $M::zakat( '2025-01', $rows ), 25000 );
check( 'a month name alone never matches', $M::zakat( 'Jan, 2026', $rows ), 0 );
check( 'a loss month owes no zakat', $M::zakat( '2026-03', array( array( 'date' => '2026-03-02', 'profit' => -50000 ) ) ), 0 );

echo "Average cost\n";
check( '6 at 200,000 then 4 at 210,000', $M::weighted_average( 6, 200000, 4, 210000 ), 204000 );
check( 'nothing on the shelf takes the new price', $M::weighted_average( 0, 150000, 5, 210000 ), 210000 );
check( 'below-zero stock does not drag the average', $M::weighted_average( -3, 100000, 10, 120000 ), 120000 );

echo "Three-way check\n";
check( 'billed exactly what arrived', $M::three_way( 100, 100, 100 )['state'], 'matches' );
check( 'billed for goods that never came', $M::three_way( 100, 40, 100 ), array( 'state' => 'over_billed', 'diff' => 60, 'notReceived' => 60 ) );
check( 'no bill yet', $M::three_way( 100, 40, 0 )['state'], 'not_billed' );
check( 'billed less than arrived', $M::three_way( 100, 100, 90 )['state'], 'under_billed' );

echo "Till\n";
check( 'counted 95,000 against 100,000 is 5,000 short', $M::over_short( 100000, 95000 ), -5000 );
check( 'exact', $M::over_short( 100000, 100000 ), 0 );

echo "\n{$passed} passed, {$failed} failed\n";
exit( $failed ? 1 : 0 );
