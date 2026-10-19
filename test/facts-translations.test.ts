import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseFact, type StoredFact } from '../scrapers/lib/facts.ts'
import { translateStoredFacts } from '../scrapers/lib/facts-translations.ts'
import type { CompletionRequest } from '../lib/infomaniak.ts'

const translations = {
  de: ['Das Studium enthält ein Projekt.'], fr: ['Le cursus comprend un projet.'],
  it: ['Il corso comprende un progetto.'], en: ['The course includes a project.'],
}
const original: StoredFact = {
  id: 'p', version: 5, url: 'https://example.org/course', hash: 'a'.repeat(64), at: '2026-10-01',
  riasec: [1, 2, 3, 4, 5, 0], subjects: ['math'], topics: [], specialisations: [],
  distinctive: translations.de, checks: { de: '', fr: '', it: '', en: '' }, enough: true,
}
const reply = (programmes: unknown[]) => ({ text: JSON.stringify({ programmes }), complete: true, usage: { input_tokens: 100, output_tokens: 200 } })

test('new readings keep aligned translations only for points supported by the source', () => {
  const text = 'Ein Projekt gehört zum Studium.'
  const sent = new Map([['p', { text, url: original.url, hash: original.hash }]])
  const point = { statement: original.distinctive[0], quote: text, translations: Object.fromEntries(Object.entries(translations).map(([l, [s]]) => [l, s])) }
  const raw = { id: 'p', enough_info: true, content_quote: text, distinctive: [point, { statement: 'Invented.', quote: 'Not in the source page.', translations: point.translations }] }
  const fact = normaliseFact(raw, sent, '2026-10-19')!
  assert.deepEqual(fact.distinctive, original.distinctive)
  assert.deepEqual(fact.distinctiveTranslations, translations)
  assert.equal(normaliseFact({ ...raw, distinctive: [{ ...point, translations: { it: 'Solo italiano.' } }] }, sent, '2026-10-19'), null)
  assert.equal(normaliseFact({ ...raw, distinctive: [{ ...point, translations: { ...point.translations, it: 'x'.repeat(301) } }] }, sent, '2026-10-19'), null)
  assert.deepEqual(normaliseFact({ ...raw, enough_info: false }, sent, '2026-10-19')!.distinctiveTranslations, { de: [], fr: [], it: [], en: [] })
})

test('backfill preserves source facts and scores, sends only statements, and resumes without retranslation', async () => {
  let calls = 0
  const complete = async (request: CompletionRequest) => {
    calls++
    assert.deepEqual(JSON.parse(request.input), { programmes: [{ id: 'p', statements: original.distinctive }] })
    return reply([{ id: 'p', translations }])
  }
  const first = await translateStoredFacts({ p: original }, 1, Infinity, complete)
  assert.deepEqual(first.programmes.p, { ...original, distinctiveTranslations: translations })
  assert.equal(first.translated, 1)
  assert.equal(first.spendMicro, 1100)
  assert.equal(original.distinctiveTranslations, undefined)
  const again = await translateStoredFacts(first.programmes, 1, Infinity, complete)
  assert.equal(again.translated, 0)
  assert.equal(calls, 1)
})

test('backfill keeps entire original batches on missing, malformed or incomplete translations', async () => {
  const previous = { p: original, q: { ...original, id: 'q' } }
  for (const result of [
    reply([{ id: 'p', translations }]),
    reply([{ id: 'p', translations }, { id: 'p', translations }]),
    reply([{ id: 'p', translations }, { id: 'q', translations: { ...translations, it: [] } }]),
    { ...reply([{ id: 'p', translations }, { id: 'q', translations }]), complete: false },
  ]) {
    const got = await translateStoredFacts(previous, 1, Infinity, async () => result)
    assert.deepEqual(got.programmes, previous)
    assert.equal(got.failed, 2)
    assert.equal(got.translated, 0)
  }
})

test('backfill honours the cap and retains reservations after a transport failure', async () => {
  let calls = 0
  const complete = async () => { calls++; throw new Error('Unavailable') }
  const previous = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i}`, { ...original, id: `p${i}` }]))
  const none = await translateStoredFacts(previous, 0.001, Infinity, complete)
  assert.equal(calls, 0)
  assert.equal(none.spendMicro, 0)
  const failed = await translateStoredFacts(previous, 0.06, Infinity, complete)
  assert.equal(calls, 1)
  assert.ok(failed.spendMicro > 40000 && failed.spendMicro <= 60000)
  assert.deepEqual(failed.programmes, previous)
})
