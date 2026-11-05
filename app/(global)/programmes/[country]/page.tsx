import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CATALOGUE_COUNTRIES, countryBySlug, countrySlug } from '@/lib/catalogue.ts'
import { catalogueMeta } from '@/lib/site/meta.ts'
import { CountryView, countryText } from '../../../views/catalogue.tsx'

// The programme data changes once a week (wsis-daten, Mondays); a daily re-render for every crawler visit cost most of the server time.
export const revalidate = 604800

type Params = { params: Promise<{ country: string }> }

export function generateStaticParams() {
  return CATALOGUE_COUNTRIES.map((cc) => ({ country: countrySlug(cc) }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const cc = countryBySlug((await params).country)
  const text = cc && (await countryText(cc, 'en'))
  if (!cc || !text) return {}
  return catalogueMeta('global', cc, (r) => r.country(cc), text)
}

export default async function CountryPage({ params }: Params) {
  const cc = countryBySlug((await params).country)
  if (!cc) notFound()
  return <CountryView site="global" base="" country={cc} />
}
