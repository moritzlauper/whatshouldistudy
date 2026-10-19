import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIELDS } from '../lib/taxonomy/fields.ts'
import { fieldCareers, fieldName, fieldBlurb } from '../lib/site/labels.ts'

test('every field has French and Italian career examples, names and summaries', () => {
  for (const field of FIELDS) {
    for (const locale of ['fr-CH', 'it-CH'] as const) {
      const careers = fieldCareers(field.id, locale)
      assert.equal(careers.length, field.careers.length, `${locale}: ${field.id}`)
      assert.ok(careers.every((c) => c.trim().length > 0))
      assert.notDeepEqual(careers, field.careers, `${locale}: ${field.id} falls back to English`)
      assert.ok(fieldName(field.id, locale))
      assert.ok(fieldBlurb(field.id, locale))
    }
    assert.deepEqual(fieldCareers(field.id, 'en'), field.careers)
  }
  assert.ok(fieldCareers('philosophy', 'it-CH').includes('Avvocato (con ulteriori studi)'))
  assert.ok(fieldCareers('neuroscience', 'fr-CH').includes('Médecin (avec des études complémentaires)'))
  assert.deepEqual(fieldCareers('unknown', 'it-CH'), [])
})
