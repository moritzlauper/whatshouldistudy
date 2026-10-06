import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseSpDetails } from '../scrapers/ch-studyprogrammes.ts'
import type { SpDetails } from '../scrapers/ch-studyprogrammes.ts'

const fixtures = JSON.parse(readFileSync(new URL('../scrapers/fixtures/ch-studyprogrammes.json', import.meta.url), 'utf8')) as Array<{ level: 'bachelor' | 'master'; d: SpDetails }>

test('reads a studyprogrammes.ch entry with its focus, own page and institution data', () => {
  const [agro, bern, luzern] = fixtures.map((x) => parseSpDetails(x.d, x.level, '2026-10-06'))
  assert.equal(agro?.institution, 'Berner Fachhochschule')
  assert.equal(agro?.institutionType, 'fh')
  assert.equal(agro?.url, 'https://www.bfh.ch/fr/etudes/bachelor/agronomie')
  assert.equal(agro?.durationYears, 3)
  assert.equal(agro?.mode, 'both')
  assert.ok(agro?.fields.includes('agriculture'))
  // Windows-1250 mojibake in French texts is repaired.
  assert.match(agro?.description ?? '', / à la Haute école/)
  assert.ok(!(agro?.focus ?? []).includes('BFH'))
  assert.equal(bern?.fields[0], 'sociology')
  assert.deepEqual(bern?.focus?.slice(0, 3), ['Soziale Ungleichheit', 'Migration', 'Bildungssoziologie'])
  assert.notDeepEqual(bern?.focus, luzern?.focus)
})
