import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FACTS_VERSION, normaliseFact, normaliseSchedule, type PageMember } from '../scrapers/lib/facts.ts'
import { publicReading, storedFactProblem, validStoredFact } from '../lib/facts-store.ts'

const text = 'Master Business Psychology. Ein integriertes Praktikum verbindet Theorie und Praxis. Das Studium dauert in Vollzeit 4 Semester, in Teilzeit 6 Semester. Studienstart im Herbst (September).'
const sent = new Map<string, PageMember>([['p1', { url: 'https://www.hslu.ch/p1', hash: 'h', text }]])
const same = <T,>(s: T) => ({ de: s, fr: s, it: s, en: s })

function read(extra: Record<string, unknown>) {
  return normaliseFact({
    id: 'p1', content_quote: 'Ein integriertes Praktikum verbindet Theorie und Praxis', checks_quote: 'Das Studium dauert in Vollzeit 4 Semester', riasec: { S: 4, E: 4 }, subjects: ['econ'], topics: [],
    specialisations: [], checks: same('Prüf die Dauer.'), enough_info: true,
    distinctive: [{ statement: 'Ein integriertes Praktikum verbindet Theorie und Praxis.', quote: 'Ein integriertes Praktikum verbindet Theorie und Praxis', translations: same('Ein integriertes Praktikum verbindet Theorie und Praxis.'), titles: same('Integriertes Praktikum'), kind: 'practice' }],
    ...extra,
  }, sent, '2026-11-14')
}

test('the reader keeps a title and a kind for each distinctive point, and the schedule the page states', () => {
  const f = read({ schedule: { full_time_semesters: 4, part_time_semesters: 6, internship: true, start: 'autumn', quote: 'Das Studium dauert in Vollzeit 4 Semester, in Teilzeit 6 Semester. Studienstart im Herbst' } })!
  assert.equal(f.version, FACTS_VERSION)
  assert.deepEqual(f.distinctiveTitles, same(['Integriertes Praktikum']))
  assert.deepEqual(f.distinctiveKinds, ['practice'])
  // The internship is not in this quote, so it is not kept.
  assert.deepEqual(f.schedule, { fullTimeSemesters: 4, partTimeSemesters: 6, start: 'autumn' })
})

test('a title that is too long or a sentence drops the titles, never the point', () => {
  const f = read({ distinctive: [{ statement: 'Ein integriertes Praktikum verbindet Theorie und Praxis.', quote: 'Ein integriertes Praktikum verbindet Theorie und Praxis', translations: same('Ein integriertes Praktikum verbindet Theorie und Praxis.'), titles: { ...same('Praktikum'), it: 'Un tirocinio integrato nel corso di studi.' }, kind: 'nonsense' }] })!
  assert.equal(f.distinctive.length, 1)
  assert.equal(f.distinctiveTitles, undefined)
  assert.deepEqual(f.distinctiveKinds, ['other'])
  assert.equal(f.schedule, undefined)
})

test('the schedule needs a quote from the page that names each part', () => {
  assert.equal(normaliseSchedule({ full_time_semesters: 4, quote: 'Das Studium dauert in Vollzeit vier Semester' }, text), undefined)
  assert.equal(normaliseSchedule({ full_time_semesters: 5, part_time_semesters: 0, internship: false, start: 'unknown', quote: 'in Vollzeit 4 Semester, in Teilzeit 6 Semester' }, text), undefined)
  assert.deepEqual(normaliseSchedule({ full_time_semesters: 4, internship: true, start: 'spring', quote: 'Ein integriertes Praktikum verbindet Theorie und Praxis. Das Studium dauert in Vollzeit 4 Semester' }, text), { fullTimeSemesters: 4, internship: true })
  assert.equal(normaliseSchedule(null, text), undefined)
})

test('the store takes the new fields only in their shape, and the programme page gets the titles in its language', () => {
  const f = { ...read({ schedule: { full_time_semesters: 4, part_time_semesters: 6, internship: false, start: 'autumn', quote: 'in Vollzeit 4 Semester, in Teilzeit 6 Semester. Studienstart im Herbst' } })!, hash: 'a'.repeat(64) }
  assert.deepEqual(validStoredFact(f), f)
  assert.equal(storedFactProblem(f), null)
  for (const [key, value] of [['distinctiveTitles', same(['Viel zu viele Wörter für einen Titel'])], ['distinctiveKinds', ['practice', 'other']], ['schedule', { fullTimeSemesters: 40 }], ['schedule', {}]] as const) {
    const broken = { ...f, [key]: value }
    assert.equal(validStoredFact(broken), null, key)
    assert.equal(storedFactProblem(broken), key)
  }
  const shown = publicReading(f, 'fr-CH')!
  assert.deepEqual(shown.titles, ['Integriertes Praktikum'])
  assert.deepEqual(shown.kinds, ['practice'])
  assert.deepEqual(shown.schedule, { fullTimeSemesters: 4, partTimeSemesters: 6, start: 'autumn' })
})
