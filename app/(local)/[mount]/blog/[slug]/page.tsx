import type { Metadata } from 'next'
import { allPosts, findPost } from '@/lib/blog.ts'
import { mountInfo } from '@/lib/site/kit.ts'
import { blogMeta } from '@/lib/site/meta.ts'
import { regionalize } from '@/lib/site/regional.ts'
import { PostView } from '../../../../views/blog.tsx'

type Params = { params: Promise<{ mount: string; slug: string }> }

export const dynamicParams = false

// French and Italian have no blog: their mounts get the same addresses, and PostView answers 404.
export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.de.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { mount, slug } = await params
  const { site, locale } = mountInfo(mount)
  const post = findPost('de', slug)
  if (!post) return {}
  return blogMeta(site, (lang) => (r) => r.post(post[lang].slug), { title: regionalize(post.de.title, locale), description: regionalize(post.de.description, locale) }, locale)
}

export default async function Page({ params }: Params) {
  const { mount, slug } = await params
  return <PostView {...mountInfo(mount)} slug={slug} />
}
