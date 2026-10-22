import { test } from 'node:test'
import assert from 'node:assert/strict'
import { townName } from '../lib/site/labels.ts'

test('Swiss towns appear under the name each language searches for', () => {
  assert.equal(townName('Genève', 'de-CH'), 'Genf')
  assert.equal(townName('Genève', 'fr-CH'), 'Genève')
  assert.equal(townName('Zürich', 'fr-CH'), 'Zurich')
  assert.equal(townName('Basel', 'it-CH'), 'Basilea')
  assert.equal(townName('Luzern', 'en'), 'Lucerne')
  assert.equal(townName('Winterthur', 'fr-CH'), 'Winterthur')
})
