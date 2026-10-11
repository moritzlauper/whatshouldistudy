import { test } from 'node:test'
import assert from 'node:assert/strict'
import { officialPageOf } from '../lib/official-pages.ts'
import { sameSite } from '../lib/official-facts.ts'

test('the checked sociology master pages in Bern and Neuchâtel are found', () => {
  assert.equal(officialPageOf({ name: 'Master Soziologie', level: 'master', institutionUrl: 'https://www.unibe.ch' }), 'https://www.soz.unibe.ch/studium/studienprogramme/master_soziologie/index_ger.htm')
  assert.equal(officialPageOf({ name: 'Master Sociologie', level: 'master', institutionUrl: 'https://www.unine.ch' }), 'https://www.unine.ch/socio/formation/sociologie-master')
})

test('other programmes and institutions get no entry', () => {
  assert.equal(officialPageOf({ name: 'Bachelor Soziologie', level: 'bachelor', institutionUrl: 'https://www.unibe.ch' }), undefined)
  assert.equal(officialPageOf({ name: 'Master Soziologie', level: 'master', institutionUrl: 'https://www.unizh.ch' }), undefined)
  assert.equal(officialPageOf({ name: 'Master Soziologie', level: 'master' }), undefined)
})

test('each checked page is on its institution’s own site, so the reading accepts it', () => {
  const bern = officialPageOf({ name: 'Master Soziologie', level: 'master', institutionUrl: 'https://www.unibe.ch' })!
  assert.equal(sameSite(bern, 'https://www.unibe.ch'), true)
})
