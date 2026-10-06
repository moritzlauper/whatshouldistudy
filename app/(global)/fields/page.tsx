import { pageMeta } from '@/lib/site/meta.ts'
import type { Metadata } from 'next'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { dict } from '@/lib/site/dict.ts'
import { FieldsView } from '../../views/fields.tsx'

export const revalidate = 86400

const t = dict('en')

export const metadata: Metadata = pageMeta('global', (r) => r.fields, { title: t.meta.fields, description: t.meta.fieldsDesc(FIELDS.length) })

export default function Fields() {
  return <FieldsView site="global" base="" />
}
