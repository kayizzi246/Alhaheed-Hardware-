import './globals.css';

export const metadata = {
  title: 'Al Hadeed Hardware - Staff Panel',
  description: 'Cashier and Accounts web panel for the Al Hadeed Hardware ordering and cash booking system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
