import type { Metadata } from 'next'
import { findPost, postsFor, showsOn } from '@/lib/blog.ts'
import { blogPosts } from '@/lib/server/blog.ts'
import { blogMeta } from '@/lib/site/meta.ts'
import { PostView } from '../../../views/blog.tsx'

// Posts published on the blog branch after the build are rendered on their first request; a new one shows within the hour.
export const revalidate = 3600

export function generateStaticParams() {
  return postsFor('global', 'en').map((p) => ({ slug: p.en!.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = findPost('global', 'en', (await params).slug, await blogPosts())
  if (!post?.en) return {}
  return blogMeta('global', (lang, site) => (showsOn(post, site, lang) ? (r) => r.post(post[lang]!.slug) : null), { title: post.en.title, description: post.en.description })
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  return <PostView site="global" base="" slug={(await params).slug} />
}
