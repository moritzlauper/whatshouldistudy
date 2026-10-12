import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bulkDays, isNewProgramme } from '../lib/newness.ts'

test('a day on which many programmes were first seen at once is a bulk day', () => {
  const dates = [...Array(150).fill('2026-10-09'), ...Array(20).fill('2026-10-11'), ...Array(300).fill('2000-01-01'), undefined]
  const bulk = bulkDays(dates)
  assert.deepEqual([...bulk], ['2026-10-09'])
})

test('only programmes first seen recently, outside a bulk day, count as new', () => {
  const bulk = new Set(['2026-10-09'])
  const cutoff = '2026-07-14'
  assert.equal(isNewProgramme('2026-10-11', cutoff, bulk), true)
  assert.equal(isNewProgramme('2026-10-09', cutoff, bulk), false)
  assert.equal(isNewProgramme('2026-06-01', cutoff, bulk), false)
  assert.equal(isNewProgramme('2000-01-01', cutoff, bulk), false)
  assert.equal(isNewProgramme(undefined, cutoff, bulk), false)
})
