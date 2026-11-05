import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { countryBySlug } from '@/lib/catalogue.ts'
import { catalogueMeta } from '@/lib/site/meta.ts'
import { ProgrammeView, programmeText } from '../../../../../views/programme.tsx'

// The programme data changes once a week (wsis-daten, Mondays); a daily re-render for every crawler visit cost most of the server time.
export const revalidate = 604800

type Params = { params: Promise<{ country: string; field: string; programme: string }> }

// Some 175,000 pages: each is rendered on its first request, then cached.
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { country, field, programme } = await params
  const cc = countryBySlug(country)
  const text = cc && (await programmeText(cc, field, programme, 'en'))
  if (!cc || !text) return {}
  return catalogueMeta('global', cc, (r) => r.programme(cc, field, programme), text)
}

export default async function ProgrammePage({ params }: Params) {
  const { country, field, programme } = await params
  const cc = countryBySlug(country)
  if (!cc) notFound()
  return <ProgrammeView site="global" base="" country={cc} field={field} slug={programme} />
}
