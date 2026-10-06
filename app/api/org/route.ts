import { NextResponse } from 'next/server'
import { ORG_REPORTS, fromStripeAmount } from '@/lib/pricing.ts'
import type { Price } from '@/lib/pricing.ts'
import { getOrg, usedThisMonth } from '@/lib/server/org.ts'
import { stripe } from '@/lib/server/stripe.ts'
import { paymentMode, signOrg, verifyOrg } from '@/lib/server/token.ts'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * An organisation's dashboard: plan, reports used this month and both links.
 * With ?session_id= right after Checkout, afterwards with ?admin= (the admin
 * link the dashboard keeps in its address).
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const sid = url.searchParams.get('session_id')
  const mode = paymentMode()
  if (mode === 'off') return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 })

  // Development without Stripe: a pretend subscription.
  if (mode === 'free') {
    return NextResponse.json({ student: signOrg('sub_free', 'student'), admin: signOrg('sub_free', 'admin'), tier: 'school', interval: 'year', limit: ORG_REPORTS.school, used: 0, active: true }, { headers: noStore })
  }

  let subscription: string | null
  let sale: { price?: Price } = {}
  if (sid) {
    if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return NextResponse.json({ error: 'Invalid session.' }, { status: 400 })
    const s = await stripe<{ status: string; subscription: string | null; amount_total: number | null; currency: string | null }>('GET', `checkout/sessions/${sid}`)
    if (s.status !== 'complete' || !s.subscription) return NextResponse.json({ error: 'Subscription not completed.' }, { status: 402 })
    subscription = s.subscription
    if (s.amount_total !== null && s.currency) sale = { price: fromStripeAmount(s.amount_total, s.currency) }
  } else {
    subscription = verifyOrg(url.searchParams.get('admin'), 'admin')
    if (!subscription) return NextResponse.json({ error: 'Invalid link.' }, { status: 400 })
  }

  const org = await getOrg(subscription)
  if (!org) return NextResponse.json({ error: 'Unknown subscription.' }, { status: 404 })
  const used = await usedThisMonth(org.customer).catch(() => null)
  return NextResponse.json({ student: signOrg(org.subscription, 'student'), admin: signOrg(org.subscription, 'admin'), tier: org.tier, interval: org.interval, limit: org.limit, used, active: org.active, ...sale }, { headers: noStore })
}
