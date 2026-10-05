import { NextResponse } from 'next/server'
import { PRICE, paymentMode } from '@/lib/server/token.ts'

/** Starts a Stripe Checkout session (or, without Stripe in development, unlocks directly). */
export async function POST(req: Request) {
  const origin = new URL(req.url).origin
  const mode = paymentMode()
  if (mode === 'off') return NextResponse.json({ error: 'Payments are not configured on this deployment.' }, { status: 503 })
  if (mode === 'free') return NextResponse.json({ url: `${origin}/unlocked?session_id=free` })
  // Never take money we couldn't turn into an unlock.
  if (!process.env.WSIS_TOKEN_SECRET) return NextResponse.json({ error: 'WSIS_TOKEN_SECRET is not set.' }, { status: 503 })

  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${origin}/unlocked?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/results#programmes`,
    allow_promotion_codes: 'true',
    'line_items[0][quantity]': '1',
  })
  if (process.env.STRIPE_PRICE_ID) form.set('line_items[0][price]', process.env.STRIPE_PRICE_ID)
  else {
    form.set('line_items[0][price_data][currency]', PRICE.currency)
    form.set('line_items[0][price_data][unit_amount]', String(PRICE.cents))
    form.set('line_items[0][price_data][product_data][name]', 'whatshouldistudy: full programme report')
    form.set('line_items[0][price_data][product_data][description]', 'All matching study programmes worldwide, with fees, earnings and filters. Valid for 12 months.')
  }
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const session = (await res.json()) as { url?: string; error?: { message?: string } }
  if (!res.ok || !session.url) return NextResponse.json({ error: session.error?.message ?? 'Could not start checkout.' }, { status: 502 })
  return NextResponse.json({ url: session.url })
}
