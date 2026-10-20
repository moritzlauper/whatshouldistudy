import 'server-only'
import { createHash, randomInt } from 'node:crypto'
import { ATTRIBUTION_MS, TEST_DURATION_MS, RECORD_RETENTION_SECONDS, PAYWALL_EXPERIMENT, assignmentActive, validParticipant, validVariant } from '../paywall-experiment.ts'
import type { PaywallAssignment } from '../paywall-experiment.ts'
import { SALES_PAUSED, SITES } from '../site/config.ts'
import type { SiteId } from '../site/config.ts'
import { redis, usageConfigured } from './usage.ts'

const root = `wsis:experiment:${PAYWALL_EXPERIMENT}`
const participantKey = (site: SiteId, hash: string) => `${root}:${site}:participant:${hash}`
const totalsKey = (site: SiteId) => `${root}:${site}:totals`
const decisionKey = (site: SiteId) => `${root}:${site}:decision`
const expiry = (now = Date.now()) => Math.floor(now / 1000) + RECORD_RETENTION_SECONDS
const hashId = (id: string) => createHash('sha256').update(`${PAYWALL_EXPERIMENT}:${id.toLowerCase()}`).digest('hex')
export const experimentAvailable = (site: SiteId) => usageConfigured() && !SALES_PAUSED[site]

const ENROL = `
local started = tonumber(redis.call('HGET', KEYS[3], 'startedAt'))
if not started then
  started = tonumber(ARGV[2])
  redis.call('HSET', KEYS[3], 'startedAt', ARGV[2])
end
local winner = redis.call('HGET', KEYS[3], 'winner')
if not winner and tonumber(ARGV[2]) >= started + tonumber(ARGV[4]) then
  local dv = tonumber(redis.call('HGET', KEYS[2], 'direct:visitors') or '0')
  local lv = tonumber(redis.call('HGET', KEYS[2], 'late:visitors') or '0')
  local db = tonumber(redis.call('HGET', KEYS[2], 'direct:windowBuyers') or '0')
  local lb = tonumber(redis.call('HGET', KEYS[2], 'late:windowBuyers') or '0')
  winner = 'direct'
  if lv > 0 and ((dv == 0 and lb > 0) or (dv > 0 and lb * dv > db * lv)) then winner = 'late' end
  redis.call('HSET', KEYS[3], 'winner', winner, 'decidedAt', ARGV[2],
    'directVisitors', dv, 'directBuyers', db, 'lateVisitors', lv, 'lateBuyers', lb)
end
if redis.call('EXISTS', KEYS[1]) == 1 then
  if redis.call('HGET', KEYS[1], 'withdrawn') then return {} end
  local at = tonumber(redis.call('HGET', KEYS[1], 'assignedAt'))
  if at and tonumber(ARGV[2]) < at + tonumber(ARGV[5]) then
    return {redis.call('HGET', KEYS[1], 'variant'), tostring(at), 'test'}
  end
end
if winner then return {winner, ARGV[2], 'rollout'} end
local total = tonumber(redis.call('HGET', KEYS[2], 'direct:visitors') or '0') + tonumber(redis.call('HGET', KEYS[2], 'late:visitors') or '0')
if total >= 100000 then return {} end
redis.call('HSET', KEYS[1], 'variant', ARGV[1], 'assignedAt', ARGV[2])
redis.call('HINCRBY', KEYS[2], ARGV[1] .. ':visitors', 1)
redis.call('HSETNX', KEYS[2], 'startedAt', ARGV[2])
redis.call('EXPIREAT', KEYS[1], ARGV[3])
redis.call('EXPIREAT', KEYS[2], ARGV[3])
return {ARGV[1], ARGV[2], 'test'}
`

export async function enrolPaywall(site: SiteId, id: string, now = Date.now()): Promise<PaywallAssignment | null> {
  if (!experimentAvailable(site) || !validParticipant(id)) return null
  const result = await redis(['EVAL', ENROL, 3, participantKey(site, hashId(id)), totalsKey(site), decisionKey(site), randomInt(2) ? 'direct' : 'late', now, expiry(now), TEST_DURATION_MS, ATTRIBUTION_MS]) as string[]
  if (!validVariant(result?.[0]) || !assignmentActive(Number(result[1]), now)) return null
  return { id, site, variant: result[0], assignedAt: Number(result[1]), inTest: result[2] === 'test' }
}

export async function withdrawPaywall(site: SiteId, id: string) {
  if (!validParticipant(id) || !usageConfigured()) return
  // Keep the tombstone until expiry so a delayed enrolment cannot undo withdrawal.
  await redis(['EVAL', "redis.call('HSET', KEYS[1], 'withdrawn', '1'); redis.call('EXPIREAT', KEYS[1], ARGV[1]); return 1", 1, participantKey(site, hashId(id)), expiry()])
}

export interface ExperimentMetadata {
  ab_experiment: string
  ab_participant: string
  ab_variant: string
}

