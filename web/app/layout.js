import { Inter } from 'next/font/google';
import { THEME_SCRIPT } from '@/components/Theme';
import './globals.css';

/**
 * One typeface.
 *
 * Inter does everything: headings, body, forms, tables, buttons,
 * labels. It was drawn for screens at small sizes, its numerals line
 * up in a column — which matters on every screen in here — and it
 * carries a real 900, so a heading can be unmistakably the heaviest
 * thing on the page without a second family being downloaded to say
 * so.
 *
 * Two families was the earlier answer, and it was a reasonable one.
 * But the display face was doing nothing the weight range could not
 * do, and a second font is a second download on a Kampala connection
 * before a cashier can take money.
 *
 * Loaded through next/font, so it is served from this site rather
 * than fetched from Google at runtime: no third-party request, and no
 * jump when it arrives.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata = {
  title: 'Al Hadeed Hardware - Staff Panel',
  description: 'Cashier and Accounts web panel for the Al Hadeed Hardware ordering and cash booking system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the theme before the first paint. Anything later than
            this is a white flash in a dark room. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
