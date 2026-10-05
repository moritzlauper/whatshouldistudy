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
