import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The analysis runs entirely in the browser; the server only handles
  // payment, the unlock token and the programme database.
  poweredByHeader: false,
  // The demo dataset is read from disk by the API routes when no data branch is reachable.
  outputFileTracingIncludes: {
    '/api/**': ['./data/sample/**/*'],
    '/fields/**': ['./data/sample/**/*'],
    '/how-it-works': ['./data/sample/**/*'],
    '/': ['./data/sample/**/*'],
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
