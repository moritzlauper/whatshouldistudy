import { pageMeta } from '@/lib/site/meta.ts'
import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { HowView } from '../../views/longform.tsx'

export const revalidate = 3600

const t = dict('en')

export const metadata: Metadata = pageMeta('global', (r) => r.how, { title: t.meta.how, description: t.meta.howDesc })

export default function HowItWorks() {
  return <HowView site="global" base="" />
}
