import type { Metadata } from 'next'
import { chUrl } from '@/lib/site.ts'
import { dict } from '@/lib/site/dict.ts'
import { chBase } from '@/lib/site/kit.ts'
import { PrivacyView } from '../../../views/longform.tsx'

export const metadata: Metadata = { title: dict('de').meta.privacy, alternates: { canonical: chUrl('/datenschutz') } }

export default async function Datenschutz({ params }: { params: Promise<{ mount: string }> }) {
  const { mount } = await params
  return <PrivacyView site="ch" base={chBase(mount)} />
}
