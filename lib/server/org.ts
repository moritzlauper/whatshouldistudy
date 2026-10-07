import 'server-only'
import { ORG_REPORTS, ORG_TIERS, TRIAL_REPORTS } from '@/lib/pricing.ts'
import type { Interval, OrgTier } from '@/lib/pricing.ts'
import { StripeError, stripe } from './stripe.ts'

/**
 * Organisation plans without a database: the subscription in Stripe says
 * whether a link works and which plan it has, and a Stripe meter counts the
 * reports students unlock through it (event «wsis_report», created by
 * scripts/stripe-setup.ts). The count per calendar month decides the limit.
 */

export const METER_EVENT = 'wsis_report'

/** Statuses in which students can still unlock; past_due gives a grace period while Stripe retries the card. */
const USABLE = new Set(['active', 'trialing', 'past_due'])

export interface Org {
  subscription: string
  customer: string
  tier: OrgTier
  interval: Interval
  /** Reports per month (in the trial: in total), null for unlimited. */
  limit: number | null
  active: boolean
  /** In the free trial; reports count from its start instead of the calendar month. */
  trial: boolean
  /** Start of the period the limit applies to, in seconds. */
  countFrom: number
}

interface Subscription {
  id: string
  status: string
  customer: string
  trial_start: number | null
  items: { data: { price: { lookup_key: string | null } }[] }
}

/** The plan behind a subscription, or null if it isn't one of ours. */
export async function getOrg(subscription: string): Promise<Org | null> {
  let s: Subscription
  try {
    s = await stripe<Subscription>('GET', `subscriptions/${subscription}`, { 'expand[]': 'items.data.price' })
  } catch (e) {
    if (e instanceof StripeError && e.status === 404) return null
    throw e
  }
  const m = /^wsis_org_([a-z]+)_(year|month)$/.exec(s.items.data[0]?.price.lookup_key ?? '')
  const tier = m?.[1] as OrgTier | undefined
  if (!tier || !ORG_TIERS.includes(tier)) return null
  const trial = s.status === 'trialing'
  const limit = trial ? Math.min(TRIAL_REPORTS, ORG_REPORTS[tier] ?? TRIAL_REPORTS) : ORG_REPORTS[tier]
  return { subscription: s.id, customer: s.customer, tier, interval: m![2] as Interval, limit, active: USABLE.has(s.status), trial, countFrom: trial && s.trial_start ? s.trial_start : monthStart() }
}

let meterId: string | null = null

async function meter(): Promise<string> {
  if (meterId) return meterId
  const list = await stripe<{ data: { id: string; event_name: string; status: string }[] }>('GET', 'billing/meters', { limit: 100 })
  const m = list.data.find((x) => x.event_name === METER_EVENT && x.status === 'active')
  if (!m) throw new Error(`No Stripe meter for ${METER_EVENT}; run scripts/stripe-setup.ts`)
  return (meterId = m.id)
}

/** Start of the current calendar month (UTC), in seconds. */
export function monthStart(now = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000
}

/** Reports unlocked this calendar month, or since the trial started. Stripe aggregates with a short delay, so the count can trail by a few. */
export async function usedThisPeriod(org: Org): Promise<number> {
  const end = Math.ceil(Date.now() / 60_000) * 60
  // Meter summaries need whole minutes.
  const start = Math.floor(org.countFrom / 60) * 60
  const res = await stripe<{ data: { aggregated_value: number }[] }>('GET', `billing/meters/${await meter()}/event_summaries`, { customer: org.customer, start_time: start, end_time: end })
  return res.data.reduce((n, s) => n + s.aggregated_value, 0)
}

/**
 * Counts one report. The identifier ties it to the student's browser and the
 * month, so the same student unlocking twice the same day counts once.
 */
export async function recordUse(org: Org, student: string): Promise<void> {
  const month = new Date().toISOString().slice(0, 7)
  try {
    await stripe('POST', 'billing/meter_events', {
      event_name: METER_EVENT,
      'payload[stripe_customer_id]': org.customer,
      identifier: `${org.subscription}:${month}:${student}`.slice(0, 100),
    })
  } catch (e) {
    // Already counted under this identifier.
    if (e instanceof StripeError && e.status === 400 && /identifier/i.test(e.message)) return
    throw e
  }
}
