import { NextResponse } from 'next/server'
import { reviewAllowed, reviewResult } from '@/lib/server/review.ts'

export const maxDuration = 300

/** Owner-only review of a whole result with Claude (see lib/server/review.ts). */
export async function POST(req: Request) {
  if (!reviewAllowed(req.headers.get('x-review-key'))) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const text = await req.text()
  if (text.length > 600_000) return NextResponse.json({ error: 'Too large.' }, { status: 413 })
  let input: unknown
  try {
    input = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  try {
    const review = await reviewResult(input)
    return NextResponse.json({ review }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) {
    console.error(`review: ${(e as Error).message}`)
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
