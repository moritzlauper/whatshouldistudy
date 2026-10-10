import type { Metadata } from 'next'
import { localMount } from '@/lib/site/local-mount.ts'
import { blogMeta } from '@/lib/site/meta.ts'
import { blogText } from '@/lib/site/blog-text.ts'
import { BlogView } from '../../../views/blog.tsx'

export async function generateMetadata({ params }: { params: Promise<{ mount: string }> }): Promise<Metadata> {
  const { site, locale } = localMount((await params).mount)
  const b = blogText(locale)
  return blogMeta(site, () => (r) => r.blog, { title: b?.metaTitle, description: b?.metaDesc }, locale)
}

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <BlogView {...localMount((await params).mount)} />
}
