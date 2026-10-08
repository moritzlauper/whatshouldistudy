import type { Metadata } from 'next'
import { allPosts, findPost, showsOn } from '@/lib/blog.ts'
import { mountInfo } from '@/lib/site/kit.ts'
import { blogMeta } from '@/lib/site/meta.ts'
import { regionalize } from '@/lib/site/regional.ts'
import { PostView } from '../../../../views/blog.tsx'

type Params = { params: Promise<{ mount: string; slug: string }> }

export const dynamicParams = false

// Every German post on every mount: PostView answers 404 where a post doesn't belong (another country, French, Italian).
export function generateStaticParams() {
  return allPosts().flatMap((p) => (p.de ? [{ slug: p.de.slug }] : []))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { mount, slug } = await params
  const { site, locale } = mountInfo(mount)
  const post = findPost(site, 'de', slug)
  if (!post?.de) return {}
  // Country posts are written in their country's German already.
  const rz = (s: string) => (post.site ? s : regionalize(s, locale))
  return blogMeta(site, (lang, s) => (showsOn(post, s, lang) ? (r) => r.post(post[lang]!.slug) : null), { title: rz(post.de.title), description: rz(post.de.description) }, locale)
}

export default async function Page({ params }: Params) {
  const { mount, slug } = await params
  return <PostView {...mountInfo(mount)} slug={slug} />
}
