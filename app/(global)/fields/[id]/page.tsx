import { pageMeta } from '@/lib/site/meta.ts'
import type { Metadata } from 'next'
import { FIELDS, FIELD_BY_ID } from '@/lib/taxonomy/fields.ts'
import { dict } from '@/lib/site/dict.ts'
import { FieldView } from '../../../views/field.tsx'

// The programme data changes once a week (wsis-daten, Mondays); a daily re-render for every crawler visit cost most of the server time.
export const revalidate = 604800

const t = dict('en')

export function generateStaticParams() {
  return FIELDS.map((f) => ({ id: f.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const f = FIELD_BY_ID[id]
  if (!f) return {}
  return pageMeta('global', (r) => r.field(id), { title: t.fields.metaTitle(f.name), description: t.meta.fieldDesc(f.name, f.blurb) })
}

export default async function FieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FieldView site="global" base="" id={id} />
}
