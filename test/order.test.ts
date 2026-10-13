import { test } from 'node:test'
import assert from 'node:assert/strict'
import { combinedScore, orderByNumber, orderedFieldIds, shownScore } from '../lib/engine/programme-fit.ts'

test('the profile counts 80 %, the reading 20 %; without a reading the profile alone', () => {
  assert.equal(combinedScore(60, 80), 64)
  assert.equal(combinedScore(72), 72)
})

test('the one number is the AI’s comparison where it rated the programme and the reading is not thin, otherwise the profile with the reading', () => {
  assert.equal(shownScore(76, 60, true), 73)
  assert.equal(shownScore(76, 60, true, { score: 40 }), 40)
  assert.equal(shownScore(76, 60, true, { score: 40, thin: true }), 73)
  assert.equal(shownScore(76, undefined, false), 76)
})

test('city-search results descend by their visible points across fields, before and after AI', () => {
  const items = [
    { id: 'politics', match: 52, fields: ['political-science'], matchedField: 'sociology' },
    { id: 'education', match: 64, fields: ['psychology'], matchedField: 'psychology' },
    { id: 'applied', match: 60, fields: ['psychology'], matchedField: 'psychology' },
    { id: 'unread', match: 50, fields: ['sociology'], matchedField: 'sociology' },
  ]
  const content = { politics: 52, education: 64, applied: 60 } as Record<string, number>
  const ai = { education: { score: 34 }, applied: { score: 90 } } as Record<string, { score: number }>
  const before = (p: { id: string; match: number }) => shownScore(p.match, content[p.id], true)
  assert.deepEqual(orderByNumber(items, before).map((p) => p.id), ['education', 'applied', 'politics', 'unread'])
  const after = (p: { id: string; match: number }) => shownScore(p.match, content[p.id], true, ai[p.id])
  const ordered = orderByNumber(items, after)
  // The AI's number replaces the profile-and-reading number, so a low rating moves a programme down.
  assert.deepEqual(ordered.map((p) => p.id), ['applied', 'politics', 'unread', 'education'])
  const visible = ordered.map(after)
  assert.deepEqual(visible, [...visible].sort((a, b) => b - a))
})

test('the best by its number comes first over all results, however far the match puts it down', () => {
  // Equal profile matches: p24 stands on a later page until its number is known.
  const all = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, match: 90 }))
  const shown = (p: { id: string; match: number }) => (p.id === 'p24' ? 100 : p.match)
  assert.equal(orderByNumber(all, shown)[0].id, 'p24')
  // A list of only the best twenty by match does not have it, so it would show a lower top.
  assert.equal(orderByNumber(all.slice(0, 20), shown)[0].id, 'p0')
})

test('a higher number comes first even from a lower field; the field only decides between equal numbers', () => {
  const fields = orderedFieldIds([{ id: 'sociology', score: 96 }, { id: 'psychology', score: 94 }, { id: 'religious-studies', score: 85 }])
  const sociology = { id: 'soc', match: 90, fields: ['sociology'], matchedField: 'sociology' }
  const theology = { id: 'theology', match: 88, fields: ['religious-studies'], matchedField: 'religious-studies' }
  const numbers: Record<string, number> = { soc: 68, theology: 79 }
  assert.equal(orderByNumber([sociology, theology], (p) => numbers[p.id], fields)[0].id, 'theology')
  assert.equal(orderByNumber([sociology, theology], () => 70, fields)[0].id, 'soc')
})

test('equal numbers keep the order they came in, and the list given is not changed', () => {
  const items = [
    { id: 'a', match: 70 },
    { id: 'b', match: 70 },
    { id: 'c', match: 70 },
  ]
  assert.deepEqual(orderByNumber(items, () => 70).map((p) => p.id), ['a', 'b', 'c'])
  assert.deepEqual(items.map((p) => p.id), ['a', 'b', 'c'])
})

test('programme content counts across all pages, not only within the preferred field', () => {
  const all = Array.from({ length: 80 }, (_, i) => ({ id: `soc${i}`, match: 90, fields: ['sociology'], matchedField: 'sociology' }))
  const ordered = orderByNumber(all, (p) => (p.id === 'soc79' ? 85 : 50), ['sociology'])
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
