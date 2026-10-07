import { NextResponse } from 'next/server'
import { consentRule } from '@/lib/measure.ts'
import { priceForSite } from '@/lib/pricing.ts'
import { paymentMode, visitorCountry } from '@/lib/server/token.ts'
import { SITES } from '@/lib/site/config.ts'
import type { SiteId } from '@/lib/site/config.ts'

/** Payment mode, the site's price and whether the visitor's country asks for consent before measuring. */
export async function GET(req: Request) {
  const site = new URL(req.url).searchParams.get('site') as SiteId | null
  const country = visitorCountry(req)
  const price = priceForSite(site && Object.hasOwn(SITES, site) ? site : 'global', country)
  return NextResponse.json({ payments: paymentMode(), price, consent: consentRule(country) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
