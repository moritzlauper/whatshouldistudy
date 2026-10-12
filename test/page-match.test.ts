import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coreName, headingsOf, levelsIn, namesProgramme, NOT_A_PROGRAMME, plain, sitemapLocs, STUDY_PATH } from '../lib/page-match.ts'

test('names are compared in plain letters, without the level word or the brackets', () => {
  assert.equal(plain('Historische und Kulturwissenschaften (fächerübergreifend)'), 'historische und kulturwissenschaften facherubergreifend')
  assert.equal(coreName('Master Historische und Kulturwissenschaften (fächerübergreifend)'), 'historische und kulturwissenschaften')
  assert.equal(coreName('Bachelor Philosophie'), 'philosophie')
})

test('a page names the programme at its own level, and not at the other one', () => {
  assert.equal(namesProgramme({ name: 'Master Philosophie', level: 'master' }, 'Master Philosophie | Universität Neuenburg', ''), true)
  assert.equal(namesProgramme({ name: 'Bachelor Philosophie', level: 'bachelor' }, 'Master Philosophie', ''), false)
  assert.equal(namesProgramme({ name: 'Master Geschichte', level: 'master' }, 'Kunstgeschichte MA', ''), false)
  assert.equal(namesProgramme({ name: 'Bachelor Soziologie', level: 'bachelor' }, 'Bachelor und Master Soziologie', 'Soziologie'), true)
})

test('the title and the first heading of a page are read, with entities decoded', () => {
  assert.deepEqual(headingsOf('<html><head><title>Master Philosophie &amp; Ethik</title></head><body><h1>Philosophie</h1></body></html>'), { title: 'Master Philosophie & Ethik', heading: 'Philosophie' })
})

test('a sitemap gives its addresses, whatever the spacing', () => {
  assert.deepEqual(sitemapLocs('<urlset><url><loc>https://a.ch/studium/x</loc></url><url><loc> https://a.ch/y?a=1&amp;b=2 </loc></url></urlset>'), ['https://a.ch/studium/x', 'https://a.ch/y?a=1&b=2'])
})

test('study pages are recognised by their address in the languages of the country', () => {
  assert.equal(STUDY_PATH.test('/de/studium/bachelor/philosophie'), true)
  assert.equal(STUDY_PATH.test('/fr/formation/master/philosophie'), true)
  assert.equal(STUDY_PATH.test('/it/formazione/bachelor/filosofia'.replace('formazione', 'offerta')), true)
  assert.equal(STUDY_PATH.test('/news/2026/presse'), false)
})

test('the level counts at the start of a compound word, and the title has to name the programme', () => {
  assert.ok(levelsIn('Masterstudium Sekundarstufe I').has('master'))
  assert.ok(levelsIn('Bachelorstudium Sport').has('bachelor'))
  assert.equal(namesProgramme({ name: 'Bachelor Informatik', level: 'bachelor' }, 'Plus-Studiengang BSc FH in Marketing', 'Informatik Wirtschaftsinformatik'), false)
})

test('events, news and single people are not a programme page', () => {
  assert.equal(NOT_A_PROGRAMME.test('/veranstaltungen/masterfeier-sek-i'), true)
  assert.equal(NOT_A_PROGRAMME.test('/news/2026/diplomfeier'), true)
  assert.equal(NOT_A_PROGRAMME.test('/studium/film'), false)
})
