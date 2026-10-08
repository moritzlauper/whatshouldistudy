/**
 * The shape of a blog post and the checks it must pass before it is published
 * (by the generator in the outreach repo and test/blog.test.ts). Kept apart from
 * lib/blog.ts so it loads while content/blog/index.ts points at a deleted post.
 */

export interface PostText {
  slug: string
  title: string
  /** Lead and meta description. */
  description: string
  /** Markdown subset, see app/ui/markdown.tsx. */
  body: string
}

/** The site a post is written for. */
export type PostSite = 'global' | 'ch' | 'de' | 'at'
export const POST_SITES: PostSite[] = ['global', 'ch', 'de', 'at']

/**
 * A post either belongs to one site (`site`): the global one in English only,
 * a country site in German only, written in that country's German. Or, like
 * the first posts, it belongs to every site: then it has an English version
 * and a Swiss German one that regionalize() adapts.
 */
export interface Post {
  /** Publication date, YYYY-MM-DD. */
  date: string
  site?: PostSite
  /** Field ids the article is about, for links to the field pages. */
  fields: string[]
  sources: Array<{ title: string; url: string }>
  en?: PostText
  de?: PostText
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const words = (s: string) => s.split(/\s+/).filter(Boolean).length

/** Links a body may contain: a field page, the questionnaire or an https address. */
export function linkTarget(href: string, fieldIds: ReadonlySet<string>): { kind: 'field'; id: string } | { kind: 'start' } | { kind: 'url' } | null {
  if (href === 'start') return { kind: 'start' }
  if (href.startsWith('field:')) return fieldIds.has(href.slice(6)) ? { kind: 'field', id: href.slice(6) } : null
  return /^https:\/\/[^\s]+$/.test(href) ? { kind: 'url' } : null
}

/** Swiss spelling: ss, «», 83%, 1’250, 14.7, capital after a colon. */
function swissProblems(s: string): string[] {
  const out: string[] = []
  if (/ß/.test(s)) out.push('contains ß (Swiss spelling: ss)')
  if (/[„“"]/.test(s.replace(/\]\([^)]*\)/g, ''))) out.push('uses „“ or "" quotes (use «»)')
  if (/\d %/.test(s)) out.push('space before % (write 83%)')
  if (/\d,\d/.test(s)) out.push('decimal comma (write 14.7)')
  if (/\d\.\d{3}(?!\d)/.test(s)) out.push('thousands separated by a dot (write 1’250)')
  if (/: [a-zäöü]/.test(s)) out.push('lower case after a colon (continue with a capital letter)')
  return out
}

/** German and Austrian spelling: „“ instead of «», no Swiss number format, 83%, capital after a colon. */
function germanProblems(s: string): string[] {
  const out: string[] = []
  if (/[«»]/.test(s)) out.push('uses «» quotes (use „…“)')
  if (/\d[’']\d{3}/.test(s)) out.push('thousands separated by an apostrophe (write 1.250)')
  if (/\d %/.test(s)) out.push('space before % (write 83%)')
  if (/: [a-zäöüß]/.test(s)) out.push('lower case after a colon (continue with a capital letter)')
  return out
}

/** Dashes as sentence connectors. The en dash stays allowed in ranges such as 7–9. */
function dashProblems(s: string): string[] {
  const out: string[] = []
  if (/—/.test(s)) out.push('contains an em dash (—)')
  if (/(?<!\d)\s?–|–\s?(?!\d)/.test(s)) out.push('uses an en dash (–) outside a number range')
  if (/\S - \S/.test(s)) out.push('uses a spaced hyphen ( - ) as a dash')
  return out
}

/** Everything wrong with a post, empty when it can be published. */
export function checkPost(post: Post, existing: Post[], fieldIds: ReadonlySet<string>): string[] {
  const errors: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) errors.push(`date ${post.date} is not YYYY-MM-DD`)
  if (!post.fields.length || post.fields.length > 4) errors.push('fields must list 1 to 4 field ids')
  for (const f of post.fields) if (!fieldIds.has(f)) errors.push(`unknown field id ${f}`)
  if (post.sources.length < 3) errors.push('needs at least 3 sources')
  for (const s of post.sources) if (!/^https:\/\//.test(s.url) || !s.title.trim()) errors.push(`source needs a title and an https url: ${s.url}`)
  if (post.site && !POST_SITES.includes(post.site)) errors.push(`unknown site ${post.site}`)
  const langs = post.site === 'global' ? ['en'] : post.site ? ['de'] : ['en', 'de']
  for (const lang of ['en', 'de'] as const) {
    if (langs.includes(lang) && !post[lang]) errors.push(`needs a ${lang === 'en' ? 'English' : 'German'} version`)
    if (!langs.includes(lang) && post[lang]) errors.push(`must not have ${lang === 'en' ? 'an English' : 'a German'} version`)
  }
  for (const lang of ['en', 'de'] as const) {
    const t = post[lang]
    if (!t) continue
    const at = (msg: string) => errors.push(`${lang}: ${msg}`)
    if (!SLUG_RE.test(t.slug) || t.slug.length > 80) at(`slug ${t.slug} must be lower-case ascii words joined by hyphens, at most 80 characters`)
    if (existing.some((p) => p[lang]?.slug === t.slug)) at(`slug ${t.slug} is taken`)
    if (!t.title.trim() || t.title.length > 90) at('title must be 1 to 90 characters')
    if (t.description.length < 80 || t.description.length > 170) at(`description has ${t.description.length} characters, needs 80 to 170`)
    const n = words(t.body)
    if (n < 700 || n > 1800) at(`body has ${n} words, needs 700 to 1800`)
    if (/^# /m.test(t.body)) at('body must not contain a level-1 heading (the title is one)')
    for (const [, href] of t.body.matchAll(/\]\(([^)]*)\)/g)) if (!linkTarget(href, fieldIds)) at(`link target ${href} is not field:<id>, start or an https url`)
    for (const s of [t.title, t.description, t.body]) for (const p of dashProblems(s)) at(p)
    const spelling = lang === 'en' ? null : !post.site || post.site === 'ch' ? swissProblems : germanProblems
    if (spelling) for (const s of [t.title, t.description, t.body]) for (const p of spelling(s)) at(p)
  }
  return [...new Set(errors)]
}
