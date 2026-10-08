import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { siteForHost } from '@/lib/site.ts'
import { LOCAL_SITES, SITES, routes } from '@/lib/site/config.ts'
import type { SiteId } from '@/lib/site/config.ts'
import { languages, pageUrl, variants } from '@/lib/site/meta.ts'
import type { Page } from '@/lib/site/meta.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { allPosts, blogLang } from '@/lib/blog.ts'
import type { BlogLang } from '@/lib/blog.ts'

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

/** The blog in English and German, with a page per language (post addresses differ by language). */
const BLOG: Array<{ page: (lang: BlogLang) => Page; priority: number; date?: string }> = [
  { page: () => (r) => r.blog, priority: 0.6 },
  ...allPosts().map((p) => ({ page: (lang: BlogLang): Page => (r) => r.post(p[lang].slug), priority: 0.5, date: p.date })),
]

function blogLanguages(page: (lang: BlogLang) => Page): Record<string, string> {
  const out: Record<string, string> = { 'x-default': pageUrl('global', page('en')) }
  for (const v of variants()) {
    const lang = blogLang(v.locale)
    if (lang) out[v.locale] = pageUrl(v.site, page(lang), v.locale)
  }
  return out
}

// No lastModified on the fixed pages: they carry no real edit date, and "now" on every request teaches crawlers to ignore it.
const entries = (site: SiteId) =>
  variants()
    .filter((v) => v.site === site)
    .flatMap((v) => {
      const lang = blogLang(v.locale)
      return [
        ...PAGES.map((page) => ({ url: pageUrl(site, page, v.locale), priority: priority(page), alternates: { languages: languages(page) } })),
        ...(lang ? BLOG.map((b) => ({ url: pageUrl(site, b.page(lang), v.locale), priority: b.priority, ...(b.date ? { lastModified: b.date } : {}), alternates: { languages: blogLanguages(b.page) } })) : []),
      ]
    })

/** One sitemap per host: a country domain lists its own pages in each of its languages, the global one everything still under it. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const own = siteForHost((await headers()).get('host') ?? '')
  if (own) return entries(own)
  // Country sites without a domain of their own are part of the global one.
  return [...entries('global'), ...LOCAL_SITES.filter((s) => !SITES[s].domainUrl).flatMap(entries)]
}
