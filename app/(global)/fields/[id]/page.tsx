import { siteUrl } from '@/lib/site.ts'
import type { Metadata } from 'next'
import { FIELDS, FIELD_BY_ID } from '@/lib/taxonomy/fields.ts'
import { dict } from '@/lib/site/dict.ts'
import { FieldView } from '../../../views/field.tsx'

export const revalidate = 86400

const t = dict('en')

export function generateStaticParams() {
  return FIELDS.map((f) => ({ id: f.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const f = FIELD_BY_ID[id]
  if (!f) return {}
  return { title: t.fields.metaTitle(f.name), description: t.meta.fieldDesc(f.name, f.blurb), alternates: { canonical: siteUrl('global', `/fields/${id}`) } }
}

export default async function FieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FieldView site="global" base="" id={id} />
}
