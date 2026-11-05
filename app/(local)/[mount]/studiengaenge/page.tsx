import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SITES } from '@/lib/site/config.ts'
import { localMount } from '@/lib/site/local-mount.ts'
import { catalogueMeta } from '@/lib/site/meta.ts'
import { CountryView, countryText } from '../../../views/catalogue.tsx'

// The programme data changes once a week (wsis-daten, Mondays); a daily re-render for every crawler visit cost most of the server time.
export const revalidate = 604800

type Params = { params: Promise<{ mount: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { site, locale } = localMount((await params).mount)
  const cc = SITES[site].country!
  const text = await countryText(cc, locale)
  if (!text) return {}
  return catalogueMeta(site, cc, (r) => r.country(cc), text, locale)
}

export default async function Studiengaenge({ params }: Params) {
  const info = localMount((await params).mount)
  const cc = SITES[info.site].country
  if (!cc) notFound()
  return <CountryView {...info} country={cc} />
}
