import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'

const root = pathToFileURL(process.cwd() + '/')
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(specifier.slice(2), root).href, context)
  return next(specifier, context)
} })
const command = args => {
  const r = spawnSync(process.env.REDIS_TEST_CLI, ['-h', '127.0.0.1', '-p', process.env.REDIS_TEST_PORT, '-2', '--json', ...args.map(String)], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } })
  assert.equal(r.status, 0, r.stderr || String(r.error ?? 'Redis command failed'))
  return JSON.parse(r.stdout)
}
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://test.invalid')
  return Response.json({ result: command(JSON.parse(options.body)) })
}
const { enrolPaywall, checkoutExperiment, countExperimentCheckout, countExperimentPurchase, withdrawPaywall, readPaywallReport } = await import('../../lib/server/paywall-experiment.ts')
const { PAYWALL_EXPERIMENT, TEST_DURATION_MS } = await import('../../lib/paywall-experiment.ts')
const prefix = 'wsis:experiment:' + PAYWALL_EXPERIMENT
const clear = () => {
  const keys = command(['KEYS', prefix + ':*'])
  if (keys.length) command(['DEL', ...keys])
}
clear()
let now = Date.now()
const start = now
Date.now = () => now
try {
  const id = randomUUID()
  const a = await enrolPaywall('ch', id)
  assert.ok(['late', 'direct'].includes(a.variant))
  assert.equal(a.inTest, true)
  assert.deepEqual(await enrolPaywall('ch', id), a)
  let report = await readPaywallReport()
  const ch = () => report.sites.find(s => s.site === 'ch')
  assert.equal(ch().totals[a.variant + ':visitors'], 1)
  const metadata = await checkoutExperiment('ch', id)
  assert.notEqual(metadata.ab_participant, id)
  assert.match(metadata.ab_participant, /^[a-f0-9]{64}$/)
  assert.equal(await checkoutExperiment('global', id), null)
  await countExperimentCheckout('ch', metadata)
  await countExperimentCheckout('ch', metadata)
  const sale = { id: 'cs_test_One', mode: 'payment', payment_status: 'paid', amount_total: 900, currency: 'chf', metadata: { ...metadata, product: 'wsis_report', site: 'ch' } }
  await countExperimentPurchase({ ...sale, payment_status: 'unpaid' }, now)
  await countExperimentPurchase({ ...sale, metadata: { ...sale.metadata, ab_variant: a.variant === 'direct' ? 'late' : 'direct' } }, now)
  await countExperimentPurchase(sale, now)
  await countExperimentPurchase(sale, now)
  await countExperimentPurchase({ ...sale, id: 'cs_test_Two' }, now)
  report = await readPaywallReport()
  assert.equal(ch().totals[a.variant + ':checkouts'], 1)
  assert.equal(ch().totals[a.variant + ':buyers'], 1)
  assert.equal(ch().totals[a.variant + ':windowBuyers'], 1)
  assert.equal(ch().totals[a.variant + ':payments'], 2)
  assert.equal(ch().totals[a.variant + ':revenue:chf'], 1800)
  await withdrawPaywall('ch', id)
  assert.equal(await enrolPaywall('ch', id), null)
  assert.equal(await checkoutExperiment('ch', id), null)
  await countExperimentPurchase({ ...sale, id: 'cs_test_Withdrawn' }, now)
  report = await readPaywallReport()
  assert.equal(ch().totals[a.variant + ':payments'], 2)
  const withdrawnBeforeResponse = randomUUID()
  await withdrawPaywall('ch', withdrawnBeforeResponse)
  assert.equal(await enrolPaywall('ch', withdrawnBeforeResponse), null)

  now = start + TEST_DURATION_MS - 86400_000
  const returningId = randomUUID()
  const returning = await enrolPaywall('ch', returningId)
  const returningMetadata = await checkoutExperiment('ch', returningId)
  // Fixed synthetic cohorts: late has fewer sales but a better conversion rate.
  command(['HSET', prefix + ':ch:totals', 'direct:visitors', 100, 'direct:windowBuyers', 4, 'late:visitors', 50, 'late:windowBuyers', 3])
  now = start + TEST_DURATION_MS
  const newId = randomUUID()
  const rollout = await enrolPaywall('ch', newId)
  assert.equal(rollout.variant, 'late')
  assert.equal(rollout.inTest, false)
  assert.equal(await checkoutExperiment('ch', newId), null)
  assert.deepEqual(await enrolPaywall('ch', returningId), returning)
  // A purchase after the decision updates follow-up totals, never the decision window.
  await countExperimentPurchase({ ...sale, id: 'cs_test_AfterDecision', metadata: { ...sale.metadata, ...returningMetadata } }, now)
  report = await readPaywallReport()
  assert.equal(ch().decision.winner, 'late')
  assert.equal(ch().decision.directBuyers, '4')
  assert.equal(ch().decision.lateBuyers, '3')
  assert.equal(ch().totals['direct:windowBuyers'], 4)
  assert.equal(ch().totals['late:windowBuyers'], 3)
  assert.equal(ch().totals['direct:visitors'], 100)
  assert.equal(ch().totals['late:visitors'], 50)
  command(['HSET', prefix + ':ch:totals', 'direct:windowBuyers', 99])
  assert.equal((await enrolPaywall('ch', randomUUID())).variant, 'late')
  now += TEST_DURATION_MS
  assert.equal(await checkoutExperiment('ch', returningId), null)
  assert.equal((await enrolPaywall('ch', returningId)).variant, 'late')
  assert.equal((await enrolPaywall('ch', returningId)).inTest, false)

  const globalId = randomUUID()
  await enrolPaywall('global', globalId)
  now += TEST_DURATION_MS
  assert.equal((await enrolPaywall('global', randomUUID())).variant, 'direct') // zero-sale tie
  assert.equal((await readPaywallReport()).sites.find(s => s.site === 'global').decision.winner, 'direct')

  const { GET, POST, DELETE } = await import('../../app/api/paywall-experiment/route.ts')
  const url = 'https://example.invalid/api/paywall-experiment'
  assert.equal((await GET(new Request(url))).status, 401)
  const get = await GET(new Request(url, { headers: { authorization: 'Bearer test-admin' } }))
  assert.equal(get.status, 200)
  assert.equal(get.headers.get('cache-control'), 'private, no-store')
  for (const body of [{ id: randomUUID(), site: 'ch', variant: 'late' }, { id: '*', site: 'ch' }, { id: randomUUID(), site: 'invalid' }]) {
    assert.equal((await POST(new Request(url, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body) }))).status, 400)
  }
  const body = JSON.stringify({id:randomUUID(),site:'ch'})
  assert.equal((await POST(new Request(url,{method:'POST',headers:{'content-type':'application/json','sec-fetch-site':'cross-site'},body}))).status,400)
  assert.equal((await DELETE(new Request(url,{method:'DELETE',headers:{'content-type':'application/json'},body}))).status,204)
  console.log('Actual Redis Lua integration passed')
} finally { clear() }
