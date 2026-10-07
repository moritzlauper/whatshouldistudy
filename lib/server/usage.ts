import 'server-only'
import { USAGE_STATS, validMonth } from '../usage-stats.ts'

/**
 * Dedicated free Redis instance. Only monthly counters, never individual events.
 * The Vercel Marketplace integration (prefix USAGE_) sets the KV_REST_API names;
 * a database set up by hand can use the REDIS_REST ones.
 */
const restUrl = () => process.env.USAGE_KV_REST_API_URL || process.env.USAGE_REDIS_REST_URL
const restToken = () => process.env.USAGE_KV_REST_API_TOKEN || process.env.USAGE_REDIS_REST_TOKEN
export const usageConfigured = () => USAGE_STATS && !!restUrl() && !!restToken()
const key = (month: string) => `wsis:usage:v1:${month}`

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

// Atomic increments and a fixed expiry: 90 days after the month's end.
// Bound cardinality even if a bot sends many different requests.
const INCREMENT = `
local size = redis.call('HLEN', KEYS[1])
for i = 2, #ARGV do
  if size < 20000 or redis.call('HEXISTS', KEYS[1], ARGV[i]) == 1 then
    redis.call('HINCRBY', KEYS[1], ARGV[i], 1)
    size = size + 1
  end
end
redis.call('EXPIREAT', KEYS[1], ARGV[1])
return 1
`

export async function countUsage(counters: string[]) {
  if (!usageConfigured() || !counters.length) return
  const now = new Date()
  const month = now.toISOString().slice(0, 7)
  const expiry = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000) + 90 * 86400
  try {
    await redis(['EVAL', INCREMENT, 1, key(month), expiry, ...counters.slice(0, 100)])
  } catch {
    // No request details or payloads in logs; a storage failure cannot break results.
    console.warn('Usage statistics storage unavailable')
  }
}

export async function readUsage(month: string) {
  if (!validMonth(month)) throw new Error('Invalid month')
  const values = await redis(['HGETALL', key(month)]) as string[]
  const rows: Array<Record<string, unknown> & { count: number }> = []
  for (let i = 0; i < values.length; i += 2) {
    rows.push({ ...JSON.parse(values[i]), count: Number(values[i + 1]) })
  }
  return rows.sort((a, b) => b.count - a.count)
}
