import { NextResponse } from 'next/server'
import { getOrg } from '@/lib/server/org.ts'
import { returnTo } from '@/lib/server/origin.ts'
import { stripe } from '@/lib/server/stripe.ts'
import { paymentMode, verifyOrg } from '@/lib/server/token.ts'

/** Opens Stripe's customer portal for the organisation behind an admin link: invoices, payment method, plan, cancelling. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { admin?: string } | null
  const subscription = verifyOrg(body?.admin, 'admin')
  if (!subscription) return NextResponse.json({ error: 'Invalid link.' }, { status: 400 })
  if (paymentMode() !== 'stripe') return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 })
  const org = await getOrg(subscription)
  if (!org) return NextResponse.json({ error: 'Unknown subscription.' }, { status: 404 })
  const { r, abs } = returnTo(req)
  const session = await stripe<{ url: string }>('POST', 'billing_portal/sessions', { customer: org.customer, return_url: `${abs(r.orgWelcome)}?admin=${encodeURIComponent(body!.admin!)}` })
  return NextResponse.json({ url: session.url })
}
