import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publicReading, specialisationNames } from '../lib/facts-store.ts'
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

test('a programme page gets its specialisations and what sets it apart, in its language, and nothing else of a reading', () => {
  const translated: StoredFact = {
    ...reading,
    distinctiveTranslations: {
      de: ['Der Studiengang setzt stark auf eigene empirische Forschungsprojekte.'],
      fr: ['La filière mise fortement sur des projets de recherche empiriques.'],
      it: ['Il corso punta molto su progetti di ricerca empirica.'],
      en: ['The programme relies heavily on its own empirical research projects.'],
    },
  }
  const shown = publicReading(translated, 'fr-CH')
  assert.deepEqual(shown, { specialisations: ['Wirtschaftssoziologie', 'Lebenslauf und Generationen'], distinctive: ['La filière mise fortement sur des projets de recherche empiriques.'], at: '2026-10-01', url: 'https://www.unibe.ch/p1' })
  const json = JSON.stringify(shown)
  for (const kept of ['riasec', 'subjects', 'topics', 'check', 'sociology', 'Vérifier']) assert.ok(!json.includes(kept), kept)
})

test('untranslated points stay out, and a reading with nothing to show gives no card', () => {
  assert.deepEqual(publicReading(reading, 'de-CH')?.distinctive, [])
  assert.equal(publicReading({ ...reading, specialisations: [] }, 'de-CH'), null)
  assert.equal(publicReading(undefined, 'de-CH'), null)
})

test('the source is linked only when it is a web address', () => {
  assert.equal(publicReading({ ...reading, url: 'javascript:alert(1)' }, 'de-CH')?.url, undefined)
  assert.equal(publicReading({ ...reading, url: 'https://' }, 'de-CH')?.url, undefined)
  assert.equal(publicReading(reading, 'de-CH')?.url, 'https://www.unibe.ch/p1')
})

test('a programme page gets the reading’s profile as words, never its numbers', async () => {
  const { readingFit } = await import('../lib/facts-store.ts')
  // Social and enterprising, rated high across the board as single model ratings tend to be.
  const rated: StoredFact = { ...reading, riasec: [1, 3, 2, 5, 5, 3], subjects: ['econ', 'social'], topics: ['psychology', 'business-management', 'no-such-field'] }
  const fit = readingFit(rated, 'psychology')!
  assert.deepEqual(fit.types, ['S', 'E'])
  assert.deepEqual(fit.shifts, [{ k: 'E', more: true }, { k: 'I', more: false }])
  assert.deepEqual(fit.subjects, ['econ', 'social'])
  assert.deepEqual(fit.topics, ['psychology', 'business-management'])
  assert.ok(!/\d\.\d|"riasec"|"check"|Zulassung/.test(JSON.stringify(fit)), JSON.stringify(fit))
  assert.equal(readingFit({ ...rated, enough: false }, 'psychology'), null)
  assert.equal(readingFit({ ...rated, riasec: [3, 3, 3, 3, 3, 3] }, 'psychology'), null)
  assert.equal(readingFit(undefined, 'psychology'), null)
})
