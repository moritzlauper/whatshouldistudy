import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cityMatches, foldText } from '../lib/city-search.ts'

test('foldText drops accents and case, so typing without umlauts still finds the city', () => {
  assert.equal(foldText('Zürich'), 'zurich')
  assert.equal(foldText('Genève'), 'geneve')
  assert.equal(foldText('Straße'), 'strasse')
})

test('cityMatches finds any part of the name and ignores accents and case', () => {
  assert.equal(cityMatches('Zürich', 'zuri'), true)
  assert.equal(cityMatches('Zürich', 'ZUERICH'), false)
  assert.equal(cityMatches('South Kensington', 'kensington'), true)
  assert.equal(cityMatches('Bern', 'Basel'), false)
  assert.equal(cityMatches(undefined, 'basel'), false)
  assert.equal(cityMatches(undefined, ''), true)
})
