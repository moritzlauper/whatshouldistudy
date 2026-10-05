import type { Metadata } from 'next'
import { chUrl } from '@/lib/site.ts'
import { dict } from '@/lib/site/dict.ts'
import { chBase } from '@/lib/site/kit.ts'
import { TermsView } from '../../../views/longform.tsx'

export const metadata: Metadata = { title: dict('de').meta.terms, alternates: { canonical: chUrl('/agb') } }

export default async function Agb({ params }: { params: Promise<{ mount: string }> }) {
  const { mount } = await params
  return <TermsView site="ch" base={chBase(mount)} />
}
