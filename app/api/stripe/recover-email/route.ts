import { timingSafeEqual } from 'node:crypto'
import { stripe } from '@/lib/server/stripe.ts'
import { paymentEmail, sendPaymentEmail } from '@/lib/server/payment-email.ts'
import type { PaidSession } from '@/lib/server/payment-email.ts'
import { siteUrl } from '@/lib/site.ts'
import { routes } from '@/lib/site/config.ts'

export const runtime = 'nodejs'
export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store' }

/** Owner-only recovery of an already-paid purchase; recipient comes only from Stripe. */
export async function POST(req: Request) {
  const secret = process.env.USAGE_ADMIN_TOKEN
  const have = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret ?? ''}`)
  if (!secret || have.length !== want.length || !timingSafeEqual(have, want)) return new Response(null, { status: 401, headers })
  const raw = await req.text()
  if (raw.length > 1024) return new Response(null, { status: 413, headers })
  let input: { session_id?: string; locale?: string }
  try { input = JSON.parse(raw) } catch { return new Response(null, { status: 400, headers }) }
  if (!input || typeof input.session_id !== 'string' || !/^cs_(?:live|test)_[A-Za-z0-9]+$/.test(input.session_id)) return new Response(null, { status: 400, headers })
  if (input.locale && !['de-CH', 'fr-CH', 'it-CH', 'en', 'de-DE', 'de-AT'].includes(input.locale)) return new Response(null, { status: 400, headers })
  try {
    const session = await stripe<PaidSession>('GET', `checkout/sessions/${input.session_id}`)
    if (!paymentEmail(session)) return Response.json({ error: 'Not a paid report purchase.' }, { status: 409, headers })
    if (input.locale) {
      session.metadata = { ...session.metadata, locale: input.locale }
      if (session.metadata.site === 'ch' && (input.locale === 'it-CH' || input.locale === 'fr-CH')) {
        session.success_url = siteUrl('ch', routes('ch', '', input.locale).unlocked)
      }
    }
    const delivery = await sendPaymentEmail(session)
    return Response.json({ delivery }, { headers })
  } catch {
    console.error('Paid report recovery email failed')
    return Response.json({ error: 'Recovery email unavailable.' }, { status: 503, headers })
  }
}
