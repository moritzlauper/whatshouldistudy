import { siteUrl } from '@/lib/site.ts'
import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { PrivacyView } from '../../views/longform.tsx'

export const metadata: Metadata = { title: dict('en').meta.privacy, alternates: { canonical: siteUrl('global', '/privacy') } }

export default function Privacy() {
  return <PrivacyView site="global" base="" />
}
