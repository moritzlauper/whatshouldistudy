import { pageMeta } from '@/lib/site/meta.ts'
import type { Metadata } from 'next'
import { orgsText } from '@/lib/site/orgs-text.ts'
import { OrgsView } from '../../views/orgs.tsx'

export const revalidate = 3600

const o = orgsText('en')

export const metadata: Metadata = pageMeta('global', (r) => r.orgs, { title: o.title, description: o.metaDesc('1,000') })

export default function Organisations() {
  return <OrgsView site="global" base="" />
}
