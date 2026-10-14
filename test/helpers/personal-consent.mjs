import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'

// Isolate consent/input handling from payment, storage and the AI provider.
// Real paywall rejection is exercised in personal-fit-server.mjs.
const received = []
globalThis.consentTest = async req => {
  received.push(req)
  return { fits: [{ id: 'synthetic', score: 50 }], costMicroUsd: 0 }
}
const root = pathToFileURL(process.cwd() + '/')
registerHooks({
  resolve(s, c, next) { return next(s.startsWith('@/') ? new URL(s.slice(2), root).href : s, c) },
  load(url, c, next) {
    const source = url.endsWith('/lib/server/token.ts')
      ? 'export const bearer = () => null, verifyToken = () => ({ sid: "synthetic" }), issuedAt = () => 0, paymentMode = () => "stripe"'
      : url.endsWith('/lib/server/ai-budget.ts')
        ? 'export const aiAllowed = async () => true, purchaseSpent = async () => 0, purchaseAdd = async () => {}, PURCHASE_BUDGET_MICRO_USD = 100'
        : url.endsWith('/lib/server/personal-fit.ts')
          ? 'export const MAX_PERSONAL = 20, personalFits = globalThis.consentTest'
          : null
    return source ? { format: 'module', shortCircuit: true, source } : next(url, c)
  },
})
globalThis.fetch = () => { throw new Error('No network allowed') }
const { POST } = await import('../../app/api/personal-fit/route.ts')
const input = {
  programmes: [{ id: 'synthetic', field: 'physics', country: 'CH' }],
  profile: { riasec: [0, 1, 0, 0, 0, 0], subjects: ['math'], topics: {}, big5: { E: 5 } },
  locale: 'de-CH',
}
const send = body => POST(new Request('http://localhost/api/personal-fit', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }))
for (const consent of [undefined, false, 'true', 1]) {
  const res = await send({ ...input, consent })
  assert.equal(res.status, 400)
  assert.equal((await res.json()).error, 'consent-required')
  assert.equal(res.headers.get('cache-control'), 'private, no-store')
}
assert.equal(received.length, 0)
assert.equal((await send('not json')).status, 400)
assert.equal((await send('x'.repeat(128001))).status, 413)
const res = await send({ ...input, consent: true })
assert.equal(res.status, 200)
assert.equal(res.headers.get('cache-control'), 'private, no-store')
assert.equal(received.length, 1)
assert.equal('big5' in received[0].profile, false)
