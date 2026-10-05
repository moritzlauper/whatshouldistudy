import { NextResponse } from 'next/server'
import { priceFor } from '@/lib/pricing.ts'
import { paymentMode, visitorCountry } from '@/lib/server/token.ts'
import { SITES } from '@/lib/site/config.ts'
import type { SiteId } from '@/lib/site/config.ts'

/** Payment mode and the price in the visitor's currency. */
export async function GET(req: Request) {
  const site = new URL(req.url).searchParams.get('site') as SiteId | null
  const price = priceFor(visitorCountry(req), SITES[site && site in SITES ? site : 'global'].currency)
  return NextResponse.json({ payments: paymentMode(), price }, { headers: { 'Cache-Control': 'private, no-store' } })
}
