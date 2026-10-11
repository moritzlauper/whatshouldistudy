import { test } from 'node:test'
import assert from 'node:assert/strict'
import { correlation, localFit, toFacts, type LocalProfile, type ProgrammeFacts } from '../lib/engine/programme-fit.ts'

const profile: LocalProfile = { riasec: [0.3, 0.9, 0.2, 0.1, 0.1, 0.4], enjoy: { math: 5, phys: 4, lang: 2 } }
const research: ProgrammeFacts = { id: 'a', riasec: [1, 5, 1, 0, 0, 3], subjects: ['math', 'phys'], check: '', enough: true }
const care: ProgrammeFacts = { id: 'b', riasec: [0, 1, 0, 5, 1, 0], subjects: ['lang'], check: '', enough: true }

test('correlation: alike shapes near 1, opposite near -1, a flat profile gives 0', () => {
  assert.ok(Math.abs(correlation([1, 2, 3], [2, 4, 6]) - 1) < 1e-9)
  assert.ok(Math.abs(correlation([1, 2, 3], [3, 2, 1]) + 1) < 1e-9)
  assert.equal(correlation([1, 1, 1, 1, 1, 1], [1, 2, 3, 4, 5, 6]), 0)
})

test('a programme that matches the interests and the subjects scores well above one that does not', () => {
  assert.ok(localFit(research, profile).score >= 80)
  assert.ok(localFit(care, profile).score < 50)
})

test('the reasons name the interest type and the liked subjects that match', () => {
  assert.deepEqual(localFit(research, profile).reasons, [
    { kind: 'riasec', types: ['I'] },
    { kind: 'subjects', subjects: ['math', 'phys'] },
  ])
  assert.deepEqual(localFit(care, profile).reasons, [])
})

test('a programme the page says too little about is neutral, with no reasons', () => {
  assert.deepEqual(localFit({ ...research, enough: false }, profile), { score: 50, reasons: [] })
})

test('toFacts keeps only known subjects and ids, and clamps the scores', () => {
  const allowed = new Set(['a'])
  const f = toFacts({ id: 'a', riasec: { R: 9, I: -2, A: 'x', S: 3, E: 2.4, C: 1 }, subjects: ['math', 'astrology', 'math'], check: 'Check it.', enough_info: true }, allowed)
  assert.deepEqual(f, { id: 'a', riasec: [5, 0, 0, 3, 2, 1], subjects: ['math'], check: 'Check it.', enough: true })
  assert.equal(toFacts({ id: 'zzz', riasec: {}, subjects: [], check: '', enough_info: true }, allowed), null)
  assert.deepEqual(toFacts({ id: 'a', riasec: { R: 5 }, subjects: ['math'], check: '', enough_info: false }, allowed)?.subjects, [])
})
