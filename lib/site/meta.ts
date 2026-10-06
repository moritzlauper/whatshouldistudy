import type { Metadata } from 'next'
import { BASE_PATH, SITE_URL, siteUrl } from '../site.ts'
import { mountInfo } from './kit.ts'
import { dict } from './dict.ts'
import { LOCAL_SITES, SITES, routes } from './config.ts'
import type { Dict } from './dict.ts'
import type { Routes, SiteId } from './config.ts'

/** A page that exists on every site, named by its route: (r) => r.start, (r) => r.field(id). */
export type Page = (r: Routes) => string

/** Public address of a page on a site. */
export function pageUrl(site: SiteId, page: Page): string {
  const path = page(routes(site))
  return siteUrl(site, path === '/' ? '' : path)
}

/** The same page on all four sites, for hreflang: English is also the default for everyone else. */
export function languages(page: Page): Record<string, string> {
  const en = pageUrl('global', page)
  const out: Record<string, string> = { en, 'x-default': en }
  for (const s of LOCAL_SITES) out[SITES[s].intl] = pageUrl(s, page)
  return out
}

/** The share image of a site (app/og/[file]/route.tsx). */
export function ogImage(site: SiteId) {
  const origin = SITES[site].domainUrl || SITE_URL
  return { url: `${origin}${BASE_PATH}/og/${site}.png`, width: 1200, height: 630, alt: dict(SITES[site].locale).meta.title }
}

type Text = { title?: string; description?: string; index?: boolean }

/**
 * Title, description, canonical link, language alternates and share card of a page.
 * Without a title the layout's default applies (the home pages).
 */
export function pageMeta(site: SiteId, page: Page, m: Text): Metadata {
  const c = SITES[site]
  const t = dict(c.locale)
  const own = { ...(m.title ? { title: m.title } : {}), ...(m.description ? { description: m.description } : {}) }
  if (m.index === false) return { ...own, robots: { index: false } }
  const url = pageUrl(site, page)
  const title = m.title ? `${m.title} · ${c.name}` : t.meta.title
  const description = m.description ?? t.meta.description
  const image = ogImage(site)
  return {
    ...own,
    alternates: { canonical: url, languages: languages(page) },
    openGraph: { type: 'website', siteName: c.name, title, description, url, locale: c.ogLocale, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

/** pageMeta for a country-site page, whose site comes from its mount. */
export async function localMeta(params: Promise<{ mount: string }>, page: Page, pick: (t: Dict) => Text): Promise<Metadata> {
  const { site } = mountInfo((await params).mount)
  return pageMeta(site, page, pick(dict(SITES[site].locale)))
}
