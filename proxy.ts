import { NextResponse } from 'next/server.js'
import type { NextRequest } from 'next/server.js'
import { CH_FR_IT_URL, CH_LANGUAGES, LOCAL_SITES, SITES } from './lib/site/config.ts'
import { domainHosts, frItHosts, siteForHost, siteUrl } from './lib/site.ts'
import { FIELD_SLUG_DE } from './lib/site/slugs-de.ts'

/**
 * Serves each country site on its own domain without a second deployment.
 * On a country host every path is rewritten to that site's internal mount
 * (/ch-site/…, /de-site/…, /at-site/…), whose pages link without a prefix.
 * On the global host the same pages live at /schweiz/…, /deutschland/… and
 * /oesterreich/…; once a country has its own domain, those move there.
 * Other hosts of a country (WSIS_XX_HOSTS, e.g. a former domain) redirect to
 * its domain. The Swiss French and Italian versions may have a domain of their
 * own (NEXT_PUBLIC_CH_FR_IT_URL), which serves only /fr, /it and the sign-in
 * callbacks. Own domains need the app at the root (no WSIS_BASE_PATH).
 */

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
const rest = (path: string, prefix: string) => path.slice(prefix.length)

/** The field pages of the country sites moved from the English id (/faecher/computer-science) to a German address. */
function movedField(path: string): string | null {
  const id = /^\/faecher\/([^/]+)\/?$/.exec(path)?.[1]
  const slug = id ? FIELD_SLUG_DE[id] : undefined
  return slug && slug !== id ? `/faecher/${slug}` : null
}
/** The first of German, French and Italian the browser asks for; French when none. */
function swissLanguage(req: NextRequest): 'de' | 'fr' | 'it' {
  for (const part of (req.headers.get('accept-language') ?? '').split(',')) {
    const lang = part.trim().slice(0, 2).toLowerCase()
    if (lang === 'de' || lang === 'fr' || lang === 'it') return lang
  }
  return 'fr'
}
const redirectTo = (url: NextRequest['nextUrl'], pathname: string) => {
  const to = url.clone()
  to.pathname = pathname
  return NextResponse.redirect(to, 308)
}

export function proxy(req: NextRequest) {
  const url = req.nextUrl
  const path = url.pathname
  const host = (req.headers.get('host') ?? url.host).split(':')[0].toLowerCase()
  const local = siteForHost(host)

  if (local) {
    const c = SITES[local]
    const frIt = local === 'ch' && CH_LANGUAGES.some((l) => under(path, `/${l}`))
    if (local === 'ch' && frItHosts().includes(host)) {
      // The German pages live on the Swiss domain. Sign-ins come back to the domain they started on, whose storage holds the verifier.
      if (path === '/') {
        // Temporary (307): the answer depends on the browser's language.
        const lang = swissLanguage(req)
        if (lang === 'de' && c.domainUrl) return NextResponse.redirect(`${c.domainUrl}/${url.search}`, 307)
        const to = url.clone()
        to.pathname = `/${lang === 'de' ? 'fr' : lang}`
        return NextResponse.redirect(to, 307)
      }
      if (!frIt && !under(path, '/callback') && c.domainUrl) return NextResponse.redirect(`${c.domainUrl}${path}${url.search}`, 308)
    } else {
      if (c.domainUrl && !domainHosts(local).includes(host)) return NextResponse.redirect(`${c.domainUrl}${path}${url.search}`, 308)
      if (frIt && CH_FR_IT_URL) return NextResponse.redirect(`${CH_FR_IT_URL}${path}${url.search}`, 308)
    }
    // The Swiss site's French and Italian versions are mounts of their own.
    if (frIt) return NextResponse.next()
    for (const prefix of [`/${c.mount}`, `/${c.domainMount}`]) {
      if (under(path, prefix)) return redirectTo(url, rest(path, prefix) || '/')
    }
    const moved = movedField(path)
    if (moved) return redirectTo(url, moved)
    const to = url.clone()
    to.pathname = `/${c.domainMount}${path === '/' ? '' : path}`
    return NextResponse.rewrite(to)
  }

  if ((SITES.ch.domainUrl || CH_FR_IT_URL) && CH_LANGUAGES.some((l) => under(path, `/${l}`))) return NextResponse.redirect(`${siteUrl('ch', path)}${url.search}`, 308)
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
