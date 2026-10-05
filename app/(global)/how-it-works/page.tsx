import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { HowView } from '../../views/longform.tsx'

export const revalidate = 3600

const t = dict('en')

export const metadata: Metadata = { title: t.meta.how, description: t.meta.howDesc, alternates: { canonical: '/how-it-works' } }

export default function HowItWorks() {
  return <HowView site="global" base="" />
}
