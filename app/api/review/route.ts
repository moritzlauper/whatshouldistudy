import { NextResponse } from 'next/server'
import { REVIEW_PUBLIC, reviewAllowed, reviewStream } from '@/lib/server/review.ts'

export const maxDuration = 300

/** Review of a whole result with Claude (see lib/server/review.ts). */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Not configured.' }, { status: 503 })
  if (!reviewAllowed(req.headers.get('x-review-key'))) {
    // No count per visitor: the only ceiling is the daily dollar budget in lib/server/ai-budget.ts.
    if (!REVIEW_PUBLIC) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }
  const text = await req.text()
  if (text.length > 600_000) return NextResponse.json({ error: 'Too large.' }, { status: 413 })
  let input: unknown
  try {
    input = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  return new Response(reviewStream(input, req.signal), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no' },
  })
}
