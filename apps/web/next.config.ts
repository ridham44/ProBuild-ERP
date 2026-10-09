import { existsSync } from 'node:fs';
import type { NextConfig } from 'next';

// One shared .env at the repository root (apps/web is the working directory here).
if (existsSync('../../.env')) process.loadEnvFile('../../.env');

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Vercel services setup does not serve /_next/image, so images are served as the static files they are.
  images: { unoptimized: true },
  // Linting is its own gate (pnpm lint); the build does not repeat it.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@probuild/shared', '@probuild/api-client'],
  async rewrites() {
    // Same-origin proxy so the httpOnly session cookie never crosses origins.
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
