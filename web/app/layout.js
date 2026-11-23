import { Inter, Poppins } from 'next/font/google';
import { THEME_SCRIPT } from '@/components/Theme';
import './globals.css';

/**
 * The two typefaces.
 *
 * Poppins sets the headings, the navigation and the titles. It is a
 * geometric face — near-circular bowls, even strokes — so it reads as
 * built rather than written, which suits a counter. It also has a true
 * 900, which is what the big figures on these screens wanted.
 *
 * Inter does the reading: body text, forms, tables, buttons, labels.
 * It was drawn for screens at small sizes, its numerals line up in a
 * column, and it does not call attention to itself — which is what you
 * want from the font a cashier reads eight hours a day.
 *
 * Both are loaded through next/font, so they are served from this site
 * rather than fetched from Google at runtime: no third-party request
 * on a Kampala connection, and no jump when they arrive.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

/**
 * Poppins ships as static cuts, not a variable font, so the weights
 * have to be named — only these are downloaded. 900 is included
 * because Poppins actually has one, which Manrope did not: the
 * headline can now be a real Black rather than an 800 pretending.
 */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: 'Al Hadeed Hardware - Staff Panel',
  description: 'Cashier and Accounts web panel for the Al Hadeed Hardware ordering and cash booking system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the theme before the first paint. Anything later than
            this is a white flash in a dark room. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
