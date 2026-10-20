import { validStripeSignature } from '@/lib/server/stripe-webhook.ts'
import { sendPaymentEmail } from '@/lib/server/payment-email.ts'
import type { PaidSession } from '@/lib/server/payment-email.ts'
import { countExperimentPurchase } from '@/lib/server/paywall-experiment.ts'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return Response.json({ error: 'Webhook is not configured.' }, { status: 503 })
  const reader = req.body?.getReader()
  if (!reader) return new Response(null, { status: 400 })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 256_000) { await reader.cancel(); return new Response(null, { status: 413 }) }
      chunks.push(value)
    }
  } catch { return new Response(null, { status: 400 }) }
  const body = Buffer.concat(chunks)
  if (!validStripeSignature(body, req.headers.get('stripe-signature'), secret)) return new Response(null, { status: 400 })
  let event: { type?: string; created?: number; livemode?: boolean; data?: { object?: PaidSession } }
  try { event = JSON.parse(body.toString('utf8')) } catch { return new Response(null, { status: 400 }) }
  if (!event || typeof event !== 'object') return new Response(null, { status: 400 })
  const live = /^(?:sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? '')
  if (event.livemode !== live) return new Response(null, { status: 400 })
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type ?? '')) return Response.json({ received: true })
  if (!event.data?.object) return new Response(null, { status: 400 })
  try {
    const delivery = await sendPaymentEmail(event.data.object)
    await countExperimentPurchase(event.data.object, (event.created ?? Date.now() / 1000) * 1000)
    return Response.json({ received: true, delivery })
  } catch {
    // Non-2xx makes Stripe retry; do not acknowledge before SMTP/storage finish.
    console.error('Payment delivery or measurement failed; Stripe delivery must be retried')
    return Response.json({ error: 'Payment processing temporarily unavailable.' }, { status: 503 })
  }
}
