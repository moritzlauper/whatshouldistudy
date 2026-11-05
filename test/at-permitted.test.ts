import { test } from 'node:test'
import assert from 'node:assert/strict'
import { grazList, jkuList, siteFacts } from '../scrapers/sites/at-permitted.ts'
import { mergeSite, parseItem } from '../scrapers/at-hochschulen.ts'

const finder = `<script> studyFinder = {"courses":{"430":{"title":"Bachelor"},"432":{"title":"Master"},"436":{"title":"Doktorat\\/PhD"}},"studies":[
{"title":"Informatik","link":"\\/studium\\/studienarten\\/bachelordiplom\\/ba-informatik\\/","course":"430"},
{"title":"Artificial Intelligence","link":"\\/studium\\/studienarten\\/master\\/ma-artificial-intelligence\\/","course":"432"},
{"title":"Technische Wissenschaften","link":"\\/studium\\/studienarten\\/doktoratphd\\/doktorat-technische-wissenschaften\\/","course":"436"}]}; </script>`

test('JKU study finder: bachelor and master, no doctorates', () => {
  assert.deepEqual(jkuList(finder, 'https://www.jku.at/studium/studienangebot/'), [
    { name: 'Informatik', level: 'bachelor', url: 'https://www.jku.at/studium/studienarten/bachelordiplom/ba-informatik/' },
    { name: 'Artificial Intelligence', level: 'master', url: 'https://www.jku.at/studium/studienarten/master/ma-artificial-intelligence/' },
  ])
})

test('Uni Graz list: only links under the list path', () => {
  const html = `<a class="nav-link" href="/de/studium/masterstudien/angewandte-ethik/"><span class="cycle">Masterstudium</span> <span class="title">Angewandte Ethik</span></a>
  <a class="nav-link" href="/de/studium/bachelorstudien/biologie/"><span class="title">Biologie</span></a>`
  assert.deepEqual(grazList(html, 'https://www.uni-graz.at/de/studium/masterstudien/', 'master'), [
    { name: 'Angewandte Ethik', level: 'master', url: 'https://www.uni-graz.at/de/studium/masterstudien/angewandte-ethik/' },
  ])
})

test('key facts of JKU and Graz programme pages', () => {
  const jku = `<div class="info_element"> <p><strong>Abschluss</strong></p> <p>Bachelor of Science (BSc)</p> </div>
  <div class="info_element"> <p><strong>Studiendauer</strong></p> <p>6 Semester</p> </div>
  <div class="info_element"> <p><strong>ECTS</strong></p> <p>180&nbsp;Punkte</p> </div>
  <div class="info_element"> <p><strong>Sprache</strong></p> <p><a href="#">Deutsch (Level B2)</a><br><br>(Einige Lehrveranstaltungen werden auf Englisch angeboten)</p> </div>
  <div class="info_element"> <p><strong>Studienort</strong></p> <p>Linz und Graz</p> </div>
  <div class="info_element"> <p><strong>Studienform</strong></p> <p>Vollzeit/Berufsbegleitend</p> </div>`
  assert.deepEqual(siteFacts(jku), { degreeTitle: 'Bachelor of Science (BSc)', durationYears: 3, ects: 180, languages: ['de'], otherLanguages: ['en'], cities: ['Linz', 'Graz'], mode: 'both' })
  const graz = `<div class="info-item"> <h3>Akademischer Grad</h3> <p>Master of Arts „MA“</p></div>
  <div class="info-item"> <h3>ECTS</h3> <p>120</p></div><div class="info-item"> <h3>Studiendauer</h3> <p>4 Semester</p></div>
  <div class="info-item"> <h3>Unterrichtssprache</h3> <p> Englisch </p></div>`
  assert.deepEqual(siteFacts(graz), { degreeTitle: 'Master of Arts MA', ects: 120, durationYears: 2, languages: ['en'] })
})

test('website programmes enrich the dataset row and keep its id; new ones are added', () => {
  const at = new Date().toISOString()
  const row = parseItem({ id: '42', name: 'Angewandte Ethik', institution: 'Universität Graz', kind: 'Masterstudium', place: 'Graz', hochschule: 'Universität', link: 'https://www.uni-graz.at/de/studium/masterstudien/angewandte-ethik' }, at)!
  const programmes = [row]
  const r = mergeSite(programmes, [
    { institution: 'Universität Graz', name: 'Angewandte Ethik', level: 'master', url: 'https://www.uni-graz.at/de/studium/masterstudien/angewandte-ethik/', ects: 120, languages: ['de'], durationYears: 2 },
    { institution: 'Universität Graz', name: 'Philosophie', level: 'bachelor', url: 'https://www.uni-graz.at/de/studium/bachelorstudien/philosophie/', ects: 180, languages: ['de'] },
  ], at)
  assert.deepEqual(r, { matched: 1, added: 1 })
  assert.equal(programmes[0].id, row.id)
  assert.equal(programmes[0].ects, 120)
  assert.deepEqual(programmes[0].languages, ['de'])
  assert.equal(programmes[1].name, 'Philosophie')
  assert.equal(programmes[1].source, 'at-studienwahl')
})

test('the facts run reads only the Austrian universities that agreed', async () => {
  const { AT_READABLE, mayReadPage } = await import('../lib/programme-countries.ts')
  const { AT_PERMITTED } = await import('../scrapers/sites/at-permitted.ts')
  assert.deepEqual(AT_READABLE, AT_PERMITTED.map((p) => p.institution))
  assert.equal(mayReadPage({ country: 'AT', institution: 'Universität Graz' }), true)
  assert.equal(mayReadPage({ country: 'AT', institution: 'Universität Wien' }), false)
  assert.equal(mayReadPage({ country: 'CH', institution: 'ETH Zürich' }), true)
})
