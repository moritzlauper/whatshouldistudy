import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ORG_PRICES, ORG_TIERS, PRICES, REPORT_DISCOUNT, TRIAL_DAYS, discounted, formatPrice, orgBilled, orgPrice, priceFor, priceForSite, stripeAmount } from '../lib/pricing.ts'
import type { Price } from '../lib/pricing.ts'

/** The price before the launch discount. */
const regular = (p: Price) => ({ amount: p.regular ?? p.amount, currency: p.currency })

test('country sites keep their advertised currency even for visitors abroad', () => {
  for (const country of ['CH', 'DE', 'US', 'GB', null, undefined]) {
    assert.deepEqual(regular(priceForSite('de', country)), { amount: 17, currency: 'EUR' })
    assert.deepEqual(regular(priceForSite('at', country)), { amount: 17, currency: 'EUR' })
    assert.deepEqual(regular(priceForSite('ch', country)), { amount: 17, currency: 'CHF' })
  }
})

test('the global site uses the visitor currency, with USD when location is unknown', () => {
  assert.deepEqual(regular(priceForSite('global', 'DE')), { amount: 17, currency: 'EUR' })
  assert.deepEqual(regular(priceForSite('global', 'CH')), { amount: 17, currency: 'CHF' })
  assert.deepEqual(regular(priceForSite('global', 'GB')), { amount: 15, currency: 'GBP' })
  assert.deepEqual(regular(priceForSite('global', null)), { amount: 17, currency: 'USD' })
})

test('price follows the visitor country, with round local prices', () => {
  assert.deepEqual(regular(priceFor('CH')), { amount: 17, currency: 'CHF' })
  assert.deepEqual(regular(priceFor('DE')), { amount: 17, currency: 'EUR' })
  assert.deepEqual(regular(priceFor('AT')), { amount: 17, currency: 'EUR' })
  assert.deepEqual(regular(priceFor('GB')), { amount: 15, currency: 'GBP' })
  assert.deepEqual(regular(priceFor('SE')), { amount: 189, currency: 'SEK' })
  assert.deepEqual(regular(priceFor('BR')), { amount: 89, currency: 'BRL' })
  assert.deepEqual(regular(priceFor('KE')), { amount: 17, currency: 'USD' })
  assert.deepEqual(regular(priceFor(null, 'CHF')), { amount: 17, currency: 'CHF' })
})

test('Stripe amounts use the right unit', () => {
  assert.equal(stripeAmount({ amount: 15, currency: 'CHF' }), 1500)
  assert.equal(stripeAmount({ amount: 2300, currency: 'JPY' }), 2300)
  assert.equal(stripeAmount({ amount: 5990, currency: 'HUF' }), 599000)
  assert.match(formatPrice({ amount: 15, currency: 'CHF' }, 'de-CH'), /CHF\s?15/)
})

test('the one-time report is 20% off in every currency, rounded like the Stripe coupon', () => {
  assert.equal(REPORT_DISCOUNT, 20)
  assert.deepEqual(priceForSite('ch'), { amount: 13.6, currency: 'CHF', regular: 17 })
  assert.deepEqual(priceForSite('global', 'GB'), { amount: 12, currency: 'GBP', regular: 15 })
  assert.equal(discounted(2600, 'JPY'), 2080)
  assert.equal(discounted(1099, 'INR'), 879.2)
  for (const currency of Object.keys(PRICES)) {
    const p = priceFor(null, currency)
    assert.equal(stripeAmount(p), stripeAmount({ amount: PRICES[currency], currency }) * 0.8, currency)
  }
  assert.match(formatPrice({ amount: 13.6, currency: 'CHF' }, 'de-CH'), /CHF\s?13\.60/)
  assert.match(formatPrice({ amount: 17, currency: 'CHF' }, 'de-CH'), /CHF\s?17$/)
})

test('organisation plans are not discounted', () => {
  assert.deepEqual(orgPrice('school', 'year', 'CHF'), { currency: 'CHF', amount: 174 })
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
  assert.deepEqual(orgBilled('school', 'year', 'CHF'), { currency: 'CHF', amount: 2088 })
  assert.deepEqual(orgBilled('school', 'month', 'XYZ'), { currency: 'USD', amount: 209 })
})

test('organisation plans offer a 14-day free trial', () => {
  assert.equal(TRIAL_DAYS, 14)
  assert.deepEqual(ORG_TIERS, ['counsellor', 'school', 'institution'])
})
