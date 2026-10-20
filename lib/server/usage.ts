import 'server-only'
import { USAGE_STATS, usagePeriods, validDay, validMonth } from '../usage-stats.ts'

/**
 * Dedicated free Redis instance. Daily and monthly aggregates, never individual events.
 * The Vercel Marketplace integration (prefix USAGE_) sets the KV_REST_API names;
 * a database set up by hand can use the REDIS_REST ones.
 */
const restUrl = () => process.env.USAGE_KV_REST_API_URL || process.env.USAGE_REDIS_REST_URL
const restToken = () => process.env.USAGE_KV_REST_API_TOKEN || process.env.USAGE_REDIS_REST_TOKEN
export const usageConfigured = () => USAGE_STATS && !!restUrl() && !!restToken()
const key = (month: string) => `wsis:usage:v1:${month}`
const dayKey = (day: string) => `wsis:usage:day:zurich:v1:${day}`
const dailySinceKey = 'wsis:usage:day:zurich:v1:since'

export async function redis(command: Array<string | number>): Promise<unknown> {
  const res = await fetch(restUrl()!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${restToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
    signal: AbortSignal.timeout(2500),
  })
  if (!res.ok) throw new Error('Usage storage unavailable')
  const json = await res.json() as { result?: unknown; error?: string }
  if (json.error) throw new Error('Usage storage unavailable')
  return json.result
}

// Both periods in one atomic operation, with independent fixed retention.
// Bound cardinality even if a bot sends many different requests.
const INCREMENT = `
for k = 1, 2 do
  local size = redis.call('HLEN', KEYS[k])
  for i = 4, #ARGV do
    local exists = redis.call('HEXISTS', KEYS[k], ARGV[i]) == 1
    if size < 20000 or exists then
      redis.call('HINCRBY', KEYS[k], ARGV[i], 1)
      if not exists then size = size + 1 end
    end
  end
  redis.call('EXPIREAT', KEYS[k], ARGV[k])
end
redis.call('SET', KEYS[3], ARGV[3], 'NX')
return 1
`

export async function countUsage(counters: string[]) {
  if (!usageConfigured() || !counters.length) return
  const { month, day, monthExpiry, dayExpiry } = usagePeriods()
  try {
    await redis(['EVAL', INCREMENT, 3, key(month), dayKey(day), dailySinceKey, monthExpiry, dayExpiry, day, ...counters.slice(0, 100)])
  } catch {
    // No request details or payloads in logs; a storage failure cannot break results.
    console.warn('Usage statistics storage unavailable')
  }
}

export async function readUsage(period: string) {
  if (!validMonth(period) && !validDay(period)) throw new Error('Invalid usage period')
  const values = await redis(['HGETALL', validDay(period) ? dayKey(period) : key(period)]) as string[]
  const rows: Array<Record<string, unknown> & { count: number }> = []
  for (let i = 0; i < values.length; i += 2) {
    rows.push({ ...JSON.parse(values[i]), count: Number(values[i + 1]) })
  }
  return rows.sort((a, b) => b.count - a.count)
}

/** One deployment-wide calendar date, not an individual event timestamp. */
export async function readDailySince(): Promise<string | null> {
  const since = await redis(['GET', dailySinceKey])
  return typeof since === 'string' && validDay(since) ? since : null
}
