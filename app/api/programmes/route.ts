import { NextResponse } from 'next/server'
import { rank, sanitizeRequest } from '@/lib/server/rank.ts'
import { bearer, paymentMode, verifyToken } from '@/lib/server/token.ts'

/** The paid part: every matching programme, ranked, filtered and paged. Open to all while payments are off. */
export async function POST(req: Request) {
  if (paymentMode() !== 'off' && !verifyToken(bearer(req))) return NextResponse.json({ error: 'Unlock required.' }, { status: 401 })
  const body = sanitizeRequest(await req.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Send at least one field.' }, { status: 400 })
  return NextResponse.json(await rank(body), { headers: { 'Cache-Control': 'private, no-store' } })
}
