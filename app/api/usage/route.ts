import { timingSafeEqual } from 'node:crypto'
import { after, NextResponse } from 'next/server'
import { eventCounter, parseUsage, sourceCounter, validMonth } from '@/lib/usage-stats.ts'
import { countUsage, readUsage, usageConfigured } from '@/lib/server/usage.ts'

const headers = { 'Cache-Control': 'private, no-store' }

/** Only source categories and shown results. No body, IP, referrer or user-agent is retained. */
export async function POST(req: Request) {
  if (!usageConfigured()) return new Response(null, { status: 204, headers })
  if (req.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403, headers })
  if (!req.headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 415, headers })
  // Bound actual bytes, including chunked requests without Content-Length.
  const reader = req.body?.getReader()
  if (!reader) return new Response(null, { status: 400, headers })
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 128) {
      await reader.cancel()
      return new Response(null, { status: 413, headers })
    }
    chunks.push(value)
  }
  let body
  try { body = parseUsage(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { body = null }
  if (!body) return new Response(null, { status: 400, headers })
  const counter = 'event' in body ? eventCounter(body.event) : sourceCounter(body.source)
  after(() => countUsage([counter]))
  return new Response(null, { status: 204, headers })
}

/** Owner-only monthly report; never exposes paid programme output publicly. */
export async function GET(req: Request) {
  const secret = process.env.USAGE_ADMIN_TOKEN
  const have = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret ?? ''}`)
  if (!secret || have.length !== want.length || !timingSafeEqual(have, want)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  }
  if (!usageConfigured()) return NextResponse.json({ error: 'Usage storage not configured' }, { status: 503, headers })
  const month = new URL(req.url).searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  if (!validMonth(month)) return NextResponse.json({ error: 'Use YYYY-MM' }, { status: 400, headers })
  try {
    return NextResponse.json({ month, rows: await readUsage(month) }, { headers })
  } catch {
    return NextResponse.json({ error: 'Usage storage unavailable' }, { status: 503, headers })
  }
}
