import { pageMeta } from '@/lib/site/meta.ts'
import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { TermsView } from '../../views/longform.tsx'

export const metadata: Metadata = pageMeta('global', (r) => r.terms, { title: dict('en').meta.terms })

export default function Terms() {
  return <TermsView site="global" base="" />
}
