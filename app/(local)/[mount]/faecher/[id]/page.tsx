import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { localMount } from '@/lib/site/local-mount.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { fieldBlurb, fieldName } from '@/lib/site/labels.ts'
import { FIELD_ID_BY_SLUG_DE, fieldSlugDe } from '@/lib/site/slugs-de.ts'
import { FieldView } from '../../../../views/field.tsx'

export const revalidate = 86400

/** The segment holds the German address (informatik), not the field id. */
type Params = { params: Promise<{ mount: string; id: string }> }

export function generateStaticParams() {
  return FIELDS.map((f) => ({ id: fieldSlugDe(f.id) }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { mount, id: slug } = await params
  const id = FIELD_ID_BY_SLUG_DE[slug]
  if (!id) return {}
  const locale = localMount(mount).locale
  const name = fieldName(id, locale)
  return localMeta(params, (r) => r.field(id), (t) => ({ title: t.fields.metaTitle(name), description: t.meta.fieldDesc(name, fieldBlurb(id, locale)) }))
}

export default async function Fach({ params }: Params) {
  const { mount, id: slug } = await params
  const id = FIELD_ID_BY_SLUG_DE[slug]
  if (!id) notFound()
  return <FieldView {...localMount(mount)} id={id} />
}
