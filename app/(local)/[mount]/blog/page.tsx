import type { Metadata } from 'next'
import { mountInfo } from '@/lib/site/kit.ts'
import { blogMeta } from '@/lib/site/meta.ts'
import { blogText } from '@/lib/site/blog-text.ts'
import { BlogView } from '../../../views/blog.tsx'

export async function generateMetadata({ params }: { params: Promise<{ mount: string }> }): Promise<Metadata> {
  const { site, locale } = mountInfo((await params).mount)
  const b = blogText(locale)
  return blogMeta(site, () => (r) => r.blog, { title: b?.metaTitle, description: b?.metaDesc }, locale)
}

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <BlogView {...mountInfo((await params).mount)} />
}
