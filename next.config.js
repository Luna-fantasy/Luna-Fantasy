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
        destination: '/:locale/faction-war/:path*',
        permanent: true,
      },
      {
        source: '/:locale(en|ar)/luna-pairs/:path*',
        destination: '/:locale/faction-war/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
