import { USAGE_DAY_TIMEZONE, usagePeriods, validDay, validMonth } from '../lib/usage-stats.ts'

const args = process.argv.slice(2)
const period = args.find((a) => !a.startsWith('--')) ?? new Date().toISOString().slice(0, 7)
// Rare profile combinations stay hidden: with few results a single one could stand for one person.
const minCount = Math.max(1, Number(args.find((a) => a.startsWith('--min='))?.slice(6)) || 5)
const daily = validDay(period)
const base = process.env.USAGE_REPORT_URL
const token = process.env.USAGE_ADMIN_TOKEN
if ((!validMonth(period) && !daily) || !base || !token) {
  console.error('Set USAGE_REPORT_URL and USAGE_ADMIN_TOKEN, then run pnpm usage:report [YYYY-MM | YYYY-MM-DD] [--min=5].')
  process.exit(1)
}
const url = new URL(`${base.replace(/\/$/, '')}/api/usage`)
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
  console.error('Use HTTPS for the report URL.')
  process.exit(1)
}
url.searchParams.set(daily ? 'day' : 'month', period)
try {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  }
  const response = await fetch(url, {
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  })
  if (response.headers.get('x-vercel-mitigated') === 'challenge') {
    throw new Error('Report blocked by Vercel bot protection. Set or refresh VERCEL_AUTOMATION_BYPASS_SECRET in .env.local using this project’s Protection Bypass for Automation secret; USAGE_ADMIN_TOKEN is still required.')
  }
  if (!response.ok) throw new Error(`Report failed (HTTP ${response.status})`)
  const data = await response.json() as { day?: string; timezone?: string; collectingSince?: string | null; rows: Array<Record<string, unknown>> }
  if (daily && (data.day !== period || data.timezone !== USAGE_DAY_TIMEZONE)) throw new Error('This deployment does not support daily reports yet.')
  const { rows } = data
  console.log(`Usage totals: ${period} (${daily ? USAGE_DAY_TIMEZONE : 'UTC'})`)
  if (daily) {
    if (!data.collectingSince || period < data.collectingSince) {
      console.log(`No daily history available for this date.${data.collectingSince ? ` Collection began ${data.collectingSince}.` : ' No daily counters recorded yet.'}`)
      process.exit(0)
    }
    if (usagePeriods(new Date(`${period}T12:00:00Z`)).dayExpiry <= Date.now() / 1000) {
      console.log('Daily counters for this date have expired (90-day retention).')
      process.exit(0)
    }
    if (period === data.collectingSince) console.log('Partial day: daily collection began during this date.')
    if (period >= usagePeriods().day) console.log('This day is not complete yet.')
  }
  console.log('Results shown and paid unlocks')
  console.table(rows.filter((r) => r.kind === 'event').map(({ event, count }) => ({ event, count })))
  console.log('Imported sources')
  console.table(rows.filter((r) => r.kind === 'import').map(({ source, count }) => ({ source, count })))
  console.log('Programmes returned')
  console.table(rows.filter((r) => r.kind === 'programme').map(({ name, institution, placement, count }) => ({ name, institution, placement, count })))
  const profiles = rows.filter((r) => r.kind === 'profile') as Array<{ basis: string; code: string; rank: number; field: string; count: number }>
  if (profiles.length) {
    // Place 1 is counted once per result, so its sum per code is the number of results with that code.
    const codes = new Map<string, { basis: string; code: string; results: number }>()
    for (const p of profiles.filter((p) => p.rank === 1)) {
      const key = `${p.basis} ${p.code}`
      codes.set(key, { basis: p.basis, code: p.code, results: (codes.get(key)?.results ?? 0) + p.count })
    }
    console.log(`Profile codes (results per code, at least ${minCount})`)
    console.table([...codes.values()].filter((c) => c.results >= minCount).sort((a, b) => b.results - a.results))
    const shown = profiles.filter((p) => p.count >= minCount)
      .sort((a, b) => a.basis.localeCompare(b.basis) || a.code.localeCompare(b.code) || a.rank - b.rank || b.count - a.count)
    console.log(`Top fields per profile code (at least ${minCount})`)
    console.table(shown.map(({ basis, code, rank, field, count }) => ({ basis, code, rank, field, count })))
    const hidden = profiles.length - shown.length
    if (hidden) console.log(`${hidden} rarer combinations hidden; lower the threshold with --min=N.`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Report failed')
  process.exitCode = 1
}
