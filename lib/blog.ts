import { POSTS } from '../content/blog/index.ts'
import type { Locale } from './site/config.ts'
import type { Post } from './blog-check.ts'

/**
 * The blog: one article a week, researched and written by
 * scripts/blog-post.ts (GitHub Action «whatshouldistudy blog»). Each post is
 * a JSON file in content/blog with an English version for the global site and
 * a German one in Swiss Standard German for the country sites; Germany and
 * Austria get it through regionalize(). French and Italian have no blog.
 */

export type { Post, PostText } from './blog-check.ts'

export type BlogLang = 'en' | 'de'

/** Which language version of the posts a site language shows, if any. */
export function blogLang(locale: Locale): BlogLang | null {
  if (locale === 'en') return 'en'
  return locale.startsWith('de-') ? 'de' : null
}

/** Newest first. */
export function allPosts(): Post[] {
  return [...POSTS].sort((a, b) => b.date.localeCompare(a.date))
}

export function findPost(lang: BlogLang, slug: string): Post | undefined {
  return POSTS.find((p) => p[lang].slug === slug)
}
