import { test } from 'node:test'
import assert from 'node:assert/strict'
import { factsForLocale } from '../lib/facts-store.ts'
import { toPersonalFit } from '../lib/engine/programme-fit.ts'
import type { StoredFact } from '../scrapers/lib/facts.ts'

const reading: StoredFact = {
  id: 'p1', url: 'https://www.unibe.ch/p1', hash: 'h', at: '2026-10-01', riasec: [1, 4, 2, 3, 1, 5], subjects: ['math'], enough: true,
  checks: { de: 'Zulassung prüfen.', fr: 'Vérifier l’admission.', it: 'Verificare l’ammissione.', en: 'Check admission.' },
}

test('a reading is shown in the reader’s language, English when that language is empty', () => {
  assert.equal(factsForLocale(reading, 'de-CH').check, 'Zulassung prüfen.')
  assert.equal(factsForLocale(reading, 'de-AT').check, 'Zulassung prüfen.')
  assert.equal(factsForLocale(reading, 'fr-CH').check, 'Vérifier l’admission.')
  assert.equal(factsForLocale(reading, 'it-CH').check, 'Verificare l’ammissione.')
  assert.equal(factsForLocale({ ...reading, checks: { de: '', fr: '', it: '', en: 'Check.' } }, 'de-CH').check, 'Check.')
  assert.deepEqual(factsForLocale(reading, 'en'), { id: 'p1', riasec: [1, 4, 2, 3, 1, 5], subjects: ['math'], check: 'Check admission.', enough: true })
})

test('a personal reply is kept only for the programmes asked about, with scores in range', () => {
  const asked = new Set(['p1', 'p2'])
  assert.deepEqual(
    toPersonalFit({ id: 'p1', fit: 9, score: 140, reasons: ['  Passt zu deinen Interessen.  ', '', 'Zwei.', 'Drei.'], enough_info: true }, asked),
    { id: 'p1', fit: 5, score: 100, reasons: ['Passt zu deinen Interessen.', 'Zwei.'], thin: false },
  )
  assert.equal(toPersonalFit({ id: 'other', fit: 4, score: 80, reasons: [], enough_info: true }, asked), null)
  assert.equal(toPersonalFit(null, asked), null)
})

test('a reply that says too little to judge is neutral and gives no reasons', () => {
  assert.deepEqual(
    toPersonalFit({ id: 'p2', fit: 5, score: 95, reasons: ['Sicher.'], enough_info: false }, new Set(['p2'])),
    { id: 'p2', fit: 3, score: 50, reasons: [], thin: true },
  )
})

test('a reply without a score gets one from its fit', () => {
  assert.equal(toPersonalFit({ id: 'p1', fit: 4, reasons: [], enough_info: true }, new Set(['p1']))?.score, 87)
})
