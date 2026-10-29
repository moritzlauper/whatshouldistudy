/**
 * Extracts the O*NET interest profiles of the occupations in FIELD_ONET into
 * lib/taxonomy/onet-interests.ts, from which fields.ts derives each field's
 * Holland profile. Needs the O*NET database file Interests.txt (O*NET 30.0,
 * https://www.onetcenter.org/database.html, CC BY 4.0).
 *
 *   node scripts/field-riasec.ts <path to Interests.txt>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { FIELD_ONET } from '../lib/taxonomy/field-onet.ts'

const ORDER = ['Realistic', 'Investigative', 'Artistic', 'Social', 'Enterprising', 'Conventional']
const file = process.argv[2]
if (!file) throw new Error('usage: node scripts/field-riasec.ts <Interests.txt>')

const wanted = new Set(Object.values(FIELD_ONET).flat())
const profiles = new Map<string, number[]>()
for (const line of readFileSync(file, 'utf8').split('\n').slice(1)) {
  const [code, , name, scale, value] = line.split('\t')
  const i = ORDER.indexOf(name)
  if (!wanted.has(code) || scale !== 'OI' || i < 0) continue
  const p = profiles.get(code) ?? Array(6).fill(NaN)
  p[i] = Number(value)
  profiles.set(code, p)
}
const missing = [...wanted].filter((c) => !profiles.get(c)?.every(Number.isFinite))
if (missing.length) throw new Error(`no complete interest profile for ${missing.join(', ')}`)

const rows = [...profiles].sort(([a], [b]) => a.localeCompare(b)).map(([code, p]) => `  '${code}': [${p.join(', ')}],`)
writeFileSync(new URL('../lib/taxonomy/onet-interests.ts', import.meta.url), `/**
 * Occupational Interest (OI) scores, 1 to 7, in R I A S E C order, of the
 * occupations in field-onet.ts. Extracted by scripts/field-riasec.ts from the
 * O*NET 30.0 Database (Interests.txt) by the U.S. Department of Labor,
 * Employment and Training Administration, used under the CC BY 4.0 licence.
 * O*NET® is a trademark of USDOL/ETA. Do not edit by hand.
 */
export const ONET_INTERESTS: Record<string, number[]> = {
${rows.join('\n')}
}
`)
console.log(`Wrote ${profiles.size} occupation profiles for ${Object.keys(FIELD_ONET).length} fields.`)
