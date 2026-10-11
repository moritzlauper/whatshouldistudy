import { NextResponse } from 'next/server'
import { bearer, paymentMode, verifyToken } from '@/lib/server/token.ts'
import { PURCHASE_BUDGET_MICRO_USD, purchaseAdd, purchaseSpent } from '@/lib/server/ai-budget.ts'
import { improveStream } from '@/lib/server/improve.ts'
import type { ImproveInput } from '@/lib/server/improve.ts'

export const maxDuration = 300

/** Part of the paid report: Claude names the terms in a person's data that are no real interest in a field (lib/server/improve.ts). */
export async function POST(req: Request) {
  const paid = verifyToken(bearer(req))
  if (paymentMode() !== 'off' && !paid) return NextResponse.json({ error: 'Unlock required.' }, { status: 401 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  if (paid && (await purchaseSpent(paid.sid)) >= PURCHASE_BUDGET_MICRO_USD) return NextResponse.json({ error: 'budget' }, { status: 429 })
  const body = (await req.json().catch(() => null)) as Partial<ImproveInput> | null
  const str = (x: unknown, n: number) => (typeof x === 'string' ? x.slice(0, n) : '')
  const fields = Array.isArray(body?.fields)
    ? body!.fields.slice(0, 10).map((f) => ({
        field: str(f?.field, 60),
        name: str(f?.name, 80),
        terms: Array.isArray(f?.terms)
          ? f.terms.slice(0, 30).map((t) => ({ term: str(t?.term, 60), n: Math.max(0, Math.min(1e6, Number(t?.n) || 0)), ...(t?.ex ? { ex: str(t.ex, 120) } : {}) })).filter((t) => t.term)
          : [],
      })).filter((f) => f.field && f.terms.length)
    : []
  if (!fields.length) return NextResponse.json({ error: 'Nothing to check.' }, { status: 400 })
  const stream = improveStream({ fields }, req.signal, paid ? (micro) => purchaseAdd(paid.sid, micro) : undefined)
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no' } })
}
