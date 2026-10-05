import { NextResponse } from 'next/server'
import { priceFor, stripeAmount } from '@/lib/pricing.ts'
import { paymentMode, visitorCountry } from '@/lib/server/token.ts'
import { LOCAL_SITES, SITES, isLocal, routes } from '@/lib/site/config.ts'
import type { SiteId } from '@/lib/site/config.ts'
import { BASE_PATH, SITE_URL } from '@/lib/site.ts'

/**
 * Starts a Stripe Checkout session in the visitor's currency (or, without
 * Stripe, unlocks directly). With STRIPE_PRICE_ID the Stripe Price is used;
 * it needs a currency option for every currency in lib/pricing.ts. Without it
 * the amount comes from lib/pricing.ts and nothing has to be set up in Stripe.
 */

const origin = (u: string) => {
  try {
    return u ? new URL(u).origin : ''
  } catch {
    return ''
  }
}

/** Where buyers may be sent back to: our own domains. Anything else would be an open redirect. */
function returnOrigin(req: Request, claimed: string | null): string {
  const own = new URL(req.url).origin
  const allowed = new Set([own, origin(SITE_URL), ...LOCAL_SITES.map((s) => origin(SITES[s].domainUrl)), ...(process.env.WSIS_ALLOWED_ORIGINS ?? '').split(',').map((o) => origin(o.trim()))])
  allowed.delete('')
  // Behind angebunden's rewrite the request arrives at this deployment's own address; the page tells us where the buyer is.
  return claimed && allowed.has(claimed) ? claimed : own
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const asked = url.searchParams.get('site') as SiteId | null
  const site: SiteId = asked && asked in SITES ? asked : 'global'
  const conf = SITES[site]
  // The site's pages live at its mount on the global domain, or at the root of its own domain.
  const back = isLocal(site) && url.searchParams.get('back') === `/${conf.mount}` ? `/${conf.mount}` : ''
  const r = routes(site, back)
  const base = `${returnOrigin(req, url.searchParams.get('o'))}${BASE_PATH}`
  const unlocked = `${base}${r.unlocked}`
  const cancel = `${base}${r.results}#${r.anchors.programmes}`

  const mode = paymentMode()
  if (mode === 'off') return NextResponse.json({ error: 'Payments are not configured on this deployment.' }, { status: 503 })
  if (mode === 'free') return NextResponse.json({ url: `${unlocked}?session_id=free` })
  // Never take money we couldn't turn into an unlock.
  if (!process.env.WSIS_TOKEN_SECRET) return NextResponse.json({ error: 'WSIS_TOKEN_SECRET is not set.' }, { status: 503 })

  const price = priceFor(visitorCountry(req), conf.currency)
  const local = isLocal(site)
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${unlocked}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancel,
    allow_promotion_codes: 'true',
    locale: local ? 'de' : 'auto',
    'line_items[0][quantity]': '1',
    'metadata[site]': site,
  })
  if (process.env.STRIPE_PRICE_ID) {
    form.set('line_items[0][price]', process.env.STRIPE_PRICE_ID)
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
