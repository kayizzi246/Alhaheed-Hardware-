<?php
/**
 * A small PDF writer: text in Helvetica, lines and filled boxes, on A4 or
 * an 80 mm receipt roll. Enough for receipts, order summaries and
 * statements, with no library to install on the website.
 *
 * Positions are measured from the top-left in points (1/72 inch), and
 * turned the PDF way up only when the file is written. A receipt's page
 * is as tall as what is on it.
 *
 * @package AlHadeed
 */

defined( 'ABSPATH' ) || exit;

class AH_Pdf {

	const A4_W  = 595.28;
	const A4_H  = 841.89;
	const ROLL  = 226.77; // 80 mm

	/** Helvetica and Helvetica-Bold widths, characters 32 to 126. */
	const W = array(
		278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
		1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
		333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
	);
	const WB = array(
		278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
		975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
		333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
	);

	public $w;
	public $h;
	private $pages = array();
	private $page  = -1;
	private $grow;
	private $title;

	/** $grow: the page is as tall as its content (a receipt roll). */
	public function __construct( $w = self::A4_W, $h = self::A4_H, $grow = false, $title = 'Document' ) {
		$this->w     = $w;
		$this->h     = $h;
		$this->grow  = $grow;
		$this->title = $title;
		$this->add_page();
	}

	public function add_page() {
		$this->pages[] = array( 'ops' => array(), 'bottom' => 0 );
		$this->page    = count( $this->pages ) - 1;
	}

	public function page_no() {
		return $this->page + 1;
	}

	/** Bytes the way the standard fonts read them. */
	private static function enc( $s ) {
		$s = (string) $s;
		$t = function_exists( 'iconv' ) ? @iconv( 'UTF-8', 'Windows-1252//TRANSLIT', $s ) : false;
		return false === $t ? preg_replace( '/[^\x20-\x7E]/', '?', $s ) : $t;
	}

	public static function width( $s, $size, $bold = false ) {
		$tab = $bold ? self::WB : self::W;
		$sum = 0;
		$b   = self::enc( $s );
		for ( $i = 0, $n = strlen( $b ); $i < $n; $i++ ) {
			$c    = ord( $b[ $i ] );
			$sum += ( $c >= 32 && $c <= 126 ) ? $tab[ $c - 32 ] : 556;
		}
		return $sum * $size / 1000;
	}

	/** Cut to fit a width, with an ellipsis. */
	public static function fit( $s, $size, $max, $bold = false ) {
		$s = (string) $s;
		if ( self::width( $s, $size, $bold ) <= $max ) {
			return $s;
		}
		while ( mb_strlen( $s ) > 1 && self::width( $s . '...', $size, $bold ) > $max ) {
			$s = mb_substr( $s, 0, -1 );
		}
		return rtrim( $s ) . '...';
	}

	/** Words over lines no wider than $max. */
	public static function wrap( $s, $size, $max, $bold = false ) {
		$lines = array();
		foreach ( preg_split( "/\r?\n/", (string) $s ) as $para ) {
			$line = '';
			foreach ( preg_split( '/\s+/', trim( $para ) ) as $word ) {
				$try = '' === $line ? $word : $line . ' ' . $word;
				if ( '' !== $line && self::width( $try, $size, $bold ) > $max ) {
					$lines[] = $line;
					$line    = $word;
				} else {
					$line = $try;
				}
			}
			$lines[] = $line;
		}
		return $lines;
	}

	private function mark( $y ) {
		$this->pages[ $this->page ]['bottom'] = max( $this->pages[ $this->page ]['bottom'], $y );
	}

	public function text( $x, $y, $s, $size = 10, $bold = false, $rgb = array( 0.06, 0.11, 0.2 ), $align = 'left' ) {
		if ( 'right' === $align ) {
			$x -= self::width( $s, $size, $bold );
		} elseif ( 'center' === $align ) {
			$x -= self::width( $s, $size, $bold ) / 2;
		}
		$this->pages[ $this->page ]['ops'][] = array( 't', $x, $y, $s, $size, $bold, $rgb );
		$this->mark( $y + 3 );
	}

	public function rect( $x, $y, $w, $h, $rgb ) {
		$this->pages[ $this->page ]['ops'][] = array( 'r', $x, $y, $w, $h, $rgb );
		$this->mark( $y + $h );
	}

