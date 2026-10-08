import { CH_FR_IT_URL, LOCAL_SITES, SITES } from './site/config.ts'
import type { LocalSiteId, SiteId } from './site/config.ts'

export const SITE_NAME = 'whatshouldistudy'
/** Public origin of the global site. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://whatshouldistudy.com').replace(/\/$/, '')
/** Path prefix of the whole app (next.config.ts basePath), empty at the domain root. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
/** Where the code lives. The site is open source (MIT). */
export const SOURCE_URL = (process.env.NEXT_PUBLIC_SOURCE_URL || 'https://github.com/moritzlauper/whatshouldistudy').replace(/\/$/, '')
export const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'team@whatshouldistudy.com'

/** A path inside the app as the browser must request it (fetch, plain links). next/link adds it by itself. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`
}

/** Absolute public address of a page of a site, for canonical links, the sitemap and links between domains. */
export function siteUrl(site: SiteId, path = ''): string {
  if (site === 'global') return `${SITE_URL}${BASE_PATH}${path || (BASE_PATH ? '' : '/')}`
  const c = SITES[site]
  if (site === 'ch' && CH_FR_IT_URL && /^\/(?:fr|it)(?:\/|$)/.test(path)) return `${CH_FR_IT_URL}${path}`
  return c.domainUrl ? `${c.domainUrl}${path || '/'}` : `${SITE_URL}${BASE_PATH}/${c.mount}${path}`
}

const HOSTS_ENV: Record<LocalSiteId, string | undefined> = {
  ch: process.env.WSIS_CH_HOSTS,
  de: process.env.WSIS_DE_HOSTS,
  at: process.env.WSIS_AT_HOSTS,
}

/** The host of a URL, with and without www. */
function urlHosts(url: string): string[] {
  if (!url) return []
  try {
    const h = new URL(url).hostname.toLowerCase()
    return [h, h.startsWith('www.') ? h.slice(4) : `www.${h}`]
  } catch {
    // Ignore a malformed URL.
    return []
  }
}

/** The host of a country site's own domain (NEXT_PUBLIC_XX_URL), with and without www. */
export const domainHosts = (site: LocalSiteId) => urlHosts(SITES[site].domainUrl)
/** The host of the Swiss French and Italian versions' domain (NEXT_PUBLIC_CH_FR_IT_URL). */
export const frItHosts = () => urlHosts(CH_FR_IT_URL)

/** Hosts of a country site: its domain (for Switzerland also the French and Italian one) plus WSIS_XX_HOSTS. With a domain set, proxy.ts redirects the extra hosts to it. */
export function hostsFor(site: LocalSiteId): string[] {
  const hosts = [...(HOSTS_ENV[site] ?? '').split(','), ...domainHosts(site), ...(site === 'ch' ? frItHosts() : [])]
  return [...new Set(hosts.map((h) => h.trim().toLowerCase()).filter(Boolean))]
}

export function siteForHost(host: string): LocalSiteId | null {
  const h = host.split(':')[0].toLowerCase()
  return LOCAL_SITES.find((s) => hostsFor(s).includes(h)) ?? null
}
