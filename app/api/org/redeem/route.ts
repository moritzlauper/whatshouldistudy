import { NextResponse } from 'next/server'
import { getOrg, recordUse, usedThisPeriod } from '@/lib/server/org.ts'
import { paymentMode, signToken, verifyOrg } from '@/lib/server/token.ts'

/**
 * A student unlocks the full report through their organisation's link. Counts
 * one report against the plan and returns a normal unlock token.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { org?: string; student?: string } | null
  const subscription = verifyOrg(body?.org, 'student')
  const student = /^[A-Za-z0-9_-]{8,40}$/.test(body?.student ?? '') ? body!.student! : null
  if (!subscription || !student) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const mode = paymentMode()
  if (mode === 'off') return NextResponse.json({ error: 'off' }, { status: 503 })
  if (mode === 'stripe') {
    const org = await getOrg(subscription)
    if (!org || !org.active) return NextResponse.json({ error: 'inactive' }, { status: 402 })
    if (org.limit !== null && (await usedThisPeriod(org)) >= org.limit) return NextResponse.json({ error: 'limit' }, { status: 429 })
    await recordUse(org, student)
  }
  const signed = signToken(`org:${subscription}`)
  if (!signed) return NextResponse.json({ error: 'WSIS_TOKEN_SECRET is not set.' }, { status: 500 })
  return NextResponse.json(signed, { headers: { 'Cache-Control': 'no-store' } })
}
