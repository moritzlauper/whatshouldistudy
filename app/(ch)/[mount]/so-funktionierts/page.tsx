import type { Metadata } from 'next'
import { chUrl } from '@/lib/site.ts'
import { dict } from '@/lib/site/dict.ts'
import { chBase } from '@/lib/site/kit.ts'
import { HowView } from '../../../views/longform.tsx'

export const revalidate = 3600

const t = dict('de')

export const metadata: Metadata = { title: t.meta.how, description: t.meta.howDesc, alternates: { canonical: chUrl('/so-funktionierts') } }

export default async function SoFunktionierts({ params }: { params: Promise<{ mount: string }> }) {
  const { mount } = await params
  return <HowView site="ch" base={chBase(mount)} />
}
