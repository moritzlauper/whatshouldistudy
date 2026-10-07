import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ORG_PRICES, ORG_TIERS, PRICES, TRIAL_DAYS, formatPrice, orgBilled, priceFor, stripeAmount } from '../lib/pricing.ts'

test('price follows the visitor country, with round local prices', () => {
  assert.deepEqual(priceFor('CH'), { amount: 17, currency: 'CHF' })
  assert.deepEqual(priceFor('DE'), { amount: 17, currency: 'EUR' })
  assert.deepEqual(priceFor('AT'), { amount: 17, currency: 'EUR' })
  assert.deepEqual(priceFor('GB'), { amount: 15, currency: 'GBP' })
  assert.deepEqual(priceFor('SE'), { amount: 189, currency: 'SEK' })
  assert.deepEqual(priceFor('BR'), { amount: 89, currency: 'BRL' })
  assert.deepEqual(priceFor('KE'), { amount: 17, currency: 'USD' })
  assert.deepEqual(priceFor(null, 'CHF'), { amount: 17, currency: 'CHF' })
})

test('Stripe amounts use the right unit', () => {
  assert.equal(stripeAmount({ amount: 15, currency: 'CHF' }), 1500)
  assert.equal(stripeAmount({ amount: 2300, currency: 'JPY' }), 2300)
  assert.equal(stripeAmount({ amount: 5990, currency: 'HUF' }), 599000)
  assert.match(formatPrice({ amount: 15, currency: 'CHF' }, 'de-CH'), /CHF\s?15/)
})

test('organisation plans cover every currency, and monthly billing costs about 17% more', () => {
  for (const tier of ORG_TIERS) {
    for (const cur of Object.keys(PRICES)) {
      const year = ORG_PRICES[tier].year[cur]
      const month = ORG_PRICES[tier].month[cur]
      assert.ok(year > 0 && month > 0, `${tier} ${cur}`)
      const saving = 1 - year / month
      assert.ok(saving > 0.14 && saving < 0.2, `${tier} ${cur}: ${saving}`)
    }
  }
  assert.deepEqual(orgBilled('school', 'year', 'CHF'), { currency: 'CHF', amount: 4188 })
  assert.deepEqual(orgBilled('school', 'month', 'XYZ'), { currency: 'USD', amount: 419 })
})

test('organisation plans offer a 14-day free trial', () => {
  assert.equal(TRIAL_DAYS, 14)
  assert.deepEqual(ORG_TIERS, ['counsellor', 'school', 'institution'])
})
