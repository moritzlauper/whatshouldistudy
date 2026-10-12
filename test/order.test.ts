import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blendedScore, combinedScore, orderByNumber } from '../lib/engine/programme-fit.ts'

test('a reading counts 80 %, the match 20 %; without a reading the match alone', () => {
  assert.equal(combinedScore(60, 80), 76)
  assert.equal(combinedScore(72), 72)
})

test('the answers average with the reading only where they are given', () => {
  assert.equal(blendedScore(76, { score: 60 }), 68)
  assert.equal(blendedScore(76, undefined), 76)
  assert.equal(blendedScore(undefined, { score: 60 }), undefined)
})

test('the best by its number comes first over all results, however far the match puts it down', () => {
  // By match alone p24 is 25th; by its reading it is the best of all.
  const all = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, match: 90 - i }))
  const scores: Record<string, number> = { p24: 100 }
  const ordered = orderByNumber(all, (id) => scores[id])
  assert.equal(ordered[0].id, 'p24')
  // A list of only the best twenty by match does not have it, so it would show a lower top.
  assert.equal(orderByNumber(all.slice(0, 20), (id) => scores[id])[0].id, 'p0')
})

test('equal numbers keep the order they came in, and the list given is not changed', () => {
  const items = [
    { id: 'a', match: 70 },
    { id: 'b', match: 70 },
    { id: 'c', match: 70 },
  ]
  assert.deepEqual(orderByNumber(items, () => undefined).map((p) => p.id), ['a', 'b', 'c'])
  assert.deepEqual(items.map((p) => p.id), ['a', 'b', 'c'])
})
