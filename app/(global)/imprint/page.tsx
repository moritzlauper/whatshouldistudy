import type { Metadata } from 'next'
import { pageMeta } from '@/lib/site/meta.ts'
import { dict } from '@/lib/site/dict.ts'
import { ImprintView } from '../../views/longform.tsx'

export const metadata: Metadata = pageMeta('global', (r) => r.imprint, { title: dict('en').meta.imprint })

export default function Imprint() {
  return <ImprintView site="global" base="" />
}
