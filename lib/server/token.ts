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

/** Visitor's country from Vercel's edge (absent locally). */
export function visitorCountry(req: Request): string | null {
  return req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry')
}

/** Payments are optional in development; in production they need Stripe, or an explicit free mode. */
export function paymentMode(): 'stripe' | 'free' | 'off' {
  if (process.env.STRIPE_SECRET_KEY) return 'stripe'
  if (process.env.WSIS_FREE_UNLOCK === '1' || process.env.NODE_ENV !== 'production') return 'free'
  return 'off'
}

/**
 * An organisation's links: the Stripe subscription id, signed. They never
 * expire by themselves; whether the subscription is still active is asked from
 * Stripe each time. Two kinds under separate prefixes: the student link only
 * unlocks reports, the admin link opens the dashboard and Stripe's customer
 * portal. Neither can pass as an unlock token or the other way round.
 */
export type OrgLink = 'student' | 'admin'

export function signOrg(subscription: string, kind: OrgLink): string | null {
  const key = secret()
  if (!key) return null
  const body = b64(subscription)
  return `${body}.${createHmac('sha256', key).update(`org-${kind}:${body}`).digest('base64url')}`
}

export function verifyOrg(token: string | null | undefined, kind: OrgLink): string | null {
  const key = secret()
  if (!key || !token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', key).update(`org-${kind}:${body}`).digest()
  const given = Buffer.from(sig, 'base64url')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const sub = Buffer.from(body, 'base64url').toString()
  return /^sub_[A-Za-z0-9]+$/.test(sub) ? sub : null
}
