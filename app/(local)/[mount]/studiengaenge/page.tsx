import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SITES } from '@/lib/site/config.ts'
import { mountInfo } from '@/lib/site/kit.ts'
import { catalogueMeta } from '@/lib/site/meta.ts'
import { CountryView, countryText } from '../../../views/catalogue.tsx'

export const revalidate = 86400

type Params = { params: Promise<{ mount: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { site, locale } = mountInfo((await params).mount)
  const cc = SITES[site].country!
  const text = await countryText(cc, locale)
  if (!text) return {}
  return catalogueMeta(site, cc, (r) => r.country(cc), text, locale)
}

export default async function Studiengaenge({ params }: Params) {
  const info = mountInfo((await params).mount)
  const cc = SITES[info.site].country
  if (!cc) notFound()
  return <CountryView {...info} country={cc} />
}
