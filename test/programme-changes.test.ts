import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COMPARE_TOP, changeSummary, programmeChanges } from '../lib/engine/programme-changes.ts'

const entry = (id: string, score: number) => ({ id, name: `Studiengang ${id}`, institution: `Hochschule ${id}`, score })

test('the comparison covers the 60 best programmes', () => {
  assert.equal(COMPARE_TOP, 60)
})

test('a programme that Claude lifts moves up, keeps its place before, and the rows follow the new order', () => {
  const before = [entry('a', 80), entry('b', 79), entry('c', 70), entry('d', 60)]
  const after = [
    { ...entry('c', 88), computed: 70, reasons: ['Der Kanal passt zu deinem Interesse.'] },
    { ...entry('a', 78), computed: 80, reasons: ['Die Schwerpunkte treffen deine Themen nur teilweise.'] },
    { ...entry('b', 79), computed: 79, reasons: [] },
    { ...entry('e', 65), computed: 65, reasons: [] },
  ]
  const rows = programmeChanges(before, after)
  assert.deepEqual(rows.map((r) => [r.id, r.before?.rank ?? null, r.after.rank, r.after.score]), [
    ['c', 3, 1, 88],
    ['a', 1, 2, 78],
    ['b', 2, 3, 79],
    ['e', null, 4, 65],
  ])
  assert.deepEqual(rows[0].after.reasons, ['Der Kanal passt zu deinem Interesse.'])
  assert.deepEqual(changeSummary(rows), { up: 1, down: 2, added: 1, changed: 2 })
})

test('the place before counts the whole list of matches, not only the compared programmes', () => {
  const before = Array.from({ length: 120 }, (_, i) => entry(`p${i}`, 100 - i / 10))
  const rows = programmeChanges(before, [{ ...entry('p80', 90), computed: 90, reasons: [] }])
  assert.equal(rows[0].before?.rank, 81)
  assert.equal(rows[0].after.rank, 1)
})
