import { CATALOGUE_COUNTRIES, hasProgrammePages } from '../catalogue.ts'
import { frItHosts, siteForHost } from '../site.ts'
import { CH_FR_IT_URL, LOCAL_SITES, SITES, isChFrIt } from './config.ts'
import type { Locale, SiteId } from './config.ts'
import { variants } from './meta.ts'

/**
 * The programme pages are too many for one sitemap (Google reads at most
 * 50,000 addresses per file): they get files of their own per site, country
 * and part, /sitemaps/global-us-0.xml, listed in robots.txt. Each host lists
 * what it serves, the same split as sitemap.ts.
 */

export const URLS_PER_SITEMAP = 40_000

export interface SitemapGroup {
  site: SiteId
  /** The site's languages on this host; each programme has an address in each. */
  locales: Locale[]
  country: string
}

function localesOn(site: SiteId, frIt?: boolean): Locale[] {
  return variants()
    .filter((v) => v.site === site && (frIt === undefined || isChFrIt(v.locale) === frIt))
    .map((v) => v.locale)
}

const groupsFor = (site: SiteId, locales: Locale[]): SitemapGroup[] =>
  (site === 'global' ? CATALOGUE_COUNTRIES : [SITES[site].country!]).filter(hasProgrammePages).map((country) => ({ site, locales, country }))

export function sitemapGroups(host: string): SitemapGroup[] {
  const h = host.split(':')[0].toLowerCase()
  const own = siteForHost(h)
  if (own === 'ch' && CH_FR_IT_URL) return groupsFor('ch', localesOn('ch', frItHosts().includes(h)))
  if (own) return groupsFor(own, localesOn(own))
  // Country sites without a domain of their own are part of the global one.
  return [...groupsFor('global', ['en']), ...LOCAL_SITES.filter((s) => !SITES[s].domainUrl).flatMap((s) => groupsFor(s, localesOn(s)))]
}

/** Programmes per file, so that a file stays under URLS_PER_SITEMAP addresses in all its languages. */
export const perFile = (g: SitemapGroup) => Math.max(1, Math.floor(URLS_PER_SITEMAP / Math.max(1, g.locales.length)))

export const sitemapFileName = (g: SitemapGroup, part: number) => `${g.site}-${g.country.toLowerCase()}-${part}.xml`

/** The programme sitemaps of a host, from the number of programmes per country. */
export function sitemapFiles(host: string, programmes: (cc: string) => number): string[] {
  return sitemapGroups(host).flatMap((g) => Array.from({ length: Math.ceil(programmes(g.country) / perFile(g)) }, (_, i) => sitemapFileName(g, i)))
}

/** global-us-0.xml → its group on this host and the part, or null. */
export function sitemapFile(host: string, name: string): { group: SitemapGroup; part: number } | null {
  const m = /^([a-z]+)-([a-z]{2})-(\d{1,4})\.xml$/.exec(name)
  if (!m) return null
  const group = sitemapGroups(host).find((g) => g.site === m[1] && g.country === m[2].toUpperCase())
  return group ? { group, part: Number(m[3]) } : null
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** A sitemap file; `alternates` are the hreflang links of an address. */
export function sitemapXml(urls: Array<{ loc: string; lastmod?: string; alternates?: Record<string, string> }>): string {
  const body = urls
    .map((u) => {
      const alt = Object.entries(u.alternates ?? {})
        .map(([l, href]) => `<xhtml:link rel="alternate" hreflang="${esc(l)}" href="${esc(href)}"/>`)
        .join('')
      return `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ''}${alt}</url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`
}
