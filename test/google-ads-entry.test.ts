import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isGoogleAdsEntry } from '../lib/google-ads-entry.ts'

test('Google ad click IDs and paid Google campaigns select the purchase entry', () => {
  for (const query of [
    'gclid=example', 'gbraid=example', 'wbraid=example',
    'utm_source=google&utm_medium=cpc',
    'utm_source=Google&utm_medium=Paid_Search',
    'utm_source=google&utm_medium=display',
  ]) assert.equal(isGoogleAdsEntry(new URLSearchParams(query)), true, query)
})

test('direct, organic, other networks and empty tracking parameters keep the regular entry', () => {
  for (const query of [
    '', 'utm_source=google', 'utm_source=google&utm_medium=organic',
    'utm_source=bing&utm_medium=cpc', 'utm_source=newsletter&utm_medium=email',
    'gclid=&gbraid=%20&wbraid=', 'gad_source=1', '_ga=example',
    'utm_campaign=google', 'utm_source=notgoogle&utm_medium=cpc',
  ]) assert.equal(isGoogleAdsEntry(new URLSearchParams(query)), false, query)
})
