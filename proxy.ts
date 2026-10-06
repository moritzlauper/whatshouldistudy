import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { LOCAL_SITES, SITES } from './lib/site/config.ts'
import { siteForHost } from './lib/site.ts'
import { FIELD_SLUG_DE } from './lib/site/slugs-de.ts'

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

/** The field pages of the country sites moved from the English id (/faecher/computer-science) to a German address. */
function movedField(path: string): string | null {
  const id = /^\/faecher\/([^/]+)\/?$/.exec(path)?.[1]
  const slug = id ? FIELD_SLUG_DE[id] : undefined
  return slug && slug !== id ? `/faecher/${slug}` : null
}
const redirectTo = (url: NextRequest['nextUrl'], pathname: string) => {
  const to = url.clone()
  to.pathname = pathname
  return NextResponse.redirect(to, 308)
}

export function proxy(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname
  const local = siteForHost(req.headers.get('host') ?? url.host)

  if (local) {
    const c = SITES[local]
    for (const prefix of [`/${c.mount}`, `/${c.domainMount}`]) {
      if (under(path, prefix)) return redirectTo(url, rest(path, prefix) || '/')
    }
    const moved = movedField(path)
    if (moved) return redirectTo(url, moved)
    const to = url.clone()
    to.pathname = `/${c.domainMount}${path === '/' ? '' : path}`
    return NextResponse.rewrite(to)
  }

  for (const site of LOCAL_SITES) {
    const c = SITES[site]
    if (under(path, `/${c.domainMount}`)) return redirectTo(url, `/${c.mount}${rest(path, `/${c.domainMount}`)}`)
    if (c.domainUrl && under(path, `/${c.mount}`)) {
      return NextResponse.redirect(`${c.domainUrl}${rest(path, `/${c.mount}`) || '/'}${url.search}`, 308)
    }
    const moved = under(path, `/${c.mount}`) && movedField(rest(path, `/${c.mount}`))
    if (moved) return redirectTo(url, `/${c.mount}${moved}`)
  }
  return NextResponse.next()
}

export const config = {
  // Pages only: no API routes, build assets or files with an extension (sitemap.xml, icons).
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
}
