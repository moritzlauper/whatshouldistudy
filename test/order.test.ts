import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blendedScore, combinedScore, orderByNumber, orderedFieldIds } from '../lib/engine/programme-fit.ts'

test('the profile counts 80 %, the reading 20 %; without a reading the profile alone', () => {
  assert.equal(combinedScore(60, 80), 64)
  assert.equal(combinedScore(72), 72)
})

test('the answers average with the reading only where they are given', () => {
  assert.equal(blendedScore(76, { score: 60 }), 68)
  assert.equal(blendedScore(76, undefined), 76)
  assert.equal(blendedScore(undefined, { score: 60 }), undefined)
})

test('the best by its number comes first over all results, however far the match puts it down', () => {
  // Equal profile matches keep p24 on a later page until its content is compared.
  const all = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, match: 90 }))
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


test('Sociology stays first when theology has a higher reading but is a lower field', () => {
  const fields = orderedFieldIds([{ id: 'sociology', score: 96 }, { id: 'psychology', score: 94 }, { id: 'religious-studies', score: 85 }])
  const sociology = { id: 'soc', match: 90, fields: ['sociology'], matchedField: 'sociology' }
  const theology = { id: 'theology', match: 88, fields: ['religious-studies'], matchedField: 'religious-studies' }
  const items = [theology, sociology]
  const read = (id: string) => id === 'theology' ? 100 : 15
  assert.equal(orderByNumber(items, read, fields)[0].id, 'soc')
  assert.equal(orderByNumber(items, (id) => id === 'soc' ? undefined : 100, fields)[0].id, 'soc')
  // Same field priority when the optional comparison changes its content score.
  assert.equal(orderByNumber(items, () => 100, fields)[0].id, 'soc')
})

test('programme content refines programmes within the preferred field across all pages', () => {
  const all = Array.from({ length: 80 }, (_, i) => ({ id: `soc${i}`, match: 90, fields: ['sociology'], matchedField: 'sociology' }))
  const ordered = orderByNumber(all, (id) => id === 'soc79' ? 85 : 50, ['sociology'])
  assert.equal(ordered[0].id, 'soc79')
  assert.equal(ordered.length, 80)
})

test('a secondary sociology tag cannot turn a primarily theological programme into the best sociology degree', () => {
  const items = [
    { id: 'theology', match: 98, fields: ['religious-studies', 'sociology'], matchedField: 'sociology' },
    { id: 'soc', match: 90, fields: ['sociology'], matchedField: 'sociology' },
  ]
  assert.equal(orderByNumber(items, () => 100, ['sociology', 'religious-studies'])[0].id, 'soc')
})

test('another preferred field is used when sociology has no available programme; no field is blacklisted', () => {
  const items = [
    { id: 'theology', match: 98, fields: ['religious-studies'], matchedField: 'religious-studies' },
    { id: 'psy', match: 90, fields: ['psychology'], matchedField: 'psychology' },
  ]
  assert.equal(orderByNumber(items, () => 100, ['sociology', 'psychology', 'religious-studies'])[0].id, 'psy')
  assert.equal(orderByNumber(items, () => 100, ['religious-studies', 'psychology'])[0].id, 'theology')
})
