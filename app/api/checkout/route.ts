import { NextResponse } from 'next/server'
import { priceFor, stripeAmount } from '@/lib/pricing.ts'
import { CH_NAME } from '@/lib/site/config.ts'
import { paymentMode, visitorCountry } from '@/lib/server/token.ts'

/**
 * Starts a Stripe Checkout session in the visitor's currency (or, without
 * Stripe, unlocks directly). With STRIPE_PRICE_ID the Stripe Price is used;
 * it needs a currency option for every currency in lib/pricing.ts. Without it
 * the amount comes from lib/pricing.ts and nothing has to be set up in Stripe.
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const site = url.searchParams.get('site') === 'ch' ? 'ch' : 'global'
  // Only the two places the Swiss site lives; anything else would be an open redirect.
  const back = site === 'ch' && url.searchParams.get('back') === '/schweiz' ? '/schweiz' : ''
  const origin = url.origin
  const unlocked = site === 'ch' ? `${origin}${back}/freigeschaltet` : `${origin}/unlocked`
  const cancel = site === 'ch' ? `${origin}${back}/resultat#studiengaenge` : `${origin}/results#programmes`

  const mode = paymentMode()
  if (mode === 'off') return NextResponse.json({ error: 'Payments are not configured on this deployment.' }, { status: 503 })
  if (mode === 'free') return NextResponse.json({ url: `${unlocked}?session_id=free` })
  // Never take money we couldn't turn into an unlock.
  if (!process.env.WSIS_TOKEN_SECRET) return NextResponse.json({ error: 'WSIS_TOKEN_SECRET is not set.' }, { status: 503 })

  const price = priceFor(visitorCountry(req), site === 'ch' ? 'CHF' : 'USD')
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${unlocked}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancel,
    allow_promotion_codes: 'true',
    locale: site === 'ch' ? 'de' : 'auto',
    'line_items[0][quantity]': '1',
    'metadata[site]': site,
  })
  if (process.env.STRIPE_PRICE_ID) {
    form.set('line_items[0][price]', process.env.STRIPE_PRICE_ID)
    form.set('currency', price.currency.toLowerCase())
  } else {
    form.set('line_items[0][price_data][currency]', price.currency.toLowerCase())
    form.set('line_items[0][price_data][unit_amount]', String(stripeAmount(price)))
    form.set('line_items[0][price_data][product_data][name]', site === 'ch' ? `${CH_NAME}: voller Studiengang-Report` : 'whatshouldistudy: full programme report')
    form.set(
      'line_items[0][price_data][product_data][description]',
      site === 'ch'
        ? 'Alle passenden Studiengänge mit Gebühren, Zulassung und Filtern. 12 Monate gültig.'
        : 'All matching study programmes worldwide, with fees, earnings and filters. Valid for 12 months.',
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
