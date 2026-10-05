import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CH_URL, chHosts } from './lib/site.ts'

/**
 * Serves the Swiss site on its own domain without a second deployment.
 * On a Swiss host every path is rewritten to the internal mount (/ch-site/…),
 * whose pages link without a prefix. On the global host the same pages live
 * at /schweiz/…; once NEXT_PUBLIC_CH_URL is set, those move to the Swiss domain.
 */

const PUBLIC = '/schweiz'
const INTERNAL = '/ch-site'
const CH_HOSTS = chHosts()

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
const rest = (path: string, prefix: string) => path.slice(prefix.length)

export function proxy(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname
  const host = (req.headers.get('host') ?? url.host).split(':')[0].toLowerCase()

  if (CH_HOSTS.includes(host)) {
    for (const prefix of [PUBLIC, INTERNAL]) {
      if (under(path, prefix)) {
        const to = url.clone()
        to.pathname = rest(path, prefix) || '/'
        return NextResponse.redirect(to, 308)
      }
    }
    const to = url.clone()
    to.pathname = `${INTERNAL}${path === '/' ? '' : path}`
    return NextResponse.rewrite(to)
  }

  if (under(path, INTERNAL)) {
    const to = url.clone()
    to.pathname = `${PUBLIC}${rest(path, INTERNAL)}`
    return NextResponse.redirect(to, 308)
  }
  if (CH_URL && under(path, PUBLIC)) {
    return NextResponse.redirect(`${CH_URL}${rest(path, PUBLIC) || '/'}${url.search}`, 308)
  }
  return NextResponse.next()
}

export const config = {
  // Pages only: no API routes, build assets or files with an extension (sitemap.xml, icons).
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
}
