import { NextResponse } from 'next/server'
import { bearer, paymentMode, verifyToken } from '@/lib/server/token.ts'
import { countryFacts } from '@/lib/server/facts-db.ts'
import { factsForLocale } from '@/lib/facts-store.ts'
import { FACTS_COUNTRIES, type ProgrammeFacts } from '@/lib/engine/programme-fit.ts'
import type { Locale } from '@/lib/site/config.ts'

const LOCALES: Locale[] = ['en', 'de-CH', 'de-DE', 'de-AT', 'fr-CH', 'it-CH']

/**
 * The paid part: what the AI read on each programme's official page, for the
 * countries asked for. Not public: the readings are part of the paid comparison.
 */
export async function GET(req: Request) {
  if (paymentMode() !== 'off' && !verifyToken(bearer(req))) return NextResponse.json({ error: 'Unlock required.' }, { status: 401 })
  const url = new URL(req.url)
  const locale = (LOCALES as string[]).includes(url.searchParams.get('locale') ?? '') ? (url.searchParams.get('locale') as Locale) : 'en'
  const countries = [...new Set((url.searchParams.get('countries') ?? '').split(','))].filter((c) => (FACTS_COUNTRIES as readonly string[]).includes(c))
  if (!countries.length) return NextResponse.json({ error: 'No readings for these countries.' }, { status: 400 })
  const items: ProgrammeFacts[] = []
  let updated = ''
  for (const country of countries) {
    const facts = await countryFacts(country)
    if (!facts) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
    for (const f of Object.values(facts)) {
      items.push(factsForLocale(f, locale))
      if (f.at > updated) updated = f.at
    }
  }
  return NextResponse.json({ items, updated }, { headers: { 'Cache-Control': 'private, max-age=600' } })
}
