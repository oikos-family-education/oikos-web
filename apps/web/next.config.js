const withNextIntl = require('next-intl/plugin')('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
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
        ignored: ['**/node_modules', '**/.next', '**/.git'],
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
