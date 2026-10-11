import 'server-only'
import { REPORT_LOOKUP_KEY, stripeAmount } from '../pricing.ts'
import type { Price } from '../pricing.ts'

/** Minimal Stripe REST client: form-encoded requests with the secret key, no SDK. */

export type Params = Record<string, string | number | boolean | undefined>

export class StripeError extends Error {
  readonly status: number
  readonly code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function stripe<T>(method: 'GET' | 'POST', path: string, params: Params = {}): Promise<T> {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.append(k, String(v))
  const query = method === 'GET' && [...body].length ? `?${body}` : ''
  const res = await fetch(`https://api.stripe.com/v1/${path}${query}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? body : undefined,
    cache: 'no-store',
  })
  const j = (await res.json()) as T & { error?: { message?: string; code?: string } }
  if (!res.ok) throw new StripeError(j.error?.message ?? `Stripe ${res.status}`, res.status, j.error?.code)
  return j
}

const priceIds = new Map<string, { id: string | null; at: number }>()

/** Id of the active price with this lookup key (see scripts/stripe-setup.ts), or null if there is none. Cached for ten minutes. */
export async function priceId(lookupKey: string): Promise<string | null> {
  const hit = priceIds.get(lookupKey)
  if (hit && Date.now() - hit.at < 600_000) return hit.id
  const found = await stripe<{ data: { id: string }[] }>('GET', 'prices', { 'lookup_keys[]': lookupKey, active: true })
  const id = found.data[0]?.id ?? null
  priceIds.set(lookupKey, { id, at: Date.now() })
  return id
}

/** Reuse a report price only when Stripe will charge the amount advertised. */
export async function reportPriceId(price: Price): Promise<string | null> {
  const id = process.env.STRIPE_PRICE_ID || await priceId(REPORT_LOOKUP_KEY)
  if (!id) return null
  const stored = await stripe<{
    active: boolean
    currency: string
    unit_amount: number | null
    recurring: unknown
    currency_options?: Record<string, { unit_amount: number | null }>
  }>('GET', `prices/${encodeURIComponent(id)}`, { 'expand[]': 'currency_options' })
  const currency = price.currency.toLowerCase()
  const amount = stored.currency === currency ? stored.unit_amount : stored.currency_options?.[currency]?.unit_amount
  return stored.active && !stored.recurring && amount === stripeAmount(price) ? id : null
}
