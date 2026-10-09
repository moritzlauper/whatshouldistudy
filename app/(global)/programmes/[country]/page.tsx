import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CATALOGUE_COUNTRIES, countryBySlug, countrySlug } from '@/lib/catalogue.ts'
import { catalogueMeta } from '@/lib/site/meta.ts'
import { CountryView, countryText } from '../../../views/catalogue.tsx'

export const revalidate = 86400

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
