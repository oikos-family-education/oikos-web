const withNextIntl = require('next-intl/plugin')('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@oikos/ui", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities", "@dnd-kit/accessibility"],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://api:8000/api/:path*',
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
