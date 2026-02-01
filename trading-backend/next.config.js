/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client'],
  experimental: {
    // Bundle Size Optimization: Auto-transform barrel imports to direct imports
    // This prevents loading 1,500+ modules from lucide-react on every import
    // Reference: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
};

module.exports = nextConfig;
