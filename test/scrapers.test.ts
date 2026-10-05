import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSchools } from '../scrapers/us-scorecard.ts'
import type { RawSchool } from '../scrapers/us-scorecard.ts'
import { frenchLevel, parseRecords } from '../scrapers/fr-parcoursup.ts'
import { ukLevel } from '../scrapers/uk-discoveruni.ts'
import { rankInstitutions } from '../scrapers/global-openalex.ts'
import { fieldsForCip, FIXTURES } from '../scrapers/lib/common.ts'
import { programmeId } from '../lib/programmes.ts'
import type { Programme } from '../lib/programmes.ts'
import { feeFor } from '../lib/countries.ts'

const fixture = <T,>(name: string): T => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as T

test('CIP codes map to fields, longest prefix first', () => {
  assert.deepEqual(fieldsForCip('1107'), ['computer-science'])
  assert.deepEqual(fieldsForCip('11.07'), ['computer-science'])
  assert.deepEqual(fieldsForCip('1402'), ['aerospace-engineering'])
  assert.deepEqual(fieldsForCip('5112'), ['medicine'])
  assert.deepEqual(fieldsForCip('1301'), ['education'])
  assert.deepEqual(fieldsForCip('9999'), [])
})

test('US Scorecard schools become programmes with fees and earnings', () => {
  const { results } = fixture<{ results: RawSchool[] }>('us-scorecard.json')
  const ps = parseSchools(results, '2026-01-01')
  assert.ok(ps.length > 300)
  const mitCs = ps.find((p) => p.institution.startsWith('Massachusetts') && p.name === "Bachelor's in Computer Science")!
  assert.deepEqual(mitCs.fields, ['computer-science'])
  assert.equal(mitCs.fieldConfidence, 1)
  assert.equal(mitCs.tuition?.currency, 'USD')
  assert.ok(mitCs.earnings && mitCs.earnings.median > 0)
  assert.ok(ps.some((p) => p.level === 'professional' && p.fields[0] === 'law'))
  assert.equal(new Set(ps.map((p) => p.id)).size, ps.length, 'ids are unique')
})

test('Parcoursup records: levels, fees and fields', () => {
  assert.equal(frenchLevel('BTS - Tourisme')?.level, 'short')
  assert.equal(frenchLevel('Licence - Informatique')?.level, 'bachelor')
  assert.equal(frenchLevel("Formation d'ingénieur Bac + 5 - Génie mécanique")?.level, 'integrated')
  const { programmes } = parseRecords(fixture('fr-parcoursup.json'), '2026-01-01')
  const info = programmes.find((p) => p.name === 'Licence - Informatique')!
  assert.deepEqual(info.fields, ['computer-science'])
  assert.equal(info.tuition?.eu, 178)
  assert.equal(programmes.find((p) => p.name === 'CPGE - MPSI')!.fields[0], 'mathematics')
  assert.equal(programmes.find((p) => p.name.endsWith("Diplôme d'Etat d'infirmier"))!.fields[0], 'nursing')
})

test('UK award labels map to levels', () => {
  assert.equal(ukLevel('MEng', 'Mechanical Engineering').level, 'integrated')
  assert.equal(ukLevel('MA (Hons)', 'Philosophy').level, 'bachelor')
  assert.equal(ukLevel('MBChB', 'Medicine').level, 'professional')
  assert.equal(ukLevel('BSc (Hons)', 'Physics').level, 'bachelor')
  assert.equal(ukLevel('Foundation Degree', 'Business').level, 'short')
})

test('OpenAlex research ranking per field and country', () => {
  const ranked = rankInstitutions(fixture('openalex-institutions.json'))
  assert.equal(ranked['aerospace-engineering'].DE[0].name, 'Technical University of Munich')
  assert.equal(ranked['architecture'].NL[0].strength, 1)
  assert.ok(!ranked['architecture'].JP)
})

test('programme ids are stable and fees follow the student origin', () => {
  assert.equal(programmeId(['us', 1, '1107', 'bachelor']), programmeId(['us', 1, '1107', 'bachelor']))
  assert.notEqual(programmeId(['us', 1, '1107', 'bachelor']), programmeId(['us', 1, '1107', 'master']))
  const fr = { country: 'FR', tuition: { currency: 'EUR', eu: 178, international: 2895 } } as Programme
  assert.equal(feeFor(fr, 'eu')?.amount, 178)
  assert.equal(feeFor(fr, 'ch')?.amount, 178)
  assert.equal(feeFor(fr, 'us')?.amount, 2895)
  const uk = { country: 'GB', tuition: { currency: 'GBP', domestic: 9535 } } as Programme
  assert.equal(feeFor(uk, 'uk')?.amount, 9535)
  assert.equal(feeFor(uk, 'eu'), null)
})
