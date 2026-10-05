import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Unlock tokens: a signed payload, no database. The token proves a paid
 * Stripe Checkout session; it is stored in the buyer's browser and sent with
 * every request for programme lists.
 */

export interface TokenPayload {
  v: 1
  /** Stripe Checkout session id (or "dev"). */
  sid: string
  exp: number
}

const VALIDITY_DAYS = 365

function secret(): string | null {
  if (process.env.WSIS_TOKEN_SECRET) return process.env.WSIS_TOKEN_SECRET
  // Without real payments a forged token gains nothing, so a fixed key is fine.
  // With Stripe, a missing secret is a configuration error (see /api/checkout).
  return process.env.STRIPE_SECRET_KEY ? null : 'unpaid-mode-key'
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url')

export function signToken(sid: string): { token: string; expiresAt: number } | null {
  const key = secret()
  if (!key) return null
  const payload: TokenPayload = { v: 1, sid, exp: Date.now() + VALIDITY_DAYS * 864e5 }
  const body = b64(JSON.stringify(payload))
  const sig = createHmac('sha256', key).update(body).digest('base64url')
  return { token: `${body}.${sig}`, expiresAt: payload.exp }
}

export function verifyToken(token: string | null | undefined): TokenPayload | null {
  const key = secret()
  if (!key || !token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', key).update(body).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenPayload
    return p.v === 1 && p.exp > Date.now() ? p : null
  } catch {
    return null
  }
}

export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

export const PRICE = {
  cents: Number(process.env.WSIS_PRICE_CENTS ?? 900),
  currency: (process.env.WSIS_CURRENCY ?? 'eur').toLowerCase(),
}

/** Payments are optional in development; in production they need Stripe, or an explicit free mode. */
export function paymentMode(): 'stripe' | 'free' | 'off' {
  if (process.env.STRIPE_SECRET_KEY) return 'stripe'
  if (process.env.WSIS_FREE_UNLOCK === '1' || process.env.NODE_ENV !== 'production') return 'free'
  return 'off'
}
