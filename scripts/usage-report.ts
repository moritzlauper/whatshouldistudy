import { validMonth } from '../lib/usage-stats.ts'

const month = process.argv[2] ?? new Date().toISOString().slice(0, 7)
const base = process.env.USAGE_REPORT_URL
const token = process.env.USAGE_ADMIN_TOKEN
if (!validMonth(month) || !base || !token) {
  console.error('Set USAGE_REPORT_URL and USAGE_ADMIN_TOKEN, then run pnpm usage:report [YYYY-MM].')
  process.exit(1)
}
const url = new URL(`${base.replace(/\/$/, '')}/api/usage`)
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
  console.error('Use HTTPS for the report URL.')
  process.exit(1)
}
url.searchParams.set('month', month)
try {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Report failed (HTTP ${response.status})`)
  const { rows } = await response.json() as { rows: Array<Record<string, unknown>> }
  console.log(`Usage totals: ${month} (UTC)`)
  console.log('Results shown and paid unlocks')
  console.table(rows.filter((r) => r.kind === 'event').map(({ event, count }) => ({ event, count })))
  console.log('Imported sources')
  console.table(rows.filter((r) => r.kind === 'import').map(({ source, count }) => ({ source, count })))
  console.log('Programmes returned')
  console.table(rows.filter((r) => r.kind === 'programme').map(({ name, institution, placement, count }) => ({ name, institution, placement, count })))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Report failed')
  process.exitCode = 1
}