/** Attribution only; these values never grant access or influence the price. */
export async function checkoutExperiment(site: SiteId, id: string | null): Promise<ExperimentMetadata | null> {
  if (!id || !validParticipant(id) || !experimentAvailable(site)) return null
  const hash = hashId(id)
  const [variant, assignedAt, withdrawn] = await redis(['HMGET', participantKey(site, hash), 'variant', 'assignedAt', 'withdrawn']) as Array<string | null>
  if (withdrawn || !validVariant(variant) || !assignmentActive(Number(assignedAt))) return null
  return { ab_experiment: PAYWALL_EXPERIMENT, ab_participant: hash, ab_variant: variant }
}

const CHECKOUT = `
if redis.call('HGET', KEYS[1], 'withdrawn') then return 0 end
local variant = redis.call('HGET', KEYS[1], 'variant')
local at = tonumber(redis.call('HGET', KEYS[1], 'assignedAt'))
if not variant or not at or tonumber(ARGV[1]) >= at + tonumber(ARGV[2]) then return 0 end
if redis.call('HSETNX', KEYS[1], 'checkout', '1') == 1 then
  redis.call('HINCRBY', KEYS[2], variant .. ':checkouts', 1)
  redis.call('EXPIREAT', KEYS[2], ARGV[3])
end
return 1
`

export async function countExperimentCheckout(site: SiteId, metadata: ExperimentMetadata) {
  await redis(['EVAL', CHECKOUT, 2, participantKey(site, metadata.ab_participant), totalsKey(site), Date.now(), ATTRIBUTION_MS, expiry()])
}

interface PaidExperimentSession {
  id: string
  mode?: string
  payment_status?: string
  amount_total?: number | null
  currency?: string | null
  metadata?: Record<string, string> | null
}

const PURCHASE = `
if redis.call('HGET', KEYS[1], 'withdrawn') then return 0 end
local variant = redis.call('HGET', KEYS[1], 'variant')
local at = tonumber(redis.call('HGET', KEYS[1], 'assignedAt'))
if variant ~= ARGV[1] or not at or tonumber(ARGV[2]) < at or tonumber(ARGV[2]) >= at + tonumber(ARGV[3]) then return 0 end
if redis.call('SET', KEYS[3], '1', 'NX', 'EXAT', ARGV[6]) == false then return 0 end
if redis.call('HSETNX', KEYS[1], 'purchased', '1') == 1 then
  redis.call('HINCRBY', KEYS[2], variant .. ':buyers', 1)
end
local started = tonumber(redis.call('HGET', KEYS[4], 'startedAt'))
if started and tonumber(ARGV[2]) < started + tonumber(ARGV[7]) and redis.call('HSETNX', KEYS[1], 'windowPurchased', '1') == 1 then
  redis.call('HINCRBY', KEYS[2], variant .. ':windowBuyers', 1)
end
redis.call('HINCRBY', KEYS[2], variant .. ':payments', 1)
redis.call('HINCRBY', KEYS[2], variant .. ':revenue:' .. ARGV[5], ARGV[4])
redis.call('EXPIREAT', KEYS[2], ARGV[6])
return 1
`

/** Called only from a signature-verified Stripe webhook. Retries never add a second sale. */
export async function countExperimentPurchase(session: PaidExperimentSession, paidAt: number) {
  const m = session.metadata
  if (session.mode !== 'payment' || session.payment_status !== 'paid' || m?.product !== 'wsis_report' || m.ab_experiment !== PAYWALL_EXPERIMENT) return
  if (!m.site || !Object.hasOwn(SITES, m.site) || !/^[a-f0-9]{64}$/.test(m.ab_participant ?? '') || !validVariant(m.ab_variant)) return
  if (!/^cs_(?:live|test)_[A-Za-z0-9]+$/.test(session.id) || !Number.isSafeInteger(session.amount_total) || session.amount_total! <= 0 || !/^[a-z]{3}$/.test(session.currency ?? '') || !Number.isFinite(paidAt)) return
  if (!usageConfigured()) throw new Error('Experiment storage unavailable')
  const site = m.site as SiteId
  const saleKey = `${root}:payment:${createHash('sha256').update(session.id).digest('hex')}`
  await redis(['EVAL', PURCHASE, 4, participantKey(site, m.ab_participant), totalsKey(site), saleKey, decisionKey(site), m.ab_variant, paidAt, ATTRIBUTION_MS, session.amount_total!, session.currency!, expiry(), TEST_DURATION_MS])
}

export async function readPaywallReport() {
  const sites = await Promise.all((Object.keys(SITES) as SiteId[]).map(async site => {
    const values = await redis(['HGETALL', totalsKey(site)]) as string[]
    const totals: Record<string, number> = {}
    for (let i = 0; i < values.length; i += 2) totals[values[i]] = Number(values[i + 1])
    const valuesDecision = await redis(['HGETALL', decisionKey(site)]) as string[]
    const decision: Record<string, string> = {}
    for (let i = 0; i < valuesDecision.length; i += 2) decision[valuesDecision[i]] = valuesDecision[i + 1]
    return { site, totals, decision }
  }))
  return { experiment: PAYWALL_EXPERIMENT, testDays: TEST_DURATION_MS / 86400_000, attributionDays: ATTRIBUTION_MS / 86400_000, sites }
}
