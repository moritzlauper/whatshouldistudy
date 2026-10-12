import { test } from 'node:test'
import assert from 'node:assert/strict'
import { officialPageOf } from '../lib/official-pages.ts'
import { sameSite } from '../lib/official-facts.ts'

test('the checked sociology master pages in Bern and Neuchâtel are found', () => {
  assert.equal(officialPageOf({ name: 'Master Soziologie', level: 'master', institutionUrl: 'https://www.unibe.ch' }), 'https://www.wiso.unibe.ch/studies/study_programs/master_s_in_sociology/index_eng.html')
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

test('theory programmes whose official pages were found by search are listed; the rest stay without a page', () => {
  assert.equal(officialPageOf({ name: 'Bachelor Philosophie', level: 'bachelor', institutionUrl: 'https://www.usi.ch' }), 'https://www.usi.ch/it/formazione/bachelor/filosofia')
  assert.equal(officialPageOf({ name: 'Master Philosophie', level: 'master', institutionUrl: 'https://www.unine.ch' }), 'https://www.unine.ch/unine/home/formation/masters/lettres-et-sciences-humaines/master_flsh/philosophie/philosophy.html')
  assert.equal(officialPageOf({ name: 'Master Historische und Kulturwissenschaften (fächerübergreifend)', level: 'master', institutionUrl: 'https://unidistance.ch' }), 'https://unidistance.ch/en/history/master')
  assert.equal(officialPageOf({ name: 'Master Historische und Kulturwissenschaften (fächerübergreifend)', level: 'master', institutionUrl: 'https://ethz.ch' }), undefined)
  assert.equal(officialPageOf({ name: 'Master Philosophie', level: 'master', institutionUrl: 'https://www.uzh.ch' }), undefined)
})
