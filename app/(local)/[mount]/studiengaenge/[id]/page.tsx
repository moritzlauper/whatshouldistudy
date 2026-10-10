import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { SITES } from '@/lib/site/config.ts'
import { localMount } from '@/lib/site/local-mount.ts'
import { catalogueMeta } from '@/lib/site/meta.ts'
import { FIELD_ID_BY_SLUG_DE, fieldSlugDe } from '@/lib/site/slugs-de.ts'
import { CountryFieldView, countryFieldText } from '../../../../views/catalogue.tsx'

export const revalidate = 86400

/** The segment holds the German address (informatik), not the field id. */
type Params = { params: Promise<{ mount: string; id: string }> }

export function generateStaticParams() {
  return FIELDS.map((f) => ({ id: fieldSlugDe(f.id) }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { mount, id: slug } = await params
  const id = FIELD_ID_BY_SLUG_DE[slug]
  const { site, locale } = localMount(mount)
  const cc = SITES[site].country!
  const text = id && (await countryFieldText(cc, id, locale))
  if (!text) return {}
  return catalogueMeta(site, cc, (r) => r.countryField(cc, id), text, locale)
}

export default async function StudiengaengeFach({ params }: Params) {
  const { mount, id: slug } = await params
  const id = FIELD_ID_BY_SLUG_DE[slug]
  if (!id) notFound()
  const info = localMount(mount)
  return <CountryFieldView {...info} country={SITES[info.site].country!} id={id} />
}
