import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calibrated, correlation, fitSpread, localFit, toFacts, type LocalProfile, type ProgrammeFacts } from '../lib/engine/programme-fit.ts'

const profile: LocalProfile = { riasec: [0.3, 0.9, 0.2, 0.1, 0.1, 0.4], enjoy: { math: 5, phys: 4, lang: 2 } }
const research: ProgrammeFacts = { id: 'a', riasec: [1, 5, 1, 0, 0, 3], subjects: ['math', 'phys'], check: '', enough: true }
const care: ProgrammeFacts = { id: 'b', riasec: [0, 1, 0, 5, 1, 0], subjects: ['lang'], check: '', enough: true }

test('correlation: alike shapes near 1, opposite near -1, a flat profile gives 0', () => {
  assert.ok(Math.abs(correlation([1, 2, 3], [2, 4, 6]) - 1) < 1e-9)
  assert.ok(Math.abs(correlation([1, 2, 3], [3, 2, 1]) + 1) < 1e-9)
  assert.equal(correlation([1, 1, 1, 1, 1, 1], [1, 2, 3, 4, 5, 6]), 0)
})

test('a programme that matches the interests and the subjects scores well above one that does not', () => {
  assert.ok(localFit(research, profile).score >= 70)
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

test('a focused programme on what the person cares about beats a broad one that names it among many', () => {
  const profileT: LocalProfile = { riasec: [0, 0, 0, 0, 0, 0], enjoy: {}, topics: { 'statistics-data-science': 0.8, sociology: 0.2 } }
  const focused: ProgrammeFacts = { id: 'c', riasec: [0, 0, 0, 0, 0, 0], subjects: [], check: '', enough: true, topics: [], specialisations: [{ name: 'Data Analytics', topics: ['statistics-data-science'] }] }
  const broad: ProgrammeFacts = { id: 'd', riasec: [0, 0, 0, 0, 0, 0], subjects: [], check: '', enough: true, topics: ['sociology', 'religious-studies', 'philosophy', 'history'] }
  const fit = localFit(focused, profileT)
  assert.equal(fit.score, 66)
  assert.deepEqual(fit.reasons, [{ kind: 'specialisations', names: ['Data Analytics'] }, { kind: 'topics', keys: ['statistics-data-science'] }])
  assert.ok(fit.score > localFit(broad, profileT).score)
})

test('a page that names no topics is neutral, and one whose topics the person does not have falls behind', () => {
  const profileT: LocalProfile = { riasec: [0, 0, 0, 0, 0, 0], enjoy: {}, topics: { 'statistics-data-science': 1 } }
  assert.equal(localFit({ id: 'e', riasec: [0, 0, 0, 0, 0, 0], subjects: [], check: '', enough: true }, profileT).score, 50)
  assert.equal(localFit({ id: 'f', riasec: [0, 0, 0, 0, 0, 0], subjects: [], check: '', enough: true, topics: ['philosophy'] }, profileT).score, 30)
})

test('a fit is placed against the average programme: 50 is average, a spread above is 65, and too few programmes place nothing', () => {
  assert.equal(fitSpread([1, 2, 3]), null)
  assert.deepEqual(fitSpread(Array.from({ length: 10 }, () => 70)), { mean: 70, sd: 5 })
  const spread = fitSpread([40, 50, 60, 40, 50, 60, 40, 50, 60, 50])
  assert.ok(spread)
  assert.equal(calibrated(50, spread), 50)
  assert.equal(calibrated(spread.mean + spread.sd, spread), 65)
  assert.equal(calibrated(0, spread), 15)
  assert.ok(calibrated(spread.mean + 10 * spread.sd, spread) <= 85)
  assert.equal(calibrated(72.4, null), 72)
})
