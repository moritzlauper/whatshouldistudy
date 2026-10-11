import { test } from 'node:test'
import assert from 'node:assert/strict'
import { batches, costMicroUsd, hashText, isUnchanged, mergeFacts, normaliseFact, type PageMember, type StoredFact } from '../scrapers/lib/facts.ts'
import { parseHash, storeConfig } from '../lib/facts-store.ts'

const old: StoredFact = {
  id: 'a', url: 'https://www.unibe.ch/a', hash: 'h1', at: '2026-01-01', riasec: [0, 5, 0, 0, 0, 0], subjects: ['math'], enough: true,
  checks: { de: 'Alt.', fr: 'Ancien.', it: 'Vecchio.', en: 'Old.' },
}

test('a page counts as unchanged only with the same address and the same hash', () => {
  assert.equal(isUnchanged(old, 'https://www.unibe.ch/a', 'h1'), true)
  assert.equal(isUnchanged(old, 'https://www.unibe.ch/a', 'h2'), false)
  assert.equal(isUnchanged(old, 'https://www.unibe.ch/b', 'h1'), false)
  assert.equal(isUnchanged(undefined, 'https://www.unibe.ch/a', 'h1'), false)
  assert.equal(hashText('x'), hashText('x'))
  assert.notEqual(hashText('x'), hashText('y'))
})

test('a run keeps the readings of the programmes it did not read and replaces the ones it did', () => {
  const fresh: StoredFact = { ...old, hash: 'h2', at: '2026-02-01' }
  const other: StoredFact = { ...old, id: 'b' }
  const merged = mergeFacts({ a: old, b: other }, [fresh])
  assert.equal(merged.a.hash, 'h2')
  assert.equal(merged.b, other)
  assert.deepEqual(Object.keys(mergeFacts({ b: other }, [old])), ['a', 'b'])
})

test('only ids of the page that was sent are accepted, with known subjects and clamped scores', () => {
  const sent = new Map<string, PageMember>([['p1', { url: 'https://x.ch/p1', hash: 'h' }]])
  const f = normaliseFact({
    id: 'p1', riasec: { R: 9, I: -2, A: 'x', S: 3, E: 2.4, C: 1 }, subjects: ['math', 'astrology', 'math'], enough_info: true,
    checks: { de: ' Prüfen Sie «Zulassung». ', fr: 'Vérifier.', it: 'Verificare.', en: 'Check.'.repeat(100) },
  }, sent, '2026-03-01')
  assert.ok(f)
  assert.deepEqual(f.riasec, [5, 0, 0, 3, 2, 1])
  assert.deepEqual(f.subjects, ['math'])
  assert.equal(f.checks.en.length, 300)
  assert.equal(f.url, 'https://x.ch/p1')
  assert.equal(normaliseFact({ id: 'other', riasec: {}, enough_info: true }, sent, '2026-03-01'), null)
})

test('a page that says too little keeps no scores, subjects or checks', () => {
  const sent = new Map<string, PageMember>([['p1', { url: 'https://x.ch/p1', hash: 'h' }]])
  const f = normaliseFact({ id: 'p1', riasec: { R: 5 }, subjects: ['math'], checks: { de: 'x', fr: 'x', it: 'x', en: 'x' }, enough_info: false }, sent, '2026-03-01')
  assert.ok(f)
  assert.equal(f.enough, false)
  assert.deepEqual(f.riasec, [0, 0, 0, 0, 0, 0])
  assert.deepEqual(f.subjects, [])
  assert.deepEqual(f.checks, { de: '', fr: '', it: '', en: '' })
})

test('batches of five, and the cost of a response is counted with the cap prices', () => {
  assert.deepEqual(batches([1, 2, 3, 4, 5, 6], 5), [[1, 2, 3, 4, 5], [6]])
  assert.equal(costMicroUsd({ input_tokens: 1000, output_tokens: 100 }), 1000 + 500)
})

test('the store is read from the private database settings only, and a hash keeps the readings that parse', () => {
  assert.equal(storeConfig({}), null)
  assert.equal(storeConfig({ FACTS_REDIS_REST_URL: 'https://x.upstash.io' }), null)
  assert.deepEqual(storeConfig({ FACTS_REDIS_REST_URL: 'https://x.upstash.io', FACTS_REDIS_REST_TOKEN: 't' }), { url: 'https://x.upstash.io', token: 't' })
  const parsed = parseHash(['a', JSON.stringify(old), 'broken', '{nope', 'b', JSON.stringify({ ...old, id: 'b' })])
  assert.deepEqual(Object.keys(parsed), ['a', 'b'])
  assert.equal(parsed.a.hash, 'h1')
  assert.deepEqual(parseHash(null), {})
})
