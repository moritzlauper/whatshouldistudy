import type { Metadata } from 'next'
import { blogMeta } from '@/lib/site/meta.ts'
import { blogText } from '@/lib/site/blog-text.ts'
import { BlogView } from '../../views/blog.tsx'

const b = blogText('en')!

export const metadata: Metadata = blogMeta('global', () => (r) => r.blog, { title: b.metaTitle, description: b.metaDesc })

export default function Blog() {
  return <BlogView site="global" base="" />
}
