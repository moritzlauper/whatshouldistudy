import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cleanAnswers, instrumentDefinition, sessionExport, sessionProfile, sessionReady } from '../lib/assessment.ts'
import { ASSESSMENT_VERSION } from '../lib/engine/assessment-version.ts'
import { RIASEC_ITEMS, scoreRiasec, riasecCompleteness } from '../lib/engine/questionnaire.ts'
import { score } from '../lib/engine/scoring.ts'
import { encodeSnapshot, decodeSnapshot } from '../lib/share.ts'
import { unmeasured } from '../lib/measure.ts'

const answers = { riasec: Object.fromEntries(RIASEC_ITEMS.map((i, n) => [i.id, n % 5 + 1])) }

test('invalid interest responses do not produce scores, readiness or completeness', () => {
  for (const invalid of [NaN, Infinity, -1, 0, 2.5, 6]) {
    const input = { riasec: { ...answers.riasec, r1: invalid, r2: invalid, r5: invalid } }
    assert.equal(scoreRiasec(input), null)
    assert.equal(sessionReady(input), false)
    assert.equal(riasecCompleteness(input), 45 / 48)
  }
  const partial = { riasec: { ...answers.riasec } }
  delete partial.riasec.r1
  assert.ok(scoreRiasec(partial), 'normal exploration still allows partial forms')
  assert.equal(sessionProfile(partial), null, 'standardised session requires all 48')
})

test('session exports whitelist valid items and expose descriptive means, not rankings or hidden state', () => {
  const input = { ...answers, riasec: { ...answers.riasec, secret: 5 }, big5: Object.fromEntries(Array.from({ length: 20 }, (_, n) => [`b${n + 1}`, 3])), subjects: { math: { enjoy: 5, grade: 2.5 } }, values: { helping: 4, private: 5 }, token: 'never-export', summaries: { takeout: { title: 'private' } } }
  const exported = sessionExport(input, 'de-CH')
  assert.deepEqual(cleanAnswers(input).subjects, { math: { enjoy: 5 } })
  assert.deepEqual(exported.profile?.personalityMeans, { O: 3, C: 3, E: 3, A: 3, N: 3 })
  assert.equal(exported.definition.version.interests, ASSESSMENT_VERSION.interests)
  assert.equal(exported.definition.norms, null)
  assert.doesNotMatch(JSON.stringify(exported), /never-export|private|secret|"summaries"|"fields"/)
  assert.equal(exported.profile?.interestMeans.length, 6)
})

test('all language definitions preserve IDs, response scales and explicit provenance', () => {
  for (const locale of ['de-CH', 'de-DE', 'de-AT', 'en', 'fr-CH', 'it-CH'] as const) {
    const form = instrumentDefinition(locale)
    assert.equal(form.interests.items.length, 50)
    assert.equal(form.personality.items.length, 20)
    assert.equal(form.interests.labels.length, 5)
    assert.equal(form.personality.labels.length, 5)
    assert.equal(form.interests.items[16].id, 'chk')
    assert.equal(form.interests.items[33].id, 'chk2')
    assert.ok(form.personality.items.some(i => i.reverse))
    assert.ok(form.interests.items.every(i => i.text.length > 5))
    assert.match(form.personality.languageStatus, locale === 'en' ? /Original English/ : /Own translation/)
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
