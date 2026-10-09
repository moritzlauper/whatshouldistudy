import { NextResponse } from 'next/server'
import { CATALOGUE_COUNTRIES, LEVEL_ORDER, LINK_ONLY } from '@/lib/catalogue.ts'
import { searchCatalogue } from '@/lib/server/catalogue.ts'
import { FIELD_BY_ID } from '@/lib/taxonomy/fields.ts'
import type { Level } from '@/lib/programmes.ts'
import type { Locale } from '@/lib/site/config.ts'

const LOCALES: Locale[] = ['en', 'de-CH', 'de-DE', 'de-AT', 'fr-CH', 'it-CH']

/**
 * Free: search one country's programme catalogue (name, institution, place,
 * level, fields, languages, links). Fees, earnings and the ranking for a
 * person stay in the paid /api/programmes.
 */
export async function GET(req: Request) {
  const s = new URL(req.url).searchParams
  const country = s.get('country') ?? ''
  if (!CATALOGUE_COUNTRIES.includes(country) || LINK_ONLY[country]) return NextResponse.json({ error: 'Unknown country.' }, { status: 400 })
  const field = s.get('field') ?? undefined
  const level = s.get('level') ?? undefined
  const locale = s.get('locale') ?? 'en'
  const result = await searchCatalogue({
    country,
    q: (s.get('q') ?? '').slice(0, 100),
    field: field && FIELD_BY_ID[field] ? field : undefined,
    level: level && LEVEL_ORDER.includes(level as Level) ? (level as Level) : undefined,
    locale: LOCALES.includes(locale as Locale) ? (locale as Locale) : 'en',
    page: Math.min(Math.max(Number(s.get('page')) || 0, 0), 400),
  })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}
