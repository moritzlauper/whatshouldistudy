import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { fromStripeAmount } from '@/lib/pricing.ts'
import type { Price } from '@/lib/pricing.ts'
import { paymentMode, signToken, verifyToken } from '@/lib/server/token.ts'

/**
 * SHA-256 of the buyer's address, normalised as Google asks for enhanced
 * conversions (trimmed, lower case, no dots before @gmail.com). The address
 * itself never leaves Stripe's answer; the page sends the hash to Google Ads
 * only while ad data use is allowed (see lib/measure.ts).
 */
function emailHash(email: string | null | undefined): string | undefined {
  const e = (email ?? '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return undefined
  const domain = e.slice(at + 1)
  const user = domain === 'gmail.com' || domain === 'googlemail.com' ? e.slice(0, at).replace(/\./g, '') : e.slice(0, at)
  return createHash('sha256').update(`${user}@${domain}`).digest('hex')
}

/** Exchanges a paid Checkout session for an unlock token, plus what the page needs to count the sale. */
export async function GET(req: Request) {
  const sid = new URL(req.url).searchParams.get('session_id') ?? ''
  const mode = paymentMode()
  if (mode === 'off') return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 })

  let sale: { price?: Price; emailHash?: string } = {}
  if (mode === 'stripe') {
    if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return NextResponse.json({ error: 'Invalid session.' }, { status: 400 })
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      cache: 'no-store',
    })
    const s = (await res.json()) as { payment_status?: string; amount_total?: number; currency?: string; customer_details?: { email?: string | null } }
    if (!res.ok || s.payment_status !== 'paid') return NextResponse.json({ error: 'Payment not completed.' }, { status: 402 })
    sale = {
      price: typeof s.amount_total === 'number' && s.currency ? fromStripeAmount(s.amount_total, s.currency) : undefined,
      emailHash: emailHash(s.customer_details?.email),
    }
  }
  const signed = signToken(mode === 'stripe' ? sid : 'free')
  if (!signed) return NextResponse.json({ error: 'WSIS_TOKEN_SECRET is not set.' }, { status: 500 })
  return NextResponse.json({ ...signed, ...sale }, { headers: { 'Cache-Control': 'no-store' } })
}

/** Checks a token from a shared link; nothing is stored. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string } | null
  return NextResponse.json({ ok: !!verifyToken(body?.token) }, { headers: { 'Cache-Control': 'no-store' } })
}
