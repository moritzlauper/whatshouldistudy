import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { LOCAL_SITES, SITES } from './lib/site/config.ts'
import { siteForHost } from './lib/site.ts'

/**
 * Serves each country site on its own domain without a second deployment.
 * On a country host every path is rewritten to that site's internal mount
 * (/ch-site/…, /de-site/…, /at-site/…), whose pages link without a prefix.
 * On the global host the same pages live at /schweiz/…, /deutschland/… and
 * /oesterreich/…; once a country has its own domain, those move there.
 * Own domains need the app at the root (no WSIS_BASE_PATH).
 */

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
const rest = (path: string, prefix: string) => path.slice(prefix.length)

export function proxy(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname
  const local = siteForHost(req.headers.get('host') ?? url.host)

  if (local) {
    const c = SITES[local]
    for (const prefix of [`/${c.mount}`, `/${c.domainMount}`]) {
      if (under(path, prefix)) {
        const to = url.clone()
        to.pathname = rest(path, prefix) || '/'
        return NextResponse.redirect(to, 308)
      }
    }
    const to = url.clone()
    to.pathname = `/${c.domainMount}${path === '/' ? '' : path}`
    return NextResponse.rewrite(to)
  }

  for (const site of LOCAL_SITES) {
    const c = SITES[site]
    if (under(path, `/${c.domainMount}`)) {
      const to = url.clone()
      to.pathname = `/${c.mount}${rest(path, `/${c.domainMount}`)}`
      return NextResponse.redirect(to, 308)
    }
    if (c.domainUrl && under(path, `/${c.mount}`)) {
      return NextResponse.redirect(`${c.domainUrl}${rest(path, `/${c.mount}`) || '/'}${url.search}`, 308)
    }
  }
  return NextResponse.next()
}

export const config = {
  // Pages only: no API routes, build assets or files with an extension (sitemap.xml, icons).
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
}
