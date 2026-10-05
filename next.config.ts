import type { NextConfig } from 'next'

/**
 * While the project lives inside angebunden it runs under angebunden.ch/whatshouldistudy:
 * angebunden rewrites that path to this deployment (Next.js multi-zones). On its
 * own domain set WSIS_BASE_PATH=/ to serve it at the root.
 */
const basePath = (process.env.WSIS_BASE_PATH || '/whatshouldistudy').replace(/\/+$/, '')

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // The analysis runs entirely in the browser; the server only handles
  // payment, the unlock token and the programme database.
  poweredByHeader: false,
  // The demo dataset is read from disk by the API routes when no data branch is reachable.
  outputFileTracingIncludes: {
    '/**': ['./data/sample/**/*'],
  },
  // Two sites with their own root layouts share one 404 page.
  experimental: {
    globalNotFound: true,
  },
  // The zone's own domain has nothing at its root; send visitors to the app.
  async redirects() {
    return basePath ? [{ source: '/', destination: basePath, basePath: false, permanent: false }] : []
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
