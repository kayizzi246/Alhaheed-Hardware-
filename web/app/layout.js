import { Inter, Manrope } from 'next/font/google';
import { THEME_SCRIPT } from '@/components/Theme';
import './globals.css';

/**
 * The two typefaces.
 *
 * Manrope sets the headings, the navigation and the titles — it has a
 * squarer, more mechanical shape that suits a hardware shop, and it
 * holds up at the big weights the figures on these screens need.
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

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata = {
  title: 'Al Hadeed Hardware - Staff Panel',
  description: 'Cashier and Accounts web panel for the Al Hadeed Hardware ordering and cash booking system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the theme before the first paint. Anything later than
            this is a white flash in a dark room. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
