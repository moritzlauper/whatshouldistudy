import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIELDS } from '../lib/taxonomy/fields.ts'
import { FIELD_SLUG_DE } from '../lib/site/slugs-de.ts'

test('every field has its own German address', () => {
  const slugs = FIELDS.map((f) => FIELD_SLUG_DE[f.id])
  assert.deepEqual(FIELDS.filter((f) => !FIELD_SLUG_DE[f.id]).map((f) => f.id), [])
  assert.equal(new Set(slugs).size, slugs.length)
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/)
})

test('no German address is the English id of another field', () => {
  for (const f of FIELDS) {
    const other = FIELDS.find((x) => x.id === FIELD_SLUG_DE[f.id] && x.id !== f.id)
    assert.equal(other, undefined, `${f.id} → ${FIELD_SLUG_DE[f.id]}`)
  }
})
