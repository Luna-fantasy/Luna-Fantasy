const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Tree-shake three.js + drei in Railway builds so only the instancedMesh
    // + ShaderMaterial path we actually use ships to /admin/v2/*.
    optimizePackageImports: ['three', '@react-three/drei', '@react-three/fiber'],
  },
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
  skipTrailingSlashRedirect: true,
  async headers() {
    // Content-Security-Policy — defense-in-depth against XSS. Running in
    // Report-Only mode for now so any third-party script/style/font that
    // isn't whitelisted logs a console violation instead of being blocked.
    // Flip to Content-Security-Policy (enforce) after a clean week in dev.
    //
    // 'unsafe-inline' + 'unsafe-eval' on script-src are required by Next.js
    // hydration + dev HMR. Tighten to nonce-based in a future pass if we
    // ever move to fully static delivery.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https://assets.lunarian.app https://cdn.discordapp.com data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://discord.com https://cdn.discordapp.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Two years, include all subdomains, eligible for the HSTS preload list
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Report-Only = browser reports violations to the console without blocking.
          // After validation, rename the key to 'Content-Security-Policy' to enforce.
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ];
  },
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
