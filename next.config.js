const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // basePath: '/Luna-Fantasy',
  images: {
    unoptimized: true, // Required for static export
  },
  trailingSlash: true,
};

module.exports = withNextIntl(nextConfig);