	public function line( $x1, $y1, $x2, $y2, $rgb = array( 0.85, 0.87, 0.9 ), $width = 0.6, $dash = false ) {
		$this->pages[ $this->page ]['ops'][] = array( 'l', $x1, $y1, $x2, $y2, $rgb, $width, $dash );
		$this->mark( max( $y1, $y2 ) );
	}

	private static function num( $n ) {
		return rtrim( rtrim( number_format( $n, 2, '.', '' ), '0' ), '.' );
	}

	private static function rgb( $c ) {
		return self::num( $c[0] ) . ' ' . self::num( $c[1] ) . ' ' . self::num( $c[2] );
	}

	private function stream( $p, $h ) {
		$out = array();
		$n   = count( $this->pages );
		foreach ( $p['ops'] as $o ) {
			switch ( $o[0] ) {
				case 't':
					$s = str_replace( array( '{page}', '{pages}' ), array( $o['page'] ?? '', $n ), $o[3] );
					$b = str_replace( array( '\\', '(', ')', "\r", "\n" ), array( '\\\\', '\\(', '\\)', '', ' ' ), self::enc( $s ) );
					$out[] = sprintf( 'BT %s rg /F%d %s Tf %s %s Td (%s) Tj ET', self::rgb( $o[6] ), $o[5] ? 2 : 1, self::num( $o[4] ), self::num( $o[1] ), self::num( $h - $o[2] ), $b );
					break;
				case 'r':
					$out[] = sprintf( '%s rg %s %s %s %s re f', self::rgb( $o[5] ), self::num( $o[1] ), self::num( $h - $o[2] - $o[4] ), self::num( $o[3] ), self::num( $o[4] ) );
					break;
				case 'l':
					$out[] = sprintf( '%s RG %s w %s %s %s m %s %s l S %s', self::rgb( $o[5] ), self::num( $o[6] ), $o[7] ? '[2 2] 0 d' : '[] 0 d', self::num( $o[1] ), self::num( $h - $o[2] ), self::num( $o[3] ), self::num( $h - $o[4] ), '' );
					break;
			}
		}
		return implode( "\n", $out );
	}

	/** The finished file. "{page}" and "{pages}" in any text are filled in. */
	public function output() {
		foreach ( $this->pages as $i => &$p ) {
			foreach ( $p['ops'] as &$o ) {
				if ( 't' === $o[0] ) {
					$o['page'] = $i + 1;
				}
			}
			unset( $o );
		}
		unset( $p );

		$objs   = array();
		$objs[] = '<< /Type /Catalog /Pages 2 0 R >>';
		$objs[] = null; // pages, filled below
		$objs[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
		$objs[] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
		$kids   = array();
		foreach ( $this->pages as $p ) {
			$h      = $this->grow ? max( 120, $p['bottom'] + 22 ) : $this->h;
			$body   = $this->stream( $p, $h );
			$objs[] = '<< /Length ' . strlen( $body ) . " >>\nstream\n" . $body . "\nendstream";
			$cid    = count( $objs );
			$objs[] = sprintf( '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %s %s] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>', self::num( $this->w ), self::num( $h ), $cid );
			$kids[] = count( $objs ) . ' 0 R';
		}
		$objs[1] = '<< /Type /Pages /Kids [' . implode( ' ', $kids ) . '] /Count ' . count( $kids ) . ' >>';
		$objs[]  = '<< /Title (' . str_replace( array( '(', ')', '\\' ), array( '\\(', '\\)', '\\\\' ), self::enc( $this->title ) ) . ') /Producer (Al Hadeed Hardware) /CreationDate (D:' . gmdate( 'YmdHis' ) . ') >>';
		$info    = count( $objs );

		$pdf  = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
		$offs = array();
		foreach ( $objs as $i => $o ) {
			$offs[] = strlen( $pdf );
			$pdf   .= ( $i + 1 ) . " 0 obj\n" . $o . "\nendobj\n";
		}
		$xref = strlen( $pdf );
		$pdf .= 'xref' . "\n0 " . ( count( $objs ) + 1 ) . "\n0000000000 65535 f \n";
		foreach ( $offs as $o ) {
			$pdf .= sprintf( "%010d 00000 n \n", $o );
		}
		$pdf .= 'trailer' . "\n<< /Size " . ( count( $objs ) + 1 ) . " /Root 1 0 R /Info {$info} 0 R >>\nstartxref\n{$xref}\n%%EOF";
		return $pdf;
	}
}
