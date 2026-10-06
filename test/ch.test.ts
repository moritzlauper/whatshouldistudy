import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectColumns, parseRows } from '../scrapers/ch-bfs.ts'
import { findChInstitution } from '../lib/ch-institutions.ts'
import { fieldsForTitle } from '../scrapers/lib/common.ts'
import { routes } from '../lib/site/config.ts'
import { mountInfo } from '../lib/site/kit.ts'
import { fieldName } from '../lib/site/labels.ts'
import { switchHref } from '../lib/site/switch.ts'

test('Swiss French and Italian paths resolve to their local route tree', () => {
  assert.equal(mountInfo('fr').locale, 'fr-CH')
  assert.equal(mountInfo('it').locale, 'it-CH')
  assert.equal(routes('ch', '', 'fr-CH').home, '/fr')
  assert.equal(routes('ch', '', 'fr-CH').start, '/fr/start')
  assert.equal(routes('ch', '', 'it-CH').start, '/it/start')
  assert.equal(routes('ch', '', 'it-CH').privacy, '/it/datenschutz')
  assert.equal(routes('ch', '', 'fr-CH').field('computer-science'), '/fr/faecher/informatik')
  assert.equal(routes('ch', '', 'de-CH').home, '/')
  assert.equal(fieldName('computer-science', 'fr-CH'), 'Informatique')
  assert.equal(fieldName('computer-science', 'it-CH'), 'Informatica')
})

test('Swiss institutions are found under BFS spellings', () => {
  assert.equal(findChInstitution('ETH Zürich')?.id, 'ethz')
  assert.equal(findChInstitution('EPF Lausanne')?.id, 'epfl')
  assert.equal(findChInstitution('Universität St. Gallen')?.id, 'unisg')
  assert.equal(findChInstitution('Pädagogische Hochschule FHNW')?.id, 'fhnw-ph')
  assert.equal(findChInstitution('Zürcher Hochschule für Angewandte Wissenschaften')?.id, 'zfh')
  assert.equal(findChInstitution('Hochschule Irgendwo'), undefined)
})

test('BFS subject names map to fields', () => {
  const f = (t: string) => fieldsForTitle(t).fields[0]
  assert.equal(f('Maschineningenieurwesen'), 'mechanical-engineering')
  assert.equal(f('Humanmedizin'), 'medicine')
  assert.equal(f('Rechtswissenschaft'), 'law')
  assert.equal(f('Betriebswirtschaftslehre'), 'business-management')
  assert.equal(f('Deutsche Sprach- und Literaturwissenschaft'), 'literature')
  assert.equal(f('Soziale Arbeit'), 'social-work')
  assert.equal(f('Erdwissenschaften'), 'earth-sciences')
  assert.equal(f('Schulische Heilpädagogik'), 'education')
})

test('long-format BFS rows become programmes for the latest year', () => {
  const rows = [
    { Jahr: '2023', Hochschule: 'ETH Zürich', Fachrichtung: 'Informatik', Studienstufe: 'Bachelor', Wert: '1500' },
    { Jahr: '2024', Hochschule: 'ETH Zürich', Fachrichtung: 'Informatik', Studienstufe: 'Bachelor', Wert: '1600' },
    { Jahr: '2024', Hochschule: 'ETH Zürich', Fachrichtung: 'Informatik', Studienstufe: 'Master', Wert: '900' },
    { Jahr: '2024', Hochschule: 'ETH Zürich', Fachrichtung: 'Informatik', Studienstufe: 'Doktorat', Wert: '300' },
    { Jahr: '2024', Hochschule: 'Total', Fachrichtung: 'Informatik', Studienstufe: 'Bachelor', Wert: '5000' },
    { Jahr: '2024', Hochschule: 'Hochschule Irgendwo', Fachrichtung: 'Informatik', Studienstufe: 'Bachelor', Wert: '10' },
    { Jahr: '2024', Hochschule: 'Universität Zürich', Fachrichtung: 'Design', Studienstufe: 'Bachelor', Wert: '0' },
  ]
  assert.equal(detectColumns(Object.keys(rows[0])).value, 'Wert')
  const { programmes, unmatched } = parseRows(rows, '2026-01-01')
  assert.equal(programmes.length, 2)
  const b = programmes.find((p) => p.level === 'bachelor')!
  assert.equal(b.capacity, 1600)
  assert.equal(b.tuition?.domestic, 1460)
  assert.deepEqual(b.fields, ['computer-science'])
  assert.ok(b.admission?.includes('Matura'))
  assert.ok(unmatched.has('Hochschule Irgendwo'))
})

