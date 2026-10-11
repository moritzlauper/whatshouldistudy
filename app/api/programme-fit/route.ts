import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { bearer, paymentMode, verifyToken } from '@/lib/server/token.ts'
import { redis } from '@/lib/server/usage.ts'
import { MAX_PROGRAMMES, compareProgrammes } from '@/lib/server/programme-fit.ts'
import type { FitRequest } from '@/lib/server/programme-fit.ts'
import type { Locale } from '@/lib/site/config.ts'

const LOCALES: Locale[] = ['en', 'de-CH', 'de-DE', 'de-AT', 'fr-CH', 'it-CH']

export const maxDuration = 60

/**
 * Cost guard per purchase, above what the page itself asks for: the top five
 * take four requests, each «Aktualisieren» four more (at most 5 a day, 20 in
 * all), each opened programme one.
 */
const PER_DAY = 40
const IN_ALL = 150
const COUNT = `
local day = redis.call('INCR', KEYS[1])
if day == 1 then redis.call('EXPIRE', KEYS[1], 86400) end
local all = redis.call('INCR', KEYS[2])
if all == 1 then redis.call('EXPIRE', KEYS[2], 31622400) end
return {day, all}
`

/** True when this purchase has used up its AI requests. Without the counter store, nothing is limited. */
async function overLimit(sid: string): Promise<boolean> {
  const h = createHash('sha256').update(sid).digest('hex').slice(0, 32)
  try {
    const [day, all] = (await redis(['EVAL', COUNT, 2, `wsis:fit:day:${h}`, `wsis:fit:all:${h}`])) as [number, number]
    return Number(day) > PER_DAY || Number(all) > IN_ALL
  } catch {
    return false
  }
}

/** Part of the paid report: an AI comparison of a few programmes with the person's profile. */
export async function POST(req: Request) {
  const paid = verifyToken(bearer(req))
  if (paymentMode() !== 'off' && !paid) return NextResponse.json({ error: 'Unlock required.' }, { status: 401 })
  if (paid && (await overLimit(paid.sid))) return NextResponse.json({ error: 'limit' }, { status: 429 })
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
