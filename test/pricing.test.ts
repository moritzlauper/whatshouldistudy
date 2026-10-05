import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatPrice, priceFor, stripeAmount } from '../lib/pricing.ts'

test('price follows the visitor country, with round local prices', () => {
  assert.deepEqual(priceFor('CH'), { amount: 15, currency: 'CHF' })
  assert.deepEqual(priceFor('DE'), { amount: 15, currency: 'EUR' })
  assert.deepEqual(priceFor('AT'), { amount: 15, currency: 'EUR' })
  assert.deepEqual(priceFor('GB'), { amount: 13, currency: 'GBP' })
  assert.deepEqual(priceFor('SE'), { amount: 169, currency: 'SEK' })
  assert.deepEqual(priceFor('BR'), { amount: 79, currency: 'BRL' })
  assert.deepEqual(priceFor('KE'), { amount: 15, currency: 'USD' })
  assert.deepEqual(priceFor(null, 'CHF'), { amount: 15, currency: 'CHF' })
})

test('Stripe amounts use the right unit', () => {
  assert.equal(stripeAmount({ amount: 15, currency: 'CHF' }), 1500)
  assert.equal(stripeAmount({ amount: 2300, currency: 'JPY' }), 2300)
  assert.equal(stripeAmount({ amount: 5990, currency: 'HUF' }), 599000)
  assert.match(formatPrice({ amount: 15, currency: 'CHF' }, 'de-CH'), /CHF\s?15/)
})
