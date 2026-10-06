import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanUrl, consentRule, effectiveConsent, unmeasured } from '../lib/measure.ts'
import { fromStripeAmount } from '../lib/pricing.ts'

test('consent: EU/EEA and UK ask first, Switzerland and the rest inform', () => {
  for (const cc of ['DE', 'AT', 'FR', 'IT', 'NO', 'LI', 'GB', 'de']) assert.equal(consentRule(cc), 'opt-in', cc)
  for (const cc of ['CH', 'US', 'CA', 'AU', 'IN']) assert.equal(consentRule(cc), 'opt-out', cc)
  // No country header (local development, unknown network): ask.
  assert.equal(consentRule(null), 'opt-in')
  assert.equal(consentRule(''), 'opt-in')
})

test('consent: a stored choice wins over the country default', () => {
  assert.equal(effectiveConsent(null, 'opt-out'), 'granted')
  assert.equal(effectiveConsent(null, 'opt-in'), 'denied')
  assert.equal(effectiveConsent('denied', 'opt-out'), 'denied')
  assert.equal(effectiveConsent('granted', 'opt-in'), 'granted')
})

test('measured addresses keep campaign parameters and click ids only', () => {
  assert.equal(cleanUrl('https://whatshouldistudy.ch/unlocked?session_id=cs_live_123'), 'https://whatshouldistudy.ch/unlocked')
  assert.equal(
    cleanUrl('https://whatshouldistudy.ch/?utm_source=google&gclid=abc&ref=x&gad_source=1#r=shared'),
    'https://whatshouldistudy.ch/?utm_source=google&gclid=abc&gad_source=1',
  )
  assert.equal(cleanUrl('https://whatshouldistudy.com/start?added=youtube#sources'), 'https://whatshouldistudy.com/start')
})

test('OAuth callbacks are never measured', () => {
  assert.ok(unmeasured('/callback/google'))
  assert.ok(unmeasured('/whatshouldistudy/schweiz/callback/spotify'))
  assert.ok(!unmeasured('/results'))
})

test('Stripe amounts back to major units', () => {
  assert.deepEqual(fromStripeAmount(1500, 'chf'), { currency: 'CHF', amount: 15 })
  assert.deepEqual(fromStripeAmount(2300, 'jpy'), { currency: 'JPY', amount: 2300 })
})
