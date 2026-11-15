import { POSTS } from '../content/blog/index.ts'
import type { Locale, SiteId } from './site/config.ts'
import { POST_SITES } from './blog-check.ts'
import type { Post } from './blog-check.ts'

/**
 * The blog. A GitHub Action of a private repo researches and writes the posts.
 * Since 15.11.2026 it publishes them on the branch «whatshouldistudy-blog»
 * (posts.json), read at runtime by lib/server/blog.ts, so that a new post needs
 * no deployment; the posts before that stay in content/blog. Originally:
 * every other day one German article each for the Swiss, German and Austrian
 * site, from that country's sources, and once a week an English one for the
 * global site. Such a post only appears on its own site. The first posts were
 * written for every site at once, in English and Swiss German; Germany and
 * Austria get those through regionalize(). French and Italian have no blog.
 */

export type { Post, PostSite, PostText } from './blog-check.ts'

export type BlogLang = 'en' | 'de'

/** Which language version of the posts a site language shows, if any. */
export function blogLang(locale: Locale): BlogLang | null {
  if (locale === 'en') return 'en'
  return locale.startsWith('de-') ? 'de' : null
}

/** Whether a post appears on a site in a language. */
export const showsOn = (p: Post, site: SiteId, lang: BlogLang) => !!p[lang] && (!p.site || p.site === site)

/** Every post, newest first: those in content/blog, or the list from lib/server/blog.ts with the published ones. */
export function allPosts(posts: Post[] = POSTS): Post[] {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date))
}

/** The posts of a site in a language, newest first. */
export function postsFor(site: SiteId, lang: BlogLang, posts: Post[] = POSTS): Post[] {
  return allPosts(posts).filter((p) => showsOn(p, site, lang))
}

export function findPost(site: SiteId, lang: BlogLang, slug: string, posts: Post[] = POSTS): Post | undefined {
  return posts.find((p) => p[lang]?.slug === slug && showsOn(p, site, lang))
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const filled = (x: unknown) => typeof x === 'string' && x.trim().length > 0
const isText = (t: unknown) => {
  if (t === undefined) return true
  const x = t as Record<string, unknown> | null
  return !!x && typeof x.slug === 'string' && SLUG_RE.test(x.slug) && filled(x.title) && filled(x.description) && filled(x.body)
}

/** Whether a post read from the blog branch has the shape the pages need; the Action checked its content already. */
export function isPost(x: unknown): x is Post {
  const p = x as Record<string, unknown> | null
  if (!p || typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return false
  if (p.site !== undefined && !POST_SITES.includes(p.site as Post['site'] & string)) return false
  if (!Array.isArray(p.fields) || !p.fields.every((f) => typeof f === 'string')) return false
  if (!Array.isArray(p.sources) || !p.sources.every((s) => !!s && typeof s.url === 'string' && typeof s.title === 'string')) return false
  return (p.en !== undefined || p.de !== undefined) && isText(p.en) && isText(p.de)
}

const postKey = (p: Post) => `${p.site ?? ''}|${p.en?.slug ?? ''}|${p.de?.slug ?? ''}`

/** The posts in the repo and the valid ones from the branch, each once. */
export function mergePosts(own: Post[], published: unknown[]): Post[] {
  const seen = new Set(own.map(postKey))
  const out = [...own]
  for (const p of published) {
    if (!isPost(p) || seen.has(postKey(p))) continue
    seen.add(postKey(p))
    out.push(p)
  }
  return out
}
