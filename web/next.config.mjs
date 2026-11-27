/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Smaller, quicker responses: no "powered by" header, gzip on.
  poweredByHeader: false,
  compress: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
  experimental: {
    // Only the parts of these packages a page uses go into it.
    optimizePackageImports: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-slot'],
  },
  async headers() {
    // Pictures, fonts and built code never change under the same name:
    // the browser keeps them a year instead of asking again.
    return [
      { source: '/:all*(svg|png|jpg|jpeg|webp|ico|woff2)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
};
export default nextConfig;
