import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spreadByField } from '../lib/engine/spread.ts'

test('the candidate pool takes turns between fields instead of filling up with one', () => {
  const sorted = [
    { id: 'a1', matchedField: 'soz' },
    { id: 'a2', matchedField: 'soz' },
    { id: 'a3', matchedField: 'soz' },
    { id: 'b1', matchedField: 'recht' },
    { id: 'c1', matchedField: 'psy' },
  ]
  assert.deepEqual(spreadByField(sorted).map((p) => p.id), ['a1', 'b1', 'c1', 'a2', 'a3'])
  // Nothing is lost or repeated, and an empty list stays empty.
  assert.equal(spreadByField(sorted).length, sorted.length)
  assert.deepEqual(spreadByField([]), [])
})
