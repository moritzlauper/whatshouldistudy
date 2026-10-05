import type { Metadata } from 'next'
import { siteUrl } from '@/lib/site.ts'
import { dict } from '@/lib/site/dict.ts'
import { ImprintView } from '../../views/longform.tsx'

export const metadata: Metadata = { title: dict('en').meta.imprint, alternates: { canonical: siteUrl('global', '/imprint') } }

export default function Imprint() {
  return <ImprintView site="global" base="" />
}
