import 'server-only'
import { LOCAL_SITES, SITES, isLocal, routes } from '@/lib/site/config.ts'
import type { Locale, Routes, SiteId } from '@/lib/site/config.ts'
import { BASE_PATH, SITE_URL } from '@/lib/site.ts'

const origin = (u: string) => {
  try {
    return u ? new URL(u).origin : ''
  } catch {
    return ''
  }
}

/** Where buyers may be sent back to: our own domains. Anything else would be an open redirect. */
function returnOrigin(req: Request, claimed: string | null): string {
  const own = new URL(req.url).origin
  const allowed = new Set([own, origin(SITE_URL), ...LOCAL_SITES.map((s) => origin(SITES[s].domainUrl)), ...(process.env.WSIS_ALLOWED_ORIGINS ?? '').split(',').map((o) => origin(o.trim()))])
  allowed.delete('')
  // Behind angebunden's rewrite the request arrives at this deployment's own address; the page tells us where the buyer is.
  return claimed && allowed.has(claimed) ? claimed : own
}

/**
 * The site a request comes from and absolute URLs into it, for Stripe's return
 * links. Query: site, back (the site's mount when served under the global
 * domain) and o (the page's origin).
 */
export function returnTo(req: Request): { site: SiteId; r: Routes; abs: (path: string) => string } {
  const url = new URL(req.url)
  const asked = url.searchParams.get('site') as SiteId | null
  const site: SiteId = asked && asked in SITES ? asked : 'global'
  const conf = SITES[site]
  const requestedLocale = url.searchParams.get('locale')
  const locale: Locale = site === 'ch' && (requestedLocale === 'fr-CH' || requestedLocale === 'it-CH') ? requestedLocale : conf.locale
  // The site's pages live at its mount on the global domain, or at the root of its own domain.
  const back = isLocal(site) && url.searchParams.get('back') === `/${conf.mount}` ? `/${conf.mount}` : ''
  const base = `${returnOrigin(req, url.searchParams.get('o'))}${BASE_PATH}`
  return { site, r: routes(site, back, locale), abs: (path) => `${base}${path}` }
}
