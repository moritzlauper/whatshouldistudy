import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SITES } from '@/lib/site/config.ts'
import { localMount } from '@/lib/site/local-mount.ts'
import { catalogueMeta } from '@/lib/site/meta.ts'
import { FIELD_ID_BY_SLUG_DE } from '@/lib/site/slugs-de.ts'
import { ProgrammeView, programmeText } from '../../../../../views/programme.tsx'

export const revalidate = 86400

/** `id` holds the field's German address (informatik), `programme` the programme's slug. */
type Params = { params: Promise<{ mount: string; id: string; programme: string }> }

// Rendered on the first request, then cached.
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { mount, id: slug, programme } = await params
  const field = FIELD_ID_BY_SLUG_DE[slug]
  const { site, locale } = localMount(mount)
  const cc = SITES[site].country!
  const text = field && (await programmeText(cc, field, programme, locale))
  if (!text) return {}
  return catalogueMeta(site, cc, (r) => r.programme(cc, field, programme), text, locale)
}

export default async function StudiengangPage({ params }: Params) {
  const { mount, id: slug, programme } = await params
  const field = FIELD_ID_BY_SLUG_DE[slug]
  if (!field) notFound()
  const info = localMount(mount)
  return <ProgrammeView {...info} country={SITES[info.site].country!} field={field} slug={programme} />
}
