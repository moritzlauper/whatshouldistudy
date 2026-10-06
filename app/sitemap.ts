import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { siteForHost, siteUrl } from '@/lib/site.ts'
import { LOCAL_SITES, SITES } from '@/lib/site/config.ts'
import type { LocalSiteId } from '@/lib/site/config.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'

const LOCAL_PAGES = ['', '/start', '/so-funktionierts', '/faecher', ...FIELDS.map((f) => `/faecher/${f.id}`), '/organisationen', '/datenschutz', '/agb', '/impressum']
const GLOBAL_PAGES = ['', '/start', '/how-it-works', '/fields', ...FIELDS.map((f) => `/fields/${f.id}`), '/organisations', '/privacy', '/terms', '/imprint']
const priority = (p: string) => (p === '' ? 1 : p === '/start' ? 0.9 : /\/(fields|faecher)\//.test(p) ? 0.6 : /privacy|terms|imprint|datenschutz|agb|impressum/.test(p) ? 0.2 : 0.7)

/** One sitemap per host: a country domain lists its own pages, the global one everything still under it. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const host = (await headers()).get('host') ?? ''
  const own = siteForHost(host)
  // A country host without NEXT_PUBLIC_XX_URL yet: use the host itself.
  const localUrl = (site: LocalSiteId, p: string) => (own === site && !SITES[site].domainUrl ? `https://${host.split(':')[0]}${p || '/'}` : siteUrl(site, p))
  const local = (site: LocalSiteId) => LOCAL_PAGES.map((p) => ({ url: localUrl(site, p), lastModified: now, priority: priority(p) }))
  if (own) return local(own)
  return [
    ...GLOBAL_PAGES.map((p) => ({ url: siteUrl('global', p), lastModified: now, priority: priority(p) })),
    // Country sites without a domain of their own are part of this one.
    ...LOCAL_SITES.filter((s) => !SITES[s].domainUrl).flatMap(local),
  ]
}
