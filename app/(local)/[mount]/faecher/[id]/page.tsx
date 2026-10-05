import type { Metadata } from 'next'
import { FIELDS, FIELD_BY_ID } from '@/lib/taxonomy/fields.ts'
import { chUrl } from '@/lib/site.ts'
import { dict } from '@/lib/site/dict.ts'
import { chBase } from '@/lib/site/kit.ts'
import { fieldBlurb, fieldName } from '@/lib/site/labels.ts'
import { FieldView } from '../../../../views/field.tsx'

export const revalidate = 86400

const t = dict('de')

export function generateStaticParams() {
  return FIELDS.map((f) => ({ id: f.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  if (!FIELD_BY_ID[id]) return {}
  const name = fieldName(id, 'de')
  return { title: t.fields.metaTitle(name), description: t.meta.fieldDesc(name, fieldBlurb(id, 'de')), alternates: { canonical: chUrl(`/faecher/${id}`) } }
}

export default async function Fach({ params }: { params: Promise<{ mount: string; id: string }> }) {
  const { mount, id } = await params
  return <FieldView site="ch" base={chBase(mount)} id={id} />
}
