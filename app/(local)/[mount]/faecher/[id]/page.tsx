import type { Metadata } from 'next'
import { FIELDS, FIELD_BY_ID } from '@/lib/taxonomy/fields.ts'
import { mountInfo } from '@/lib/site/kit.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { SITES } from '@/lib/site/config.ts'
import { fieldBlurb, fieldName } from '@/lib/site/labels.ts'
import { FieldView } from '../../../../views/field.tsx'

export const revalidate = 86400

type Params = { params: Promise<{ mount: string; id: string }> }

export function generateStaticParams() {
  return FIELDS.map((f) => ({ id: f.id }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { mount, id } = await params
  if (!FIELD_BY_ID[id]) return {}
  const locale = SITES[mountInfo(mount).site].locale
  const name = fieldName(id, locale)
  return localMeta(params, `/faecher/${id}`, (t) => ({ title: t.fields.metaTitle(name), description: t.meta.fieldDesc(name, fieldBlurb(id, locale)) }))
}

export default async function Fach({ params }: Params) {
  const { mount, id } = await params
  return <FieldView {...mountInfo(mount)} id={id} />
}
