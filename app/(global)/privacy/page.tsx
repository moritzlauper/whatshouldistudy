import { pageMeta } from '@/lib/site/meta.ts'
import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { PrivacyView } from '../../views/longform.tsx'

export const metadata: Metadata = pageMeta('global', (r) => r.privacy, { title: dict('en').meta.privacy })

export default function Privacy() {
  return <PrivacyView site="global" base="" />
}
