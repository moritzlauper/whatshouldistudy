import Link from 'next/link'
import { notFound } from 'next/navigation'
import { blogLang, findPost, postsFor } from '@/lib/blog.ts'
import type { Post } from '@/lib/blog.ts'
import { kit } from '@/lib/site/kit.ts'
import { blogText } from '@/lib/site/blog-text.ts'
import { regionalize } from '@/lib/site/regional.ts'
import type { Locale, SiteId, SiteProps } from '@/lib/site/config.ts'
import { SITES } from '@/lib/site/config.ts'
import { pageUrl } from '@/lib/site/meta.ts'
import { emoji, fieldName } from '@/lib/site/labels.ts'
import { siteUrl } from '@/lib/site.ts'
import { JsonLd } from '../ui/json-ld.tsx'
import { Markdown } from '../ui/markdown.tsx'
import { Sparkle } from '../ui/shapes.tsx'

const fmtDate = (date: string, intl: string) => new Intl.DateTimeFormat(intl, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

/**
 * The post in the site's language. A post for every site is in Swiss German and
 * adapted for Germany and Austria; a country post is in its country's German.
 */
function localText(post: Post, locale: Locale) {
  const lang = blogLang(locale)
  const t = lang && post[lang]
  if (!t) return null
  const rz = (s: string) => (post.site ? s : regionalize(s, locale))
  return { ...t, title: rz(t.title), description: rz(t.description), rz }
}

export function BlogView({ site, base, locale: selectedLocale }: SiteProps) {
  const { r, locale, intl } = kit(site, base, selectedLocale)
  const b = blogText(locale)
  if (!b) notFound()
  const lang = blogLang(locale)
  const posts = lang ? postsFor(site, lang) : []
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <div className="relative">
        <Sparkle className="float-slow absolute -right-2 -top-4 hidden sm:block" size={56} color="var(--sky)" />
        <h1 className="font-display text-5xl sm:text-6xl">{b.title}</h1>
        <p className="mt-5 text-xl text-muted">{b.lead}</p>
      </div>
      {posts.length === 0 && <p className="mt-10 text-muted">{b.empty}</p>}
      <div className="mt-10 grid gap-5">
        {posts.map((post) => {
          const p = localText(post, locale)!
          return (
            <Link key={p.slug} href={r.post(p.slug)} className="card-sm card-pop block p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{fmtDate(post.date, intl)}</p>
              <h2 className="mt-2 font-display text-2xl leading-tight">{p.title}</h2>
              <p className="mt-2 text-muted">{p.description}</p>
              <p className="mt-3 text-sm font-bold text-accent">{b.read} →</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** Structured data for search engines: the article and where it sits. */
function postLd(site: SiteId, locale: Locale, post: Post, title: string, description: string) {
  const lang = blogLang(locale)!
  const url = pageUrl(site, (r) => r.post(post[lang]!.slug), locale)
  return {
    '@type': 'BlogPosting',
    headline: title,
    description,
    datePublished: post.date,
    inLanguage: SITES[site].intl,
    url,
    mainEntityOfPage: url,
    publisher: { '@id': `${siteUrl('global')}#organization` },
    citation: post.sources.map((s) => s.url),
  }
}

export function PostView({ site, base, locale: selectedLocale, slug }: SiteProps & { slug: string }) {
  const { r, locale, intl } = kit(site, base, selectedLocale)
  const b = blogText(locale)
  const lang = blogLang(locale)
  const post = lang ? findPost(site, lang, slug) : undefined
  const p = post && localText(post, locale)
  if (!b || !post || !p) notFound()
  return (
    <article className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <JsonLd data={postLd(site, locale, post, p.title, p.description)} />
      <Link href={r.blog} className="text-sm font-bold text-accent underline-offset-2 hover:underline">
        ← {b.back}
      </Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-wider text-muted">{b.published(fmtDate(post.date, intl))}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">{p.title}</h1>
      <p className="mt-5 text-xl text-muted">{p.description}</p>
      <div className="prose-wsis mt-4">
        <Markdown source={p.body} r={r} text={p.rz} />
      </div>
      {post.fields.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl">{b.fields}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {post.fields.map((id) => (
              <Link key={id} href={r.field(id)} className="chip">
                <span aria-hidden="true">{emoji(id)}</span> {fieldName(id, locale)}
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="card mt-12 p-6 sm:p-8">
        <h2 className="font-display text-3xl">{b.ctaTitle}</h2>
        <p className="mt-3 text-muted">{b.ctaText}</p>
        <Link href={r.start} className="btn btn-primary mt-5">
          {b.ctaButton}
        </Link>
      </section>
      <section className="mt-12 text-sm">
        <h2 className="font-display text-xl">{b.sources}</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
          {post.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-ink">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-muted">{b.aiNote}</p>
      </section>
    </article>
  )
}
