import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { countryBySlug } from '@/lib/catalogue.ts'
import { catalogueMeta } from '@/lib/site/meta.ts'
import { CountryFieldView, countryFieldText } from '../../../../views/catalogue.tsx'

export const revalidate = 86400

type Params = { params: Promise<{ country: string; field: string }> }

// Several hundred pages, each reading a large programme shard: rendered on first request, then cached.
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { country, field } = await params
  const cc = countryBySlug(country)
  const text = cc && (await countryFieldText(cc, field, 'en'))
  if (!cc || !text) return {}
  return catalogueMeta('global', cc, (r) => r.countryField(cc, field), text)
}

export default async function CountryFieldPage({ params }: Params) {
  const { country, field } = await params
  const cc = countryBySlug(country)
  if (!cc) notFound()
  return <CountryFieldView site="global" base="" country={cc} id={field} />
}
