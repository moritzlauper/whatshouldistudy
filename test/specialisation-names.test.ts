import { test } from 'node:test'
import assert from 'node:assert/strict'
import { specialisationNames } from '../lib/facts-store.ts'
import type { StoredFact } from '../scrapers/lib/facts.ts'

const reading: StoredFact = {
  id: 'p1', url: 'https://www.unibe.ch/p1', hash: 'a'.repeat(64), at: '2026-10-01', riasec: [1, 4, 2, 3, 1, 5], subjects: ['math'], topics: ['sociology'],
  specialisations: [
    { name: 'Wirtschaftssoziologie', topics: ['sociology'] },
    { name: 'Lebenslauf und Generationen', topics: [] },
  ],
  distinctive: ['Der Studiengang setzt stark auf eigene empirische Forschungsprojekte.'], enough: true,
  checks: { de: 'Zulassung prüfen.', fr: 'Vérifier l’admission.', it: 'Verificare l’ammissione.', en: 'Check admission.' },
}

test('the public field page gets the names of the specialisations and nothing else of a reading', () => {
  const names = specialisationNames({ p1: reading, p2: { ...reading, id: 'p2', specialisations: [] } })
  assert.deepEqual(names, { p1: ['Wirtschaftssoziologie', 'Lebenslauf und Generationen'] })
  assert.equal(JSON.stringify(names), '{"p1":["Wirtschaftssoziologie","Lebenslauf und Generationen"]}')
})

test('without a store, or without any specialisation, there are no names', () => {
  assert.deepEqual(specialisationNames(null), {})
  assert.deepEqual(specialisationNames({}), {})
})
