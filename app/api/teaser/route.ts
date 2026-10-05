import { NextResponse } from 'next/server'
import { sanitizeRequest, teaser } from '@/lib/server/rank.ts'

/** Free: how many programmes match, where, plus three examples. */
export async function POST(req: Request) {
  const body = sanitizeRequest(await req.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Send at least one field.' }, { status: 400 })
  return NextResponse.json(await teaser(body))
}
