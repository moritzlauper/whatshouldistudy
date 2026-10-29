import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cleanAnswers, instrumentDefinition, sessionExport, sessionProfile, sessionReady } from '../lib/assessment.ts'
import { ASSESSMENT_VERSION } from '../lib/engine/assessment-version.ts'
import { INTEREST_ITEMS, scoreBasic, interestCompleteness } from '../lib/engine/questionnaire.ts'
import { score } from '../lib/engine/scoring.ts'
import { SUBJECT_KEYS } from '../lib/taxonomy/fields.ts'
import { encodeSnapshot, decodeSnapshot } from '../lib/share.ts'
import { unmeasured } from '../lib/measure.ts'

const answers = { interests: Object.fromEntries(INTEREST_ITEMS.map((i, n) => [i.id, n % 5 + 1])), subjects: Object.fromEntries(SUBJECT_KEYS.map((k, n) => [k, { enjoy: n % 5 + 1 }])) }

test('invalid interest responses do not produce scores, readiness or completeness', () => {
  for (const invalid of [NaN, Infinity, -1, 0, 2.5, 6]) {
    const input = { interests: { ...answers.interests, law1: invalid, law2: invalid, media3: invalid } }
    assert.equal(scoreBasic(input), null)
    assert.equal(sessionReady(input), false)
    assert.equal(interestCompleteness(input), (INTEREST_ITEMS.length - 3) / INTEREST_ITEMS.length)
  }
  const partial = { ...answers, interests: { ...answers.interests } }
  delete partial.interests.law1
  assert.ok(scoreBasic(partial), 'normal exploration still allows partial forms')
  assert.equal(sessionProfile(partial), null, 'standardised session requires every item')
})

test('session exports whitelist valid items and expose descriptive means, not rankings or hidden state', () => {
  const input = { ...answers, interests: { ...answers.interests, secret: 5 }, subjects: { ...answers.subjects, music: { enjoy: 5, grade: 2.5 }, secret: { enjoy: 4 } }, grades: { scale: 'ch', math: 'strong' }, values: { helping: 4 }, token: 'never-export', summaries: { takeout: { title: 'private' } } } as never
  const exported = sessionExport(input, 'de-CH')
  assert.deepEqual(cleanAnswers(input).subjects, { ...answers.subjects, music: { enjoy: 5 } })
  assert.deepEqual(cleanAnswers(input).grades, { scale: 'ch', math: 'strong' })
  assert.equal(exported.definition.version.interests, ASSESSMENT_VERSION.interests)
  assert.equal(exported.definition.norms, null)
  assert.doesNotMatch(JSON.stringify(exported), /never-export|private|secret|"summaries"|"fields"|"values"/)
  assert.equal(exported.profile?.interestMeans.length, 6)
  assert.equal(Object.keys(exported.profile?.basicMeans ?? {}).length, 15)
})

test('all language definitions preserve IDs, response scales and explicit provenance', () => {
  for (const locale of ['de-CH', 'de-DE', 'de-AT', 'en', 'fr-CH', 'it-CH'] as const) {
    const form = instrumentDefinition(locale)
    assert.equal(form.interests.items.length, INTEREST_ITEMS.length + 2)
    assert.equal(form.interests.labels.length, 5)
    assert.ok(form.interests.items.some(i => i.id === 'chk') && form.interests.items.some(i => i.id === 'chk2'))
    assert.ok(form.interests.items.every(i => i.text.length > 5))
    if (locale !== 'en') assert.ok(form.interests.items.every(i => i.text !== INTEREST_ITEMS.find(x => x.id === i.id)?.text), `${locale} translates every item`)
    assert.match(form.interests.provenance, /CABIN-NET/)
  }
})

test('new shared results retain procedure revision without assigning it to old results', () => {
  const result = score({ summaries: [], answers, locale: 'de-CH' })
  const prefs = { level: 'bachelor' as const, countries: ['CH'], maxTuitionEur: 0, origin: 'ch' as const, englishOnly: false }
  assert.deepEqual(decodeSnapshot(encodeSnapshot(result, prefs))?.results.method, result.method)
  delete result.method
  assert.equal(decodeSnapshot(encodeSnapshot(result, prefs))?.results.method, undefined)
})

test('counselling routes never generate page measurement, including country rewrites', () => {
  for (const path of ['/counselling', '/schweiz/beratung', '/ch-site/beratung', '/fr/beratung/', '/it/beratung', '/prefix/deutschland/beratung']) assert.ok(unmeasured(path), path)
  assert.equal(unmeasured('/schweiz/start'), false)
})

test('counselling session starts empty, exports only on action, discards and does not use storage or HTTP', () => {
  const child = spawnSync(process.execPath, ['test/helpers/counselling.mjs'], { encoding: 'utf8' })
  assert.equal(child.status, 0, child.stderr)
})

test('release manifest matches displayed forms and implemented scoring', () => {
  const child = spawnSync(process.execPath, ['scripts/validation-bundle.ts', '--check'], { encoding: 'utf8' })
  assert.equal(child.status, 0, child.stderr)
})
