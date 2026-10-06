import { LOCAL_SITES, SITES } from './site/config.ts'
import type { LocalSiteId, SiteId } from './site/config.ts'

export const SITE_NAME = 'whatshouldistudy'
/** Public origin of the global site. While the project lives inside angebunden, that is angebunden.ch. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://angebunden.ch').replace(/\/$/, '')
/** Path prefix of the whole app (next.config.ts basePath), empty at the domain root. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
/** Where the code lives. The site is open source (MIT). */
export const SOURCE_URL = (process.env.NEXT_PUBLIC_SOURCE_URL || 'https://github.com/moritzlauper/whatshouldistudy').replace(/\/$/, '')
export const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@whatshouldistudy.com'

/** A path inside the app as the browser must request it (fetch, plain links). next/link adds it by itself. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`
}

/** Absolute public address of a page of a site, for canonical links, the sitemap and links between domains. */
export function siteUrl(site: SiteId, path = ''): string {
  if (site === 'global') return `${SITE_URL}${BASE_PATH}${path || (BASE_PATH ? '' : '/')}`
  const c = SITES[site]
  return c.domainUrl ? `${c.domainUrl}${path || '/'}` : `${SITE_URL}${BASE_PATH}/${c.mount}${path}`
}

const HOSTS_ENV: Record<LocalSiteId, string | undefined> = {
  ch: process.env.WSIS_CH_HOSTS,
  de: process.env.WSIS_DE_HOSTS,
  at: process.env.WSIS_AT_HOSTS,
}

/** Hosts that serve a country site at their root: WSIS_XX_HOSTS plus the host of its NEXT_PUBLIC_XX_URL (with and without www.). */
export function hostsFor(site: LocalSiteId): string[] {
  const hosts = (HOSTS_ENV[site] ?? '').split(',')
  const url = SITES[site].domainUrl
  if (url) {
    try {
      const h = new URL(url).hostname
      hosts.push(h, h.startsWith('www.') ? h.slice(4) : `www.${h}`)
    } catch {
      // Ignore a malformed URL.
    }
  }
  return [...new Set(hosts.map((h) => h.trim().toLowerCase()).filter(Boolean))]
}

export function siteForHost(host: string): LocalSiteId | null {
  const h = host.split(':')[0].toLowerCase()
  return LOCAL_SITES.find((s) => hostsFor(s).includes(h)) ?? null
}
