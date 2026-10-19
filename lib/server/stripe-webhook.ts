import { createHmac, timingSafeEqual } from 'node:crypto'

/** Verify the exact request bytes, with Stripe's five-minute replay tolerance. */
export function validStripeSignature(body: Uint8Array, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header || !secret) return false
  const parts = header.split(',').map(p => p.trim().split('='))
  const timestamps = parts.filter(([k]) => k === 't')
  if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0][1] ?? '')) return false
  const timestamp = timestamps[0][1]
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest()
  return parts.some(([key, value]) => key === 'v1' && /^[a-f0-9]{64}$/.test(value ?? '') && timingSafeEqual(expected, Buffer.from(value, 'hex')))
}
