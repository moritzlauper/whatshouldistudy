import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { siteForHost } from '@/lib/site.ts'
import { LOCAL_SITES, SITES, routes } from '@/lib/site/config.ts'
import type { SiteId } from '@/lib/site/config.ts'
import { languages, pageUrl, variants } from '@/lib/site/meta.ts'
import type { Page } from '@/lib/site/meta.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'

const PAGES: Page[] = [
  (r) => r.home,
  (r) => r.start,
  (r) => r.how,
  (r) => r.fields,
  ...FIELDS.map((f): Page => (r) => r.field(f.id)),
  (r) => r.teachers,
  (r) => r.orgs,
  (r) => r.privacy,
  (r) => r.terms,
  (r) => r.imprint,
]

function priority(page: Page): number {
  const r = routes('global')
  const p = page(r)
  if (p === r.home) return 1
  if (p === r.start) return 0.9
  if (p.startsWith(`${r.fields}/`)) return 0.6
  if ([r.privacy, r.terms, r.imprint].includes(p)) return 0.2
  return 0.7
}

// No lastModified: the pages carry no real edit date, and "now" on every request teaches crawlers to ignore it.
const entries = (site: SiteId) =>
  variants()
    .filter((v) => v.site === site)
    .flatMap((v) => PAGES.map((page) => ({ url: pageUrl(site, page, v.locale), priority: priority(page), alternates: { languages: languages(page) } })))

/** One sitemap per host: a country domain lists its own pages in each of its languages, the global one everything still under it. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const own = siteForHost((await headers()).get('host') ?? '')
  if (own) return entries(own)
  // Country sites without a domain of their own are part of the global one.
  return [...entries('global'), ...LOCAL_SITES.filter((s) => !SITES[s].domainUrl).flatMap(entries)]
}
