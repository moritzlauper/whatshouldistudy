import { NextResponse } from 'next/server'
import { REPORT_COUPON, REPORT_DISCOUNT, REPORT_LOOKUP_KEY, priceForSite, stripeAmount } from '@/lib/pricing.ts'
import { returnTo } from '@/lib/server/origin.ts'
import { ensureCoupon, priceId } from '@/lib/server/stripe.ts'
import { paymentMode, visitorCountry } from '@/lib/server/token.ts'
import { SITES, isLocal } from '@/lib/site/config.ts'

/**
 * Starts a Stripe Checkout session in the site's currency (or, without
 * Stripe, unlocks directly). Uses the Stripe price STRIPE_PRICE_ID, else the
 * one with lookup key «wsis_report» (scripts/stripe-setup.ts); both need a
 * currency option for every currency in lib/pricing.ts. Without either the
 * amount comes from lib/pricing.ts and nothing has to be set up in Stripe.
 * REPORT_DISCOUNT is applied as a Stripe coupon (created on first use), so the
 * checkout page shows the regular price and the discount.
 */
export async function POST(req: Request) {
  const { site, r, abs } = returnTo(req)
  const conf = SITES[site]
  const unlocked = abs(r.unlocked)
  const cancel = abs(`${r.results}#${r.anchors.programmes}`)

  const mode = paymentMode()
  if (mode === 'off') return NextResponse.json({ error: 'Payments are not configured on this deployment.' }, { status: 503 })
  if (mode === 'free') return NextResponse.json({ url: `${unlocked}?session_id=free` })
  // Never take money we couldn't turn into an unlock.
  if (!process.env.WSIS_TOKEN_SECRET) return NextResponse.json({ error: 'WSIS_TOKEN_SECRET is not set.' }, { status: 503 })

  const price = priceForSite(site, visitorCountry(req))
  const local = isLocal(site)
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${unlocked}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancel,
    locale: local ? 'de' : 'auto',
    'line_items[0][quantity]': '1',
    'metadata[site]': site,
  })
  if (REPORT_DISCOUNT) {
    // Stripe allows either a discount or promotion codes on one session.
    // The name is shown on Stripe's checkout page in every language.
    const ready = await ensureCoupon(REPORT_COUPON, REPORT_DISCOUNT, `−${REPORT_DISCOUNT}%`).then(() => true, () => false)
    if (!ready) return NextResponse.json({ error: 'Could not start checkout.' }, { status: 502 })
    form.set('discounts[0][coupon]', REPORT_COUPON)
  } else {
    form.set('allow_promotion_codes', 'true')
  }
  const stripePrice = process.env.STRIPE_PRICE_ID || (await priceId(REPORT_LOOKUP_KEY).catch(() => null))
  if (stripePrice) {
    form.set('line_items[0][price]', stripePrice)
    form.set('currency', price.currency.toLowerCase())
  } else {
    form.set('line_items[0][price_data][currency]', price.currency.toLowerCase())
    form.set('line_items[0][price_data][unit_amount]', String(stripeAmount({ currency: price.currency, amount: price.regular ?? price.amount })))
    form.set('line_items[0][price_data][product_data][name]', local ? `${conf.name}: voller Studiengang-Report` : 'whatshouldistudy: full programme report')
    form.set(
      'line_items[0][price_data][product_data][description]',
      local ? 'Alle passenden Studiengänge mit Gebühren, Zulassung und Filtern. 12 Monate gültig.' : 'All matching study programmes worldwide, with fees, earnings and filters. Valid for 12 months.',
    )
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
