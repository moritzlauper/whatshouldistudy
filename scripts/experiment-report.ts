import { fromStripeAmount } from '../lib/pricing.ts'
import { PAYWALL_EXPERIMENT } from '../lib/paywall-experiment.ts'

const base = process.env.USAGE_REPORT_URL
const token = process.env.USAGE_ADMIN_TOKEN
if (!base || !token) {
  console.error('Set USAGE_REPORT_URL and USAGE_ADMIN_TOKEN, then run pnpm experiment:report.')
  process.exit(1)
}
try {
  const url = new URL(`${base.replace(/\/$/, '')}/api/paywall-experiment`)
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Use HTTPS for the report URL.')
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const res = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Experiment report failed (HTTP ${res.status})`)
  const report = await res.json() as { experiment: string; testDays: number; attributionDays: number; sites: Array<{ site: string; totals: Record<string, number>; decision: Record<string, string> }> }
  if (report.experiment !== PAYWALL_EXPERIMENT) throw new Error('Unexpected experiment report')
  console.log(`A/B test: ${report.experiment}`)
  console.log(`50/50 for ${report.testDays} days per site; purchase attribution: ${report.attributionDays} days per participant.`)
  for (const { site, decision } of report.sites) {
    if (decision.winner) {
      console.log(`${site}: automatic winner ${decision.winner}, selected ${new Date(Number(decision.decidedAt)).toISOString()}; at selection: direct ${decision.directBuyers}/${decision.directVisitors}, late ${decision.lateBuyers}/${decision.lateVisitors}.`)
    } else if (decision.startedAt) {
      console.log(`${site}: running; automatic selection from ${new Date(Number(decision.startedAt) + report.testDays * 86400_000).toISOString()}.`)
    } else console.log(`${site}: waiting for first eligible Ads visitor.`)
  }
  const rows = report.sites.flatMap(({ site, totals }) => ['direct', 'late'].map(variant => {
    const visitors = totals[`${variant}:visitors`] ?? 0
    const buyers = totals[`${variant}:buyers`] ?? 0
    const revenue = Object.entries(totals).filter(([key]) => key.startsWith(`${variant}:revenue:`)).map(([key, amount]) => {
      const price = fromStripeAmount(amount, key.split(':')[2])
      return `${price.currency} ${price.amount.toFixed(2)}`
    }).join(', ')
    const windowBuyers = totals[`${variant}:windowBuyers`] ?? 0
    return { site, variant, visitors, checkouts: totals[`${variant}:checkouts`] ?? 0, buyers14DayTest: windowBuyers, decisionRate: visitors ? `${(100 * windowBuyers / visitors).toFixed(2)}%` : '—', buyersIncludingLater: buyers, payments: totals[`${variant}:payments`] ?? 0, revenue: revenue || '—' }
  }))
  console.table(rows)
  console.log('Primary metric: unique buyers within the 14-day test / assigned browsers. direct = buy-first hero; late = free-start hero.')
  console.log('After 14 days, new visitors get the higher observed purchase rate, even with small samples; ties use direct. This is not a statistical significance claim.')
  console.log('Selection runs on the next eligible visit. Existing assignments stay stable. Later purchases update totals, but never change the saved winner. Compare sites separately.')
  console.log('Storage resets, ad blockers and denied measurement can affect coverage. Revenue is gross paid revenue, before refunds.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Experiment report failed')
  process.exitCode = 1
}
