import { NextResponse } from 'next/server'
import { sanitizeRequest, teaser } from '@/lib/server/rank.ts'

/** Free: matching counts and fields. Programme records require unlock. */
export async function POST(req: Request) {
  const body = sanitizeRequest(await req.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Send at least one field.' }, { status: 400 })
  const result = await teaser(body)
  return NextResponse.json(result)
}
