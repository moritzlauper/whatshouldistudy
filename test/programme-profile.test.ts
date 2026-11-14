import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIKED, likedKeys, personalSide, profileRemote, profileStandouts, profileTypes, programmeProfile, strongTypes, typeShifts } from '../lib/programme-profile.ts'
import { programmeCareers } from '../lib/site/programme-careers.ts'
import { programmePageText } from '../lib/site/programme-text.ts'
import { INTEREST_ITEMS } from '../lib/engine/questionnaire.ts'
import { FIELD_BY_ID, SUBJECT_KEYS } from '../lib/taxonomy/fields.ts'
import type { QuestionnaireAnswers } from '../lib/engine/types.ts'

test('a programme with one field has that field’s profile', () => {
  const p = programmeProfile(['psychology'])!
  assert.deepEqual(p.fields, ['psychology'])
  FIELD_BY_ID.psychology.riasec.forEach((v, i) => assert.ok(Math.abs(p.riasec[i] - v) < 0.001))
  assert.deepEqual(profileTypes(p.riasec), ['S', 'I'])
  assert.deepEqual(typeShifts(p), [])
})

test('business psychology mixes psychology with business and says how it differs', () => {
  const p = programmeProfile(['psychology', 'business-management'])!
  assert.deepEqual(profileTypes(p.riasec), ['S', 'E', 'I'])
  assert.deepEqual(typeShifts(p), [{ k: 'E', more: true }, { k: 'S', more: false }])
  const pro = profileStandouts(p)
  assert.ok(pro.length <= 4)
  // The second field shows up among the reasons instead of four psychology interests.
  assert.ok(pro.includes('management'), pro.join())
  assert.ok(!pro.includes('teaching'), pro.join())
  assert.ok(profileRemote(p).length <= 3)
})

test('unknown fields are ignored, none known gives no profile', () => {
  assert.equal(programmeProfile(['no-such-field']), null)
  assert.deepEqual(programmeProfile(['no-such-field', 'law'])!.fields, ['law'])
})

test('the difference to the first field reads as a sentence in every language', () => {
  const join = (xs: string[]) => xs.join(', ')
  assert.equal(programmePageText('de-CH').shift(['unternehmerisch'], ['sozial'], 'Psychologie', join), 'Stärker unternehmerisch und weniger sozial als Psychologie allgemein.')
  assert.equal(programmePageText('en').shift([], ['social'], 'Psychology', join), 'Less social than Psychology in general.')
  for (const l of ['fr-CH', 'it-CH', 'de-DE', 'de-AT'] as const) assert.ok(programmePageText(l).shift(['a'], ['b'], 'X', join).length > 10)
  for (const l of ['de-CH', 'de-DE', 'de-AT', 'en', 'fr-CH', 'it-CH'] as const) {
    const all = JSON.stringify(programmePageText(l)) + programmePageText(l).shift(['a'], ['b'], 'X', join)
    assert.ok(!/[–—]/.test(all), `${l}: no dashes in sentences`)
  }
})

function answers(liked: (key: string) => boolean, subject: (key: string) => number): QuestionnaireAnswers {
  return {
    interests: Object.fromEntries(INTEREST_ITEMS.map((i) => [i.id, liked(i.key) ? 5 : 1])),
    subjects: Object.fromEntries(SUBJECT_KEYS.map((k) => [k, { enjoy: subject(k) }])),
  }
}

test('the comparison uses only a finished questionnaire and marks what the person likes', () => {
  assert.equal(personalSide({}), null)
  const side = personalSide(answers((k) => k === 'counseling' || k === 'management', (k) => (k === 'phys' ? 5 : 2)))!
  assert.ok(side)
  assert.ok(side.liking.counseling >= LIKED)
  assert.deepEqual(likedKeys(['counseling', 'teaching', 'management', 's:phys', 's:math'], side), ['counseling', 'management', 's:phys'])
  assert.equal(strongTypes(side.riasec).length, 2)
})

test('careers come from every field, without university-only ones at a university of applied sciences', () => {
  const uni = programmeCareers(['psychology', 'business-management'], 'de-CH', false)
  assert.equal(uni.length, 5)
  assert.ok(uni.includes('Manager:in'))
  const fh = programmeCareers(['psychology', 'business-management'], 'de-CH', true)
  assert.ok(!fh.some((c) => /Psychotherap|Klinische|Schulpsych/.test(c)), fh.join())
  assert.ok(fh.includes('UX-Research') && fh.includes('Manager:in'), fh.join())
})
