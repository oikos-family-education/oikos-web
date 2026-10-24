const path = require('path');
const withNextIntl = require('next-intl/plugin')('./i18n.ts');

// The desktop build (scripts/build-desktop.mjs) bundles a self-contained server for Electron to run
const standalone = process.env.NEXT_OUTPUT_STANDALONE === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A separate build folder lets a host-side build run without touching the
  // .next that the Docker dev server serves through its bind mount
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: standalone ? 'standalone' : undefined,
  // Trace from the monorepo root so the standalone folder includes the hoisted node_modules
  // and the workspace packages; server.js lands at <standalone>/apps/web/server.js
  ...(standalone && { experimental: { outputFileTracingRoot: path.join(__dirname, '../..') } }),
  transpilePackages: ["@oikos/ui", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities", "@dnd-kit/accessibility"],
  // Force webpack to poll for file changes in dev mode. Native inotify
  // events don't propagate from the Windows host into the Linux dev
  // container through Docker Desktop's bind mount, which leaves the
  // dev server unaware of edits — Next.js then keeps serving the
  // initial compile forever. Polling closes that gap.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 800,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.next', '**/.next-*', '**/.git'],
      };
    }
    return config;
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://api:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/:locale/journal',
        destination: '/:locale/notes',
        permanent: true,
      },
      {
        source: '/:locale/journal/:path*',
        destination: '/:locale/notes/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
