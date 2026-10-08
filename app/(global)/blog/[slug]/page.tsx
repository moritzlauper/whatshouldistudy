import type { Metadata } from 'next'
import { allPosts, findPost } from '@/lib/blog.ts'
import { blogMeta } from '@/lib/site/meta.ts'
import { PostView } from '../../../views/blog.tsx'

export const dynamicParams = false

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.en.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = findPost('en', (await params).slug)
  if (!post) return {}
  return blogMeta('global', (lang) => (r) => r.post(post[lang].slug), { title: post.en.title, description: post.en.description })
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  return <PostView site="global" base="" slug={(await params).slug} />
}
