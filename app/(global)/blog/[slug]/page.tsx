import type { Metadata } from 'next'
import { findPost, postsFor, showsOn } from '@/lib/blog.ts'
import { blogMeta } from '@/lib/site/meta.ts'
import { PostView } from '../../../views/blog.tsx'

export const dynamicParams = false

export function generateStaticParams() {
  return postsFor('global', 'en').map((p) => ({ slug: p.en!.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = findPost('global', 'en', (await params).slug)
  if (!post?.en) return {}
  return blogMeta('global', (lang, site) => (showsOn(post, site, lang) ? (r) => r.post(post[lang]!.slug) : null), { title: post.en.title, description: post.en.description })
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  return <PostView site="global" base="" slug={(await params).slug} />
}
