const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.lunarian.app',
      },
    ],
  },
  trailingSlash: true,
  async redirects() {
    return [
      {
        source: '/:locale(en|ar)/bumper/:path*',
        destination: '/:locale/luna-pairs/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
