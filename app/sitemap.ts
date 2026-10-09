import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { frItHosts, siteForHost } from '@/lib/site.ts'
import { CH_FR_IT_URL, LOCAL_SITES, SITES, isChFrIt, routes } from '@/lib/site/config.ts'
import type { Locale, SiteId } from '@/lib/site/config.ts'
import { blogLanguages, catalogueLanguages, languages, pageUrl, variants } from '@/lib/site/meta.ts'
import type { Page } from '@/lib/site/meta.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { allPosts, blogLang, showsOn } from '@/lib/blog.ts'
import type { BlogPage } from '@/lib/site/meta.ts'
import { CATALOGUE_COUNTRIES } from '@/lib/catalogue.ts'
import { getMeta } from '@/lib/server/data.ts'
import type { DataMeta } from '@/lib/programmes.ts'

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

/** The blog in English and German; a post has an address per language and may exist on one site only. */
const BLOG: Array<{ page: BlogPage; priority: number; date?: string }> = [
  { page: () => (r) => r.blog, priority: 0.6 },
  ...allPosts().map((p) => ({ page: ((lang, site) => (showsOn(p, site, lang) ? (r) => r.post(p[lang]!.slug) : null)) as BlogPage, priority: 0.5, date: p.date })),
]

/**
 * The programme catalogue: on the global site every country with programmes,
 * on a country site its own. Fields with fewer than three programmes there
 * are left out, their pages are not indexed. The data date is a real one.
 */
function catalogue(meta: DataMeta | null, site: SiteId, locale: Locale) {
  const own = SITES[site].country
  const countries = CATALOGUE_COUNTRIES.filter((cc) => (own ? cc === own : true) && (meta?.byCountry?.[cc]?.programmes ?? 0) > 0)
  const lastModified = meta?.updated
  return [
    ...(own ? [] : [{ url: pageUrl(site, (r) => r.programmes, locale), priority: 0.7, lastModified, alternates: { languages: catalogueLanguages('', (r) => r.programmes) } }]),
    ...countries.flatMap((cc) => [
      { url: pageUrl(site, (r) => r.country(cc), locale), priority: 0.8, lastModified, alternates: { languages: catalogueLanguages(cc, (r) => r.country(cc)) } },
      ...FIELDS.filter((f) => (meta?.counts[f.id]?.[cc] ?? 0) >= 3).map((f) => ({
        url: pageUrl(site, (r) => r.countryField(cc, f.id), locale),
        priority: 0.6,
        lastModified,
        alternates: { languages: catalogueLanguages(cc, (r) => r.countryField(cc, f.id)) },
      })),
    ]),
  ]
}

// No lastModified on the fixed pages: they carry no real edit date, and "now" on every request teaches crawlers to ignore it.
const entries = (site: SiteId, meta: DataMeta | null, frIt?: boolean) =>
  variants()
    .filter((v) => v.site === site && (frIt === undefined || isChFrIt(v.locale) === frIt))
    .flatMap((v) => {
      const lang = blogLang(v.locale)
      return [
        ...PAGES.map((page) => ({ url: pageUrl(site, page, v.locale), priority: priority(page), alternates: { languages: languages(page) } })),
        ...(lang
          ? BLOG.flatMap((b) => {
              const page = b.page(lang, site)
              return page ? [{ url: pageUrl(site, page, v.locale), priority: b.priority, ...(b.date ? { lastModified: b.date } : {}), alternates: { languages: blogLanguages(b.page) } }] : []
            })
          : []),
        ...catalogue(meta, site, v.locale),
      ]
    })

/** One sitemap per host: a country domain lists its own pages in each of its languages, the global one everything still under it. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = ((await headers()).get('host') ?? '').split(':')[0].toLowerCase()
  const own = siteForHost(host)
  const { meta, sample } = await getMeta()
  const data = sample ? null : meta
  // With a domain of their own, the Swiss French and Italian pages are listed there and only there.
  if (own === 'ch' && CH_FR_IT_URL) return entries('ch', data, frItHosts().includes(host))
  if (own) return entries(own, data)
  // Country sites without a domain of their own are part of the global one.
  return [...entries('global', data), ...LOCAL_SITES.filter((s) => !SITES[s].domainUrl).flatMap((s) => entries(s, data))]
}
