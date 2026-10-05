import { LOCAL_SITES, SITES, isLocal, routes } from './config.ts'
import type { LocalSiteId, SiteId } from './config.ts'
import { dict } from './dict.ts'
import { siteUrl } from '../site.ts'

/** Everything a view needs to render for one site. */
export function kit(site: SiteId, base: string) {
  const conf = SITES[site]
  return { site, base, conf, locale: conf.locale, intl: conf.intl, t: dict(conf.locale), r: routes(site, base) }
}

export type Kit = ReturnType<typeof kit>

/** Every mount of the country sites: /schweiz and the internal path the Swiss domain is rewritten to, and so on. */
export const ALL_MOUNTS = LOCAL_SITES.flatMap((s) => [SITES[s].mount!, SITES[s].domainMount!])

/** Which country site a mount belongs to, and the link prefix its pages use there. */
export function mountInfo(mount: string): { site: LocalSiteId; base: string } {
  for (const site of LOCAL_SITES) {
    if (mount === SITES[site].mount) return { site, base: `/${mount}` }
    if (mount === SITES[site].domainMount) return { site, base: '' }
  }
  throw new Error(`Unknown mount ${mount}`)
}

/**
 * Link from one site to another. Inside the same domain a relative path (next/link
 * adds the base path), to or from a site with its own domain an absolute URL.
 */
export function siteHref(from: Pick<Kit, 'site' | 'base'>, to: SiteId): string {
  const onOwnDomain = isLocal(from.site) && from.base === ''
  if (to === 'global') return onOwnDomain ? siteUrl('global') : '/'
  if (SITES[to].domainUrl || onOwnDomain) return siteUrl(to)
  return `/${SITES[to].mount}`
}
