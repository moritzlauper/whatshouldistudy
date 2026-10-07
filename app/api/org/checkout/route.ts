import { NextResponse } from 'next/server'
import { ORG_TIERS, TRIAL_DAYS, TRIAL_TIER, orgLookupKey, orgPrice, priceFor } from '@/lib/pricing.ts'
import type { Interval, OrgTier } from '@/lib/pricing.ts'
import { returnTo } from '@/lib/server/origin.ts'
import { priceId } from '@/lib/server/stripe.ts'
import { paymentMode, visitorCountry } from '@/lib/server/token.ts'
import { SITES, isLocal } from '@/lib/site/config.ts'

/** Starts a subscription for an organisation: tier and interval from the query, currency from the visitor's country. */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const tier = url.searchParams.get('tier') as OrgTier
  const interval = url.searchParams.get('interval') === 'month' ? 'month' : ('year' as Interval)
  if (!ORG_TIERS.includes(tier)) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 })
  const { site, r, abs } = returnTo(req)
  const welcome = abs(r.orgWelcome)

  const mode = paymentMode()
  if (mode === 'off') return NextResponse.json({ error: 'Payments are not configured on this deployment.' }, { status: 503 })
  if (mode === 'free') return NextResponse.json({ url: `${welcome}?session_id=free` })
  if (!process.env.WSIS_TOKEN_SECRET) return NextResponse.json({ error: 'WSIS_TOKEN_SECRET is not set.' }, { status: 503 })

  const price = await priceId(orgLookupKey(tier, interval)).catch(() => null)
  if (!price) return NextResponse.json({ error: 'This plan is not set up in Stripe yet.' }, { status: 503 })
  const currency = orgPrice(tier, interval, priceFor(visitorCountry(req), SITES[site].currency).currency).currency

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      mode: 'subscription',
      success_url: `${welcome}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: abs(r.orgs),
      currency: currency.toLowerCase(),
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      allow_promotion_codes: 'true',
      billing_address_collection: 'required',
      'tax_id_collection[enabled]': 'true',
      locale: isLocal(site) ? 'de' : 'auto',
      'metadata[site]': site,
      'subscription_data[metadata][site]': site,
      'subscription_data[metadata][tier]': tier,
      // The pilot; Checkout still takes a card, the first invoice follows the trial.
      ...(tier === TRIAL_TIER ? { 'subscription_data[trial_period_days]': String(TRIAL_DAYS) } : {}),
    }),
  })
  const session = (await res.json()) as { url?: string; error?: { message?: string } }
  if (!res.ok || !session.url) return NextResponse.json({ error: session.error?.message ?? 'Could not start checkout.' }, { status: 502 })
  return NextResponse.json({ url: session.url })
}
