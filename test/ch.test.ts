import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectColumns, parseRows } from '../scrapers/ch-bfs.ts'
import { findChInstitution } from '../lib/ch-institutions.ts'
import { fieldsForTitle } from '../scrapers/lib/common.ts'

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
