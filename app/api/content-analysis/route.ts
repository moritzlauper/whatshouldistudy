import { bearer, issuedAt, paymentMode, verifyToken } from '@/lib/server/token.ts'
import { PURCHASE_BUDGET_MICRO_USD, aiAllowed, purchaseAdd, purchaseSpent } from '@/lib/server/ai-budget.ts'
import { contentRequest } from '@/lib/engine/content-analysis.ts'
import { analyseContent } from '@/lib/server/content-analysis.ts'

export const maxDuration = 60
const BUDGET_FROM = Date.UTC(2026, 10, 1)
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function POST(req: Request) {
  const paid = verifyToken(bearer(req))
  if (paymentMode() !== 'off' && !paid) return reply({ error: 'locked' }, 401)
  if (paid && issuedAt(paid) >= BUDGET_FROM && await purchaseSpent(paid.sid) >= PURCHASE_BUDGET_MICRO_USD) return reply({ error: 'budget' }, 429)
  if (!(await aiAllowed('fit'))) return reply({ error: 'daily' }, 429)
  const text = await req.text().catch(() => '')
  if (new TextEncoder().encode(text).length > 128_000) return reply({ error: 'too-large' }, 413)
  let body
  try { body = JSON.parse(text) } catch { return reply({ error: 'invalid' }, 400) }
  if (body?.consent !== true || body?.source !== 'takeout') return reply({ error: 'consent-required' }, 400)
  const items = contentRequest(body.items)
  if (!items) return reply({ error: 'invalid' }, 400)
  const locale = ['en', 'de-CH', 'de-DE', 'de-AT', 'fr-CH', 'it-CH'].includes(body.locale) ? body.locale : 'en'
  const result = await analyseContent(items, locale)
  if (paid && result?.costMicroUsd) await purchaseAdd(paid.sid, result.costMicroUsd)
  if (!result?.items.length) return reply({ error: 'unavailable' }, 503)
  return reply({ items: result.items })
}
