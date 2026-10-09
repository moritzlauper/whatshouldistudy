import 'server-only'

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

let couponReady: Promise<void> | null = null

/** Creates the percentage coupon once if it does not exist yet; a coupon applies to every currency. */
export function ensureCoupon(id: string, percentOff: number, name: string): Promise<void> {
  couponReady ??= stripe('GET', `coupons/${encodeURIComponent(id)}`)
    .catch(async (e) => {
      if (!(e instanceof StripeError) || e.status !== 404) throw e
      await stripe('POST', 'coupons', { id, percent_off: percentOff, duration: 'once', name })
    })
    .then(() => {}, (e) => {
      couponReady = null
      throw e
    })
  return couponReady
}
