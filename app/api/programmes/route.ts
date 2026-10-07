import { countUsage } from '@/lib/server/usage.ts'
import { programmeCounters } from '@/lib/usage-stats.ts'
import { after, NextResponse } from 'next/server'
import { rank, sanitizeRequest } from '@/lib/server/rank.ts'
import { bearer, paymentMode, verifyToken } from '@/lib/server/token.ts'

/** The paid part: every matching programme, ranked, filtered and paged. Open to all while payments are off. */
export async function POST(req: Request) {
  if (paymentMode() !== 'off' && !verifyToken(bearer(req))) return NextResponse.json({ error: 'Unlock required.' }, { status: 401 })
  const body = sanitizeRequest(await req.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Send at least one field.' }, { status: 400 })
  const result = await rank(body)
  // Bulk CSV requests are exports, not recommendation-list views.
  const counters = (body.pageSize ?? 40) <= 100 ? programmeCounters(result.items, 'unlocked') : []
  after(() => countUsage(counters))
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
}