test('PXWeb answers become rows; umbrella schools are split', async () => {
  const { pxQuery, pxRows, splitUmbrella } = await import('../scrapers/ch-bfs.ts')
  const vars = [
    { code: 'Jahr', text: 'Jahr', values: ['2023/24', '2024/25'], valueTexts: ['2023/24', '2024/25'], time: true },
    { code: 'Hochschule', text: 'Hochschule', values: ['0', '1'], valueTexts: ['Hochschule - Total', 'Zürcher Fachhochschule'] },
    { code: 'Fachrichtung', text: 'Fachrichtung', values: ['10', '11'], valueTexts: ['Musik', 'Lehrkräfteausbildung Primarstufe'] },
    { code: 'Studienstufe', text: 'Studienstufe', values: ['B'], valueTexts: ['Bachelor'] },
    { code: 'Geschlecht', text: 'Geschlecht', values: ['T', 'F'], valueTexts: ['Geschlecht - Total', 'Frau'] },
  ]
  const q = pxQuery(vars)
  assert.deepEqual(q.query.find((x) => x.code === 'Jahr')?.selection.values, ['2024/25'])
  assert.deepEqual(q.query.find((x) => x.code === 'Geschlecht')?.selection.values, ['T'])
  const rows = pxRows(vars, {
    columns: [
      { code: 'Jahr', text: 'Jahr', type: 't' },
      { code: 'Hochschule', text: 'Hochschule', type: 'd' },
      { code: 'Fachrichtung', text: 'Fachrichtung', type: 'd' },
      { code: 'Studienstufe', text: 'Studienstufe', type: 'd' },
      { code: 'Studierende', text: 'Studierende', type: 'c' },
    ],
    data: [
      { key: ['2024/25', '1', '10', 'B'], values: ['420'] },
      { key: ['2024/25', '1', '11', 'B'], values: ['900'] },
      { key: ['2024/25', '0', '10', 'B'], values: ['2000'] },
    ],
  })
  assert.equal(rows[0].Hochschule, 'Zürcher Fachhochschule')
  const { programmes } = parseRows(rows, '2026-01-01')
  const ids = programmes.map((p) => p.institution).sort()
  assert.deepEqual(ids, ['Pädagogische Hochschule Zürich', 'Zürcher Hochschule der Künste'])
  const zhaw = findChInstitution('ZHAW')!
  assert.equal(splitUmbrella(zhaw, 'ZHAW', ['music']).id, 'zfh')
})

test('the newest year is chosen by its label, BFS short codes are matched', async () => {
  const { pxQuery } = await import('../scrapers/ch-bfs.ts')
  const years = Array.from({ length: 12 }, (_, i) => `${2014 + i}/${String(15 + i).padStart(2, '0')}`)
  const q = pxQuery([{ code: 'Jahr', text: 'Jahr', values: years.map((_, i) => String(i)), valueTexts: years, time: true }])
  assert.deepEqual(q.query[0].selection.values, ['11'])
  assert.equal(findChInstitution('BE')?.id, 'unibe')
  assert.equal(findChInstitution('BFH')?.id, 'bfh')
  assert.equal(findChInstitution('Kal FH')?.id, 'kalaidos')
  assert.equal(findChInstitution('XY'), undefined)
})

test('only Bachelor and Master are requested; catch-all subjects get readable names', async () => {
  const { pxQuery, chProgrammeName } = await import('../scrapers/ch-bfs.ts')
  const q = pxQuery([{ code: 'S', text: 'Studienstufe', values: ['1', '2', '3', '4'], valueTexts: ['Lizenziat/Diplom', 'Bachelor', 'Master', 'Doktorat'] }])
  assert.deepEqual(q.query[0].selection.values, ['2', '3'])
  assert.equal(chProgrammeName('bachelor', 'Theologie übergreifend/übrige'), 'Bachelor Theologie (fächerübergreifend)')
  assert.equal(findChInstitution('TH CHUR')?.id, 'fhgr')
})

test('teacher education levels come from the subject', async () => {
  const { teacherLevels, parseRows: parse } = await import('../scrapers/ch-bfs.ts')
  assert.deepEqual(teacherLevels('Lehrkräfteausbildung Vorschulstufe und Primarstufe'), ['bachelor'])
  assert.deepEqual(teacherLevels('Lehrkräfteausbildung Sekundarstufe I'), ['bachelor', 'master'])
  assert.deepEqual(teacherLevels('Lehrkräfteausbildung Sekundarstufe II'), ['master'])
  assert.deepEqual(teacherLevels('Schulische Heilpädagogik'), ['master'])
  const rows = [{ Jahr: '2025/26', Hochschule: 'PHZH', Fachrichtung: 'Lehrkräfteausbildung Sekundarstufe I', Geschlecht: 'Total', Wert: '800' }]
  const { programmes } = parse(rows, '2026-01-01')
  assert.deepEqual(programmes.map((p) => p.level).sort(), ['bachelor', 'master'])
  assert.equal(programmes[0].institutionType, 'ph')
  assert.equal(programmes[0].capacity, undefined)
})

test('the language switch leads to the same page in the other language', () => {
  const fr = { site: 'ch', base: '', locale: 'fr-CH' } as const
  const ids = ['computer-science', 'medicine']
  assert.equal(switchHref(fr, { site: 'ch', locale: 'de-CH' }, '/fr/faecher/informatik', ids), '/faecher/informatik')
  assert.equal(switchHref(fr, { site: 'ch', locale: 'it-CH' }, '/fr/datenschutz', ids), '/it/datenschutz')
  assert.equal(switchHref(fr, { site: 'global', locale: 'en' }, '/fr/faecher/medizin', ids), 'https://whatshouldistudy.com/fields/medicine')
  assert.equal(switchHref({ site: 'ch', base: '', locale: 'de-CH' }, { site: 'ch', locale: 'fr-CH' }, '/', ids), '/fr')
  // An unknown page falls back to the home page.
  assert.equal(switchHref(fr, { site: 'ch', locale: 'de-CH' }, '/fr/nichts', ids), '/')
})
