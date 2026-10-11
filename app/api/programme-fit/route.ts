import { NextResponse } from 'next/server'
import { bearer, paymentMode, verifyToken } from '@/lib/server/token.ts'
import { PURCHASE_BUDGET_MICRO_USD, purchaseAdd, purchaseSpent } from '@/lib/server/ai-budget.ts'
import { MAX_PROGRAMMES, programmeFacts } from '@/lib/server/programme-fit.ts'
import type { FactsRequest } from '@/lib/server/programme-fit.ts'
import type { Locale } from '@/lib/site/config.ts'

const LOCALES: Locale[] = ['en', 'de-CH', 'de-DE', 'de-AT', 'fr-CH', 'it-CH']

export const maxDuration = 60

/** Part of the paid report: what Claude reads about a few programmes. No profile is sent. */
export async function POST(req: Request) {
  const paid = verifyToken(bearer(req))
  if (paymentMode() !== 'off' && !paid) return NextResponse.json({ error: 'Unlock required.' }, { status: 401 })
  if (paid && (await purchaseSpent(paid.sid)) >= PURCHASE_BUDGET_MICRO_USD) return NextResponse.json({ error: 'budget' }, { status: 429 })
  const body = (await req.json().catch(() => null)) as Partial<FactsRequest> | null
  const programmes = Array.isArray(body?.programmes)
    ? body!.programmes
        .filter((x) => x && typeof x.id === 'string' && typeof x.field === 'string' && typeof x.country === 'string')
        .slice(0, MAX_PROGRAMMES)
        .map((x) => ({ id: x.id.slice(0, 40), field: x.field.slice(0, 60), country: x.country.slice(0, 3) }))
    : []
  if (!programmes.length) return NextResponse.json({ error: 'Pick at least one programme.' }, { status: 400 })
  const locale = (LOCALES as string[]).includes(body?.locale ?? '') ? (body!.locale as Locale) : 'en'
  const result = await programmeFacts({ programmes, locale, refresh: body?.refresh === true })
  if (!result) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  if (paid && result.costMicroUsd > 0) await purchaseAdd(paid.sid, result.costMicroUsd)
  return NextResponse.json({ items: result.items }, { headers: { 'Cache-Control': 'private, no-store' } })
}
