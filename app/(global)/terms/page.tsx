import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { TermsView } from '../../views/longform.tsx'

export const metadata: Metadata = { title: dict('en').meta.terms, alternates: { canonical: '/terms' } }

export default function Terms() {
  return <TermsView site="global" base="" />
}
