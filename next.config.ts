import type { NextConfig } from 'next'

/**
 * The app serves at the domain root. WSIS_BASE_PATH (e.g. /whatshouldistudy)
 * mounts it under a path instead, for running it as a zone inside another site.
 */
const basePath = (process.env.WSIS_BASE_PATH || '').replace(/\/+$/, '')

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
  // Under a base path the domain has nothing at its root; send visitors to the app.
  // At the root, old links from the time under /whatshouldistudy lose that prefix.
  async redirects() {
    return basePath
      ? [{ source: '/', destination: basePath, basePath: false, permanent: false }]
      : [{ source: '/whatshouldistudy/:path*', destination: '/:path*', permanent: true }]
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
