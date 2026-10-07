import { countUsage } from '@/lib/server/usage.ts'
import { programmeCounters } from '@/lib/usage-stats.ts'
import { after, NextResponse } from 'next/server'
import { sanitizeRequest, teaser } from '@/lib/server/rank.ts'

/** Free: how many programmes match, where, plus three examples. */
export async function POST(req: Request) {
  const body = sanitizeRequest(await req.json().catch(() => null))
  if (!body) return NextResponse.json({ error: 'Send at least one field.' }, { status: 400 })
  const result = await teaser(body)
  const counters = programmeCounters(result.samples, 'preview')
  after(() => countUsage(counters))
  return NextResponse.json(result)
}
