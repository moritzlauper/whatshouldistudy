import { NextResponse } from 'next/server'
import { paymentMode, signToken, verifyToken } from '@/lib/server/token.ts'

/** Exchanges a paid Checkout session for an unlock token. */
export async function GET(req: Request) {
  const sid = new URL(req.url).searchParams.get('session_id') ?? ''
  const mode = paymentMode()
  if (mode === 'off') return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 })

  if (mode === 'stripe') {
    if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return NextResponse.json({ error: 'Invalid session.' }, { status: 400 })
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      cache: 'no-store',
    })
    const s = (await res.json()) as { payment_status?: string }
    if (!res.ok || s.payment_status !== 'paid') return NextResponse.json({ error: 'Payment not completed.' }, { status: 402 })
  }
  const signed = signToken(mode === 'stripe' ? sid : 'free')
  if (!signed) return NextResponse.json({ error: 'WSIS_TOKEN_SECRET is not set.' }, { status: 500 })
  return NextResponse.json(signed)
}

/** Checks a token from a shared link; nothing is stored. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string } | null
  return NextResponse.json({ ok: !!verifyToken(body?.token) }, { headers: { 'Cache-Control': 'no-store' } })
}
