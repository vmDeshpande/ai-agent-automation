/** @type {import('next').NextConfig} */

/* Backend internal URL for server-side proxying.
 *
 * IMPORTANT: this is a SERVER-ONLY variable. It is read by Next.js at
 * build time inside `next.config.js`, which runs in Node, NOT in the
 * browser. As a result it is safe to point at a Docker-internal
 * hostname such as `http://backend:5000` because only the Next.js
 * server (running inside the `frontend` container) ever resolves it.
 *
 * The browser instead sees same-origin URLs:
 *   - /api/*    → rewritten by Next.js → BACKEND_INTERNAL_URL/api/*
 *   - /socket.io/* → rewritten by Next.js → BACKEND_INTERNAL_URL/socket.io/*
 *
 * This means:
 *   1. The browser no longer needs to know the backend hostname or
 *      port. The app works behind any reverse proxy (nginx, Caddy,
 *      Cloudflare, custom domain) with no rebuild.
 *   2. Browser-facing NEXT_PUBLIC_* variables are no longer needed
 *      for API routing.
 *   3. Local development still works: when BACKEND_INTERNAL_URL is
 *      unset, the rewrites fall back to http://localhost:5000, which
 *      is where the backend listens by default. */
const backendInternalUrl =
  process.env.BACKEND_INTERNAL_URL || 'http://localhost:5000';

const nextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendInternalUrl}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendInternalUrl}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
