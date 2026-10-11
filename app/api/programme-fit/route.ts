import { NextResponse } from 'next/server'
import { bearer, paymentMode, verifyToken } from '@/lib/server/token.ts'
import { MAX_PROGRAMMES, compareProgrammes } from '@/lib/server/programme-fit.ts'
import type { FitRequest } from '@/lib/server/programme-fit.ts'
import type { Locale } from '@/lib/site/config.ts'

const LOCALES: Locale[] = ['en', 'de-CH', 'de-DE', 'de-AT', 'fr-CH', 'it-CH']

/** Part of the paid report: an AI comparison of a few programmes with the person's profile. */
export async function POST(req: Request) {
  if (paymentMode() !== 'off' && !verifyToken(bearer(req))) return NextResponse.json({ error: 'Unlock required.' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as Partial<FitRequest> | null
  const programmes = Array.isArray(body?.programmes)
    ? body!.programmes
        .filter((x) => x && typeof x.id === 'string' && typeof x.field === 'string' && typeof x.country === 'string')
        .slice(0, MAX_PROGRAMMES)
        .map((x) => ({ id: x.id.slice(0, 40), field: x.field.slice(0, 60), country: x.country.slice(0, 3) }))
    : []
  if (!programmes.length) return NextResponse.json({ error: 'Pick at least one programme.' }, { status: 400 })
  const locale = (LOCALES as string[]).includes(body?.locale ?? '') ? (body!.locale as Locale) : 'en'
  const p = body?.profile ?? {}
  const list = (xs: unknown) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 60)).slice(0, 12) : undefined)
  const nums = (xs: unknown) => (Array.isArray(xs) ? xs.slice(0, 6).map((x) => Math.max(-3, Math.min(3, Number(x) || 0))) : [])
  const profile = {
    riasec: p.riasec && typeof p.riasec.code === 'string' ? { code: p.riasec.code.slice(0, 6), profile: nums(p.riasec.profile) } : undefined,
    big5: p.big5 && typeof p.big5 === 'object' ? Object.fromEntries(Object.entries(p.big5).slice(0, 5).map(([k, v]) => [k.slice(0, 1), Math.max(-3, Math.min(3, Number(v) || 0))])) : undefined,
    subjects: list(p.subjects),
    values: list(p.values),
    fields: list(p.fields),
  }
  const result = await compareProgrammes({ programmes, profile, locale })
  if (!result) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  return NextResponse.json({ items: result }, { headers: { 'Cache-Control': 'private, no-store' } })
}
