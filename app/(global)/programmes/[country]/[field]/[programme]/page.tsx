import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { countryBySlug, indexesProgrammes } from '@/lib/catalogue.ts'
import { catalogueMeta } from '@/lib/site/meta.ts'
import { ProgrammeView, programmeText } from '../../../../../views/programme.tsx'

// The programme data changes once a week (wsis-daten, Mondays); a daily re-render for every crawler visit cost most of the server time.
export const revalidate = 604800

type Params = { params: Promise<{ country: string; field: string; programme: string }> }

// Some 195,000 pages: each is rendered on its first request, then cached. Only CH and AT are indexed (indexesProgrammes).
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { country, field, programme } = await params
  const cc = countryBySlug(country)
  const text = cc && (await programmeText(cc, field, programme, 'en'))
  if (!cc || !text) return {}
  return catalogueMeta('global', cc, (r) => r.programme(cc, field, programme), { ...text, index: indexesProgrammes(cc) })
}

export default async function ProgrammePage({ params }: Params) {
  const { country, field, programme } = await params
  const cc = countryBySlug(country)
  if (!cc) notFound()
  return <ProgrammeView site="global" base="" country={cc} field={field} slug={programme} />
}
