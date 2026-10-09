import { POSTS } from '../content/blog/index.ts'
import type { Locale, SiteId } from './site/config.ts'
import type { Post } from './blog-check.ts'

/**
 * The blog. A GitHub Action of a private repo has Claude research
 * and write the posts and commits them here as JSON files in content/blog:
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

/** Every post, newest first. */
export function allPosts(): Post[] {
  return [...POSTS].sort((a, b) => b.date.localeCompare(a.date))
}

/** The posts of a site in a language, newest first. */
export function postsFor(site: SiteId, lang: BlogLang): Post[] {
  return allPosts().filter((p) => showsOn(p, site, lang))
}

export function findPost(site: SiteId, lang: BlogLang, slug: string): Post | undefined {
  return POSTS.find((p) => p[lang]?.slug === slug && showsOn(p, site, lang))
}
