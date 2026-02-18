/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't bundle playwright for client/server — it's only used in API routes
  serverExternalPackages: ['playwright', 'playwright-core'],
}

module.exports = nextConfig
