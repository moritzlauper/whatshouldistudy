import { NextResponse } from 'next/server'
import { priceForSite, stripeAmount } from '@/lib/pricing.ts'
import { returnTo } from '@/lib/server/origin.ts'
import { reportPriceId } from '@/lib/server/stripe.ts'
import { paymentMode, visitorCountry } from '@/lib/server/token.ts'
import { SITES, isLocal } from '@/lib/site/config.ts'

/**
 * Starts a Stripe Checkout session in the site's currency (or, without
 * Stripe, unlocks directly). Uses the Stripe price STRIPE_PRICE_ID, else the
 * one with lookup key «wsis_report» (scripts/stripe-setup.ts); both need a
 * matching amount for the selected currency. Otherwise the amount comes
 * from lib/pricing.ts. No discount or promotion code applies.
 */
export async function POST(req: Request) {
  const { site, r, abs } = returnTo(req)
  const conf = SITES[site]
  const unlocked = abs(r.unlocked)
  const fromLanding = new URL(req.url).searchParams.get('from') === 'landing'
  const cancel = abs(fromLanding ? `${r.home}#pricing` : `${r.results}#${r.anchors.programmes}`)

  const mode = paymentMode()
  if (mode === 'off') return NextResponse.json({ error: 'Payments are not configured on this deployment.' }, { status: 503 })
  if (mode === 'free') return NextResponse.json({ url: `${unlocked}?session_id=free` })
  // Never take money we couldn't turn into an unlock.
  if (!process.env.WSIS_TOKEN_SECRET) return NextResponse.json({ error: 'WSIS_TOKEN_SECRET is not set.' }, { status: 503 })

  const price = priceForSite(site, visitorCountry(req))
  const local = isLocal(site)
  const requestedLocale = new URL(req.url).searchParams.get('locale')
  const locale = site === 'ch' && ['fr-CH', 'it-CH'].includes(requestedLocale ?? '') ? requestedLocale! : conf.locale
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${unlocked}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancel,
    locale: local ? locale.split('-')[0] : 'auto',
    'line_items[0][quantity]': '1',
    'metadata[site]': site,
    'metadata[product]': 'wsis_report',
    'metadata[locale]': locale,
  })
  const stripePrice = await reportPriceId(price).catch(() => null)
  if (stripePrice) {
    form.set('line_items[0][price]', stripePrice)
    form.set('currency', price.currency.toLowerCase())
  } else {
    form.set('line_items[0][price_data][currency]', price.currency.toLowerCase())
    form.set('line_items[0][price_data][unit_amount]', String(stripeAmount(price)))
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
