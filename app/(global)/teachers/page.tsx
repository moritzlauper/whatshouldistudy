import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site/meta.ts'
import { teachersText } from '@/lib/site/teachers-text.ts'
import { TeachersView } from '../../views/teachers.tsx'

export const revalidate = 3600

const t = teachersText('en')

export const metadata: Metadata = pageMeta('global', (r) => r.teachers, { title: t.metaTitle, description: t.metaDesc })

export default function Teachers() {
  return <TeachersView site="global" base="" />
}
