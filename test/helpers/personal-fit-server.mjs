import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'

// Synthetic catalogue, facts and AI transport; no real data, credentials or network.
const calls = [], lookedUp = []
let facts = null
const programmes = Array.from({ length: 25 }, (_, i) => ({
  id: `p${i}`, country: 'CH', name: `Synthetic Sociology ${i}`, institution: 'Test University',
  fields: ['sociology'], focus: ['Social change'], level: 'master',
}))
globalThis.personalTest = {
  async countryFacts() { return facts },
  async findProgramme(country, field, id) {
    lookedUp.push(id)
    const p = programmes.find(p => p.id === id && p.country === country && p.fields.includes(field))
    return p ? { p } : null
  },
  async create(input) {
    const data = JSON.parse(input.messages[0].content)
    calls.push(data.programmes)
    return { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify({ programmes: data.programmes.map(p => ({
      id: p.id, score: 99, reasons: [`${p.name} relates to your topic of society through its assigned field.`],
    })) }) }] }
  },
}
const root = pathToFileURL(process.cwd() + '/')
registerHooks({
  resolve(s, c, next) {
    if (s === '@anthropic-ai/sdk') return { url: 'test:anthropic', shortCircuit: true }
    if (s === 'next/server') return next('next/server.js', c)
    return next(s.startsWith('@/') ? new URL(s.slice(2), root).href : s, c)
  },
  load(url, c, next) {
    const source = url === 'test:anthropic' ? 'export default class { messages = { create: globalThis.personalTest.create } }'
      : url.endsWith('/lib/server/facts-db.ts') ? 'export const countryFacts = globalThis.personalTest.countryFacts'
      : url.endsWith('/lib/server/programme.ts') ? 'export const findProgramme = globalThis.personalTest.findProgramme'
      : url.endsWith('/lib/server/ai-budget.ts') ? 'export const aiAllowed = async () => true, aiSpend = async () => 1, purchaseSpent = async () => 0, purchaseAdd = async () => {}, PURCHASE_BUDGET_MICRO_USD = 100'
      : null
    return source ? { format: 'module', shortCircuit: true, source } : next(url, c)
  },
})
process.env.NODE_ENV = 'test'
process.env.ANTHROPIC_API_KEY = 'synthetic-unused-by-mocked-transport'
globalThis.fetch = () => { throw new Error('No network allowed') }
const { personalFits } = await import('../../lib/server/personal-fit.ts')
const { POST } = await import('../../app/api/personal-fit/route.ts')
const { blendedScore } = await import('../../lib/engine/programme-fit.ts')

// The real endpoint still refuses an unauthenticated request before any AI work.
const response = await POST(new Request('http://localhost/api/personal-fit', { method: 'POST', body: '{}' }))
assert.equal(response.status, 401)
assert.equal(calls.length, 0)
const request = n => ({ programmes: programmes.slice(0, n).map(p => ({ id: p.id, country: p.country, field: 'sociology' })),
  profile: { riasec: [0, 1, 0, 1, 0, 0], subjects: ['hist'], topics: { society: .8 } }, locale: 'de-CH' })
for (const n of [1, 12, 25]) {
  calls.length = 0
  const result = await personalFits(request(n))
  assert.equal(result.fits.length, Math.min(n, 20))
  assert.ok(result.fits.every(f => f.thin && f.score === 50 && f.reasons.length > 0))
  assert.ok(result.fits.every(f => blendedScore(undefined, f) === undefined))
  assert.ok(result.fits.every(f => blendedScore(80, f) === 80))
  assert.ok(calls.every(group => group.length <= 5))
  for (const p of calls.flat()) {
    assert.equal(p.basis, 'catalogue')
    assert.equal(p.reading, null)
    assert.deepEqual(p.catalogue.focus, ['Social change'])
    assert.deepEqual(p.fieldConnections, [{ topic: 'society', fields: ['sociology'] }])
  }
}
const fact = { id: 'p0', enough: false, riasec: [0, 5, 0, 5, 0, 0], subjects: ['hist'], topics: ['sociology'], specialisations: [], distinctive: [], checks: { en: '', de: '', fr: '', it: '' } }
facts = { p0: fact, p1: { ...fact, id: 'p1', enough: true } }
calls.length = 0
const mixed = await personalFits(request(12))
assert.equal(mixed.fits.length, 12)
assert.equal(mixed.fits[0].thin, true)
assert.equal(mixed.fits[1].thin, false)
assert.ok(mixed.fits[1].score > 50)
assert.equal(calls.flat()[0].reading, null)
assert.equal(calls.flat()[1].basis, 'reading')
const invalid = { ...request(1), programmes: [{ id: 'unknown', country: 'CH', field: 'sociology' }] }
assert.equal(await personalFits(invalid), null)
assert.ok(lookedUp.includes('unknown'))
