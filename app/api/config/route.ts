import { NextResponse } from 'next/server'
import { priceFor } from '@/lib/pricing.ts'
import { paymentMode, visitorCountry } from '@/lib/server/token.ts'

/** Payment mode and the price in the visitor's currency. */
export async function GET(req: Request) {
  const site = new URL(req.url).searchParams.get('site')
  const price = priceFor(visitorCountry(req), site === 'ch' ? 'CHF' : 'USD')
  return NextResponse.json({ payments: paymentMode(), price }, { headers: { 'Cache-Control': 'private, no-store' } })
}
