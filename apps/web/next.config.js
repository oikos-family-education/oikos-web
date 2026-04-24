const withNextIntl = require('next-intl/plugin')('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@oikos/ui", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities", "@dnd-kit/accessibility"],
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
