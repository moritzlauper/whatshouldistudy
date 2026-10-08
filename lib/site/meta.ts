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

/**
 * Icons for browsers and search results. Google shows a favicon only if it is
 * SVG or a raster image whose size is a multiple of 48 px, hence the PNG.
 */
export const ICONS: Metadata['icons'] = {
  icon: [
    { url: `${BASE_PATH}/icon.svg`, type: 'image/svg+xml' },
    { url: `${BASE_PATH}/icon-192.png`, sizes: '192x192', type: 'image/png' },
  ],
  apple: `${BASE_PATH}/apple-touch-icon.png`,
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
 * A blog page in one language on one site, or null where it doesn't exist: the
 * blog speaks English and German only, a post has its own address per
 * language, and a country post exists on its own site only.
 */
export type BlogPage = (lang: BlogLang, site: SiteId) => Page | null

/** hreflang for a blog page: every language version that exists, English as the default. */
export function blogLanguages(page: BlogPage): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of variants()) {
    const lang = blogLang(v.locale)
    const p = lang && page(lang, v.site)
    if (p) out[v.locale] = pageUrl(v.site, p, v.locale)
  }
  if (out.en) out['x-default'] = out.en
  return out
}

/** pageMeta for a blog page. */
export function blogMeta(site: SiteId, page: BlogPage, m: Text, locale = SITES[site].locale): Metadata {
  const lang = blogLang(locale)
  const own = lang && page(lang, site)
  if (!own) return { robots: { index: false } }
  const meta = pageMeta(site, own, m, locale)
  return { ...meta, alternates: { ...meta.alternates, languages: blogLanguages(page) } }
}

/** pageMeta for a country-site page, whose site and language come from its mount. */
export async function localMeta(params: Promise<{ mount: string }>, page: Page, pick: (t: Dict) => Text): Promise<Metadata> {
  const { site, locale } = mountInfo((await params).mount)
  return pageMeta(site, page, pick(dict(locale)), locale)
}
