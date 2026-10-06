/**
 * Creates the Stripe products and prices the site sells, from lib/pricing.ts:
 * the one-time full report and three plans for organisations, each yearly and
 * monthly, with a currency option for every currency in PRICES. Also the meter
 * that counts the reports organisations use.
 *
 * Safe to run again: products have fixed ids, prices are found by lookup key.
 * When an amount changes, a new price takes over the lookup key and the old one
 * is archived (existing subscriptions keep their price).
 *
 *   STRIPE_SECRET_KEY=sk_live_… node scripts/stripe-setup.ts
 *   STRIPE_CLI=live node scripts/stripe-setup.ts   (through a logged-in Stripe CLI)
 */
import { execFileSync } from 'node:child_process'
import { ORG_PRICES, ORG_REPORTS, ORG_TIERS, PRICES, REPORT_LOOKUP_KEY, orgLookupKey, stripeAmount } from '../lib/pricing.ts'
import type { Interval, OrgTier } from '../lib/pricing.ts'

const KEY = process.env.STRIPE_SECRET_KEY
const CLI = process.env.STRIPE_CLI as 'live' | 'test' | undefined
if (!KEY && !CLI) throw new Error('Set STRIPE_SECRET_KEY, or STRIPE_CLI=live|test to go through the Stripe CLI')

/** The site's own currency first: it becomes each price's default currency. */
const BASE = 'CHF'
export const METER_EVENT = 'wsis_report'

type Params = Record<string, string | number | boolean>

async function stripe<T>(method: 'GET' | 'POST', path: string, params: Params = {}): Promise<T> {
  if (CLI) {
    const args = [method.toLowerCase(), `/v1/${path}`, ...(CLI === 'live' ? ['--live'] : []), ...Object.entries(params).flatMap(([k, v]) => ['-d', `${k}=${v}`])]
    const j = JSON.parse(execFileSync('stripe', args, { encoding: 'utf8' })) as T & { error?: { message: string; code?: string } }
    if (j.error) throw Object.assign(new Error(`${method} ${path}: ${j.error.message}`), { code: j.error.code, status: j.error.code === 'resource_missing' ? 404 : 400 })
    return j
  }
  const body = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const url = `https://api.stripe.com/v1/${path}${method === 'GET' && Object.keys(params).length ? `?${body}` : ''}`
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? body : undefined,
  })
  const j = (await res.json()) as T & { error?: { message: string; code?: string } }
  if (!res.ok) throw Object.assign(new Error(`${method} ${path}: ${j.error?.message}`), { code: j.error?.code, status: res.status })
  return j
}

interface StripePrice {
  id: string
  currency: string
  unit_amount: number
  recurring: { interval: string } | null
  currency_options?: Record<string, { unit_amount: number }>
}

async function product(id: string, name: string, description: string, metadata: Params = {}) {
  const meta = Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`metadata[${k}]`, v]))
  try {
    await stripe('GET', `products/${id}`)
    await stripe('POST', `products/${id}`, { name, description, ...meta })
    console.log(`product ${id}: up to date`)
  } catch (e) {
    if ((e as { status?: number }).status !== 404) throw e
    await stripe('POST', 'products', { id, name, description, ...meta })
    console.log(`product ${id}: created`)
  }
}

/** Amounts in Stripe's smallest unit per lower-case currency. */
function amounts(table: Record<string, number>, factor = 1): Record<string, number> {
  return Object.fromEntries(Object.entries(table).map(([cur, amount]) => [cur.toLowerCase(), stripeAmount({ currency: cur, amount: amount * factor })]))
}

function same(p: StripePrice, want: Record<string, number>, interval: Interval | null): boolean {
  if ((p.recurring?.interval ?? null) !== interval) return false
  const have: Record<string, number> = { [p.currency]: p.unit_amount }
  for (const [cur, o] of Object.entries(p.currency_options ?? {})) have[cur] = o.unit_amount
  return Object.keys(want).length === Object.keys(have).length && Object.entries(want).every(([cur, a]) => have[cur] === a)
}

async function price(lookupKey: string, productId: string, want: Record<string, number>, interval: Interval | null, nickname: string) {
  const found = await stripe<{ data: StripePrice[] }>('GET', 'prices', { 'lookup_keys[]': lookupKey, 'expand[]': 'data.currency_options' })
  const current = found.data[0]
  if (current && same(current, want, interval)) {
    console.log(`price ${lookupKey}: up to date (${current.id})`)
    return
  }
  const base = BASE.toLowerCase()
  const params: Params = { product: productId, currency: base, unit_amount: want[base], lookup_key: lookupKey, transfer_lookup_key: true, nickname, tax_behavior: 'inclusive' }
  for (const [cur, a] of Object.entries(want)) if (cur !== base) params[`currency_options[${cur}][unit_amount]`] = a
  if (interval) params['recurring[interval]'] = interval
  const created = await stripe<StripePrice>('POST', 'prices', params)
  if (current) await stripe('POST', `prices/${current.id}`, { active: false })
  console.log(`price ${lookupKey}: ${current ? `replaced ${current.id} with` : 'created'} ${created.id}`)
}

async function meter() {
  const list = await stripe<{ data: { id: string; event_name: string; status: string }[] }>('GET', 'billing/meters', { limit: 100 })
  const found = list.data.find((m) => m.event_name === METER_EVENT && m.status === 'active')
  if (found) return console.log(`meter ${METER_EVENT}: up to date (${found.id})`)
  const m = await stripe<{ id: string }>('POST', 'billing/meters', {
    display_name: 'Full reports used by organisations',
    event_name: METER_EVENT,
    'default_aggregation[formula]': 'count',
    'customer_mapping[type]': 'by_id',
    'customer_mapping[event_payload_key]': 'stripe_customer_id',
  })
  console.log(`meter ${METER_EVENT}: created ${m.id}`)
}

const TIER_NAMES: Record<OrgTier, string> = { counsellor: 'Counsellor', school: 'School', institution: 'Institution' }

await product('wsis_report', 'whatshouldistudy: full programme report', 'All matching study programmes with fees, admission and filters. Valid for 12 months.')
await price(REPORT_LOOKUP_KEY, 'wsis_report', amounts(PRICES), null, 'Full report')

for (const tier of ORG_TIERS) {
  const reports = ORG_REPORTS[tier]
  const id = `wsis_org_${tier}`
  await product(id, `whatshouldistudy for organisations: ${TIER_NAMES[tier]}`, `${reports === null ? 'Unlimited' : reports.toLocaleString('en')} full reports a month for your students.`, { tier, reports: reports ?? 'unlimited' })
  await price(orgLookupKey(tier, 'year'), id, amounts(ORG_PRICES[tier].year, 12), 'year', `${TIER_NAMES[tier]}, yearly`)
  await price(orgLookupKey(tier, 'month'), id, amounts(ORG_PRICES[tier].month), 'month', `${TIER_NAMES[tier]}, monthly`)
}

await meter()
