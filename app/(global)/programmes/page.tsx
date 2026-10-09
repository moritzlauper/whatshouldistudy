import type { Metadata } from 'next'
import { CATALOGUE_COUNTRIES } from '@/lib/catalogue.ts'
import { getMeta } from '@/lib/server/data.ts'
import { catalogueText } from '@/lib/site/catalogue-text.ts'
import { fmtNumber } from '@/lib/site/labels.ts'
import { catalogueMeta } from '@/lib/site/meta.ts'
import { CatalogueIndexView, countryTotals } from '../../views/catalogue.tsx'

export const revalidate = 86400

const ct = catalogueText('en')

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = await getMeta()
  const countries = CATALOGUE_COUNTRIES.map((cc) => countryTotals(meta, cc)).filter((c) => !!c)
  const total = countries.reduce((s, c) => s + c.programmes, 0)
  // The country sites' catalogue pages are about one country each, not equivalents of this one.
  return catalogueMeta('global', '', (r) => r.programmes, { title: ct.indexMetaTitle, description: ct.indexMetaDesc(fmtNumber(total, 'en'), countries.length) })
}

export default function ProgrammesPage() {
  return <CatalogueIndexView site="global" base="" />
}
