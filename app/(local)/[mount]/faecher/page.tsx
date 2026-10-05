import type { Metadata } from 'next'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { chUrl } from '@/lib/site.ts'
import { dict } from '@/lib/site/dict.ts'
import { chBase } from '@/lib/site/kit.ts'
import { FieldsView } from '../../../views/fields.tsx'

export const revalidate = 86400

const t = dict('de')

export const metadata: Metadata = { title: t.meta.fields, description: t.meta.fieldsDesc(FIELDS.length), alternates: { canonical: chUrl('/faecher') } }

export default async function Faecher({ params }: { params: Promise<{ mount: string }> }) {
  const { mount } = await params
  return <FieldsView site="ch" base={chBase(mount)} />
}
