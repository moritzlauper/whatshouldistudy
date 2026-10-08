import type { Metadata } from 'next'
import { BASE_PATH, SITE_URL, siteUrl } from '../site.ts'
import { mountInfo } from './kit.ts'
import { dict } from './dict.ts'
import { SITES, routes } from './config.ts'
import { blogLang } from '../blog.ts'
import type { BlogLang } from '../blog.ts'
import type { Dict } from './dict.ts'
import type { Locale, Routes, SiteId } from './config.ts'

/** A page that exists on every site, named by its route: (r) => r.start, (r) => r.field(id). */
export type Page = (r: Routes) => string

/** One language version of a site: the Swiss one also speaks French and Italian. */
export type Variant = { site: SiteId; locale: Locale }

/**
 * Every language version, for hreflang. French and Italian live at /fr and /it
 * of the Swiss domain, so only once it has one.
 */
export function variants(): Variant[] {
  return [
    { site: 'global', locale: 'en' },
    { site: 'ch', locale: 'de-CH' },
    ...(SITES.ch.domainUrl ? ([{ site: 'ch', locale: 'fr-CH' }, { site: 'ch', locale: 'it-CH' }] as const) : []),
    { site: 'de', locale: 'de-DE' },
    { site: 'at', locale: 'de-AT' },
  ]
}

/** Public address of a page on a site, in one of its languages. */
export function pageUrl(site: SiteId, page: Page, locale = SITES[site].locale): string {
  const path = page(routes(site, '', locale))
  return siteUrl(site, path === '/' ? '' : path)
}

/** The same page in every language version; English is also the default for everyone else. */
export function languages(page: Page): Record<string, string> {
  const en = pageUrl('global', page)
  const out: Record<string, string> = { 'x-default': en }
  for (const v of variants()) out[v.locale] = pageUrl(v.site, page, v.locale)
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
export function pageMeta(site: SiteId, page: Page, m: Text, locale = SITES[site].locale): Metadata {
  const c = SITES[site]
  const t = dict(locale)
  const own = { ...(m.title ? { title: m.title } : {}), ...(m.description ? { description: m.description } : {}) }
  if (m.index === false) return { ...own, robots: { index: false } }
  const url = pageUrl(site, page, locale)
  const title = m.title ? `${m.title} · ${c.name}` : t.meta.title
  const description = m.description ?? t.meta.description
  const image = ogImage(site)
  return {
    ...own,
    alternates: { canonical: url, languages: languages(page) },
    openGraph: { type: 'website', siteName: c.name, title, description, url, locale: locale.replace('-', '_'), images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

/**
 * pageMeta for a blog page. The blog speaks English and German only, and a post
 * has its own address per language, so `page` gets the language.
 */
export function blogMeta(site: SiteId, page: (lang: BlogLang) => Page, m: Text, locale = SITES[site].locale): Metadata {
  const lang = blogLang(locale)
  if (!lang) return { robots: { index: false } }
  const meta = pageMeta(site, page(lang), m, locale)
  const en = pageUrl('global', page('en'))
  const languages: Record<string, string> = { 'x-default': en }
  for (const v of variants()) {
    const l = blogLang(v.locale)
    if (l) languages[v.locale] = pageUrl(v.site, page(l), v.locale)
  }
  return { ...meta, alternates: { ...meta.alternates, languages } }
}

/** pageMeta for a country-site page, whose site and language come from its mount. */
export async function localMeta(params: Promise<{ mount: string }>, page: Page, pick: (t: Dict) => Text): Promise<Metadata> {
  const { site, locale } = mountInfo((await params).mount)
  return pageMeta(site, page, pick(dict(locale)), locale)
}
