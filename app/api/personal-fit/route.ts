import { bearer, issuedAt, paymentMode, verifyToken } from '@/lib/server/token.ts'
import { PURCHASE_BUDGET_MICRO_USD, aiAllowed, purchaseAdd, purchaseSpent } from '@/lib/server/ai-budget.ts'
import { MAX_PERSONAL, personalFits, type PersonalRequest } from '@/lib/server/personal-fit.ts'
import { SUBJECT_KEYS } from '@/lib/taxonomy/fields.ts'
import { validatedTopics } from '@/lib/engine/programme-fit.ts'
import type { Locale } from '@/lib/site/config.ts'

/** Reports unlocked up to October 2026 have no budget per report; from November 2026 on, each report has its own budget. */
const BUDGET_FROM = Date.UTC(2026, 10, 1)
const LOCALES: Locale[] = ['en', 'de-CH', 'de-DE', 'de-AT', 'fr-CH', 'it-CH']

export const maxDuration = 60
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

/** The optional step: the person's answers compared with the readings. Paid, and sent only after they agreed in the browser. */
export async function POST(req: Request) {
  const paid = verifyToken(bearer(req))
  if (paymentMode() !== 'off' && !paid) return reply({ error: 'Unlock required.' }, 401)
  const text = await req.text().catch(() => '')
  if (new TextEncoder().encode(text).length > 128_000) return reply({ error: 'too-large' }, 413)
  let body: (Partial<PersonalRequest> & { consent?: unknown }) | null
  try { body = JSON.parse(text) } catch { return reply({ error: 'invalid' }, 400) }
  if (body?.consent !== true) return reply({ error: 'consent-required' }, 400)
  if (paid && issuedAt(paid) >= BUDGET_FROM && (await purchaseSpent(paid.sid)) >= PURCHASE_BUDGET_MICRO_USD) return reply({ error: 'budget' }, 429)
  // The daily limit for everyone: when it is used up, the answer says so.
  if (!(await aiAllowed('fit'))) return reply({ error: 'daily' }, 429)
  const programmes = Array.isArray(body?.programmes)
    ? body!.programmes
        .filter((x) => x && typeof x.id === 'string' && typeof x.field === 'string' && typeof x.country === 'string' && /^[A-Z]{2}$/.test(x.country))
        .slice(0, MAX_PERSONAL)
        .map((x) => ({
          id: x.id.slice(0, 40),
          field: x.field.slice(0, 60),
          country: x.country,
          computed: typeof x.computed === 'number' && Number.isFinite(x.computed) ? Math.max(0, Math.min(100, Math.round(x.computed))) : undefined,
        }))
    : []
  const riasec = body?.profile?.riasec
  if (!programmes.length || !Array.isArray(riasec) || riasec.length !== 6 || riasec.some((x) => typeof x !== 'number' || !Number.isFinite(x))) {
    return reply({ error: 'Send the programmes and the profile.' }, 400)
  }
  const subjects = Array.isArray(body?.profile?.subjects)
    ? body!.profile!.subjects.filter((s): s is string => typeof s === 'string' && (SUBJECT_KEYS as readonly string[]).includes(s)).slice(0, 30)
    : []
  // The person's topics: lexicon keys with weights 0..1, at most forty; anything else is dropped.
  const given = body?.profile?.topics
  const topics = validatedTopics(given)
  const locale = (LOCALES as string[]).includes(body?.locale ?? '') ? (body!.locale as Locale) : 'en'
  const result = await personalFits({ programmes, profile: { riasec: riasec.map((x) => Math.max(0, Math.min(1, x))), subjects, topics }, locale })
  if (!result) return reply({ error: 'unavailable' }, 503)
  if (paid && result.costMicroUsd > 0) await purchaseAdd(paid.sid, result.costMicroUsd)
  if (!result.fits.length) return reply({ error: 'unavailable' }, 503)
  return reply({ fits: result.fits })
}
