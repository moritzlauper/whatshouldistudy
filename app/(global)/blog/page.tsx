import type { Metadata } from 'next'
import { blogMeta } from '@/lib/site/meta.ts'
import { blogText } from '@/lib/site/blog-text.ts'
import { BlogView } from '../../views/blog.tsx'

const b = blogText('en')!

// New posts come from the blog branch at runtime (lib/server/blog.ts).
export const revalidate = 3600

export const metadata: Metadata = blogMeta('global', () => (r) => r.blog, { title: b.metaTitle, description: b.metaDesc })

export default function Blog() {
  return <BlogView site="global" base="" />
}
