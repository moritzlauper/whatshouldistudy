/**
 * Extracts the O*NET interest profiles and knowledge importance ratings of the
 * occupations in FIELD_ONET into lib/taxonomy/onet-interests.ts and
 * onet-knowledge.ts, from which fields.ts derives each field's Holland
 * profile and basic-interest profile. Needs the O*NET database files
 * Interests.txt and Knowledge.txt (O*NET 30.0,
 * https://www.onetcenter.org/database.html, CC BY 4.0).
 *
 *   node scripts/field-riasec.ts <Interests.txt> <Knowledge.txt>
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { FIELD_ONET } from '../lib/taxonomy/field-onet.ts'
import { KNOWLEDGE_AREAS } from '../lib/taxonomy/basic-interests.ts'

const ORDER = ['Realistic', 'Investigative', 'Artistic', 'Social', 'Enterprising', 'Conventional']
const [file, knowledgeFile] = process.argv.slice(2)
if (!file || !knowledgeFile) throw new Error('usage: node scripts/field-riasec.ts <Interests.txt> <Knowledge.txt>')

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

// Knowledge importance (IM, 1..5) of the areas the basic interests are matched against.
const knowledge = new Map<string, number[]>()
for (const line of readFileSync(knowledgeFile, 'utf8').split('\n').slice(1)) {
  const [code, , name, scale, value] = line.split('\t')
  const i = KNOWLEDGE_AREAS.indexOf(name)
  if (!wanted.has(code) || scale !== 'IM' || i < 0) continue
  const k = knowledge.get(code) ?? Array(KNOWLEDGE_AREAS.length).fill(NaN)
  k[i] = Number(value)
  knowledge.set(code, k)
}
// Some occupations have interest scores but no knowledge ratings; a field's knowledge profile uses the others.
for (const [code, k] of knowledge) if (!k.every(Number.isFinite)) knowledge.delete(code)
const uncovered = Object.entries(FIELD_ONET).filter(([, codes]) => !codes.some((c) => knowledge.has(c))).map(([id]) => id)
if (uncovered.length) throw new Error(`no occupation with knowledge ratings for ${uncovered.join(', ')}`)
console.log(`Without knowledge ratings: ${[...wanted].filter((c) => !knowledge.has(c)).join(', ')}`)
const krows = [...knowledge].sort(([a], [b]) => a.localeCompare(b)).map(([code, k]) => `  '${code}': [${k.join(', ')}],`)
writeFileSync(new URL('../lib/taxonomy/onet-knowledge.ts', import.meta.url), `/**
 * Knowledge importance (IM, 1 to 5) of the occupations in field-onet.ts that
 * O*NET has knowledge ratings for, for
 * the knowledge areas in ONET_KNOWLEDGE_AREAS. Extracted by
 * scripts/field-riasec.ts from the O*NET 30.0 Database (Knowledge.txt) by the
 * U.S. Department of Labor, Employment and Training Administration, used
 * under the CC BY 4.0 licence. O*NET® is a trademark of USDOL/ETA. Do not edit
 * by hand.
 */
export const ONET_KNOWLEDGE_AREAS = ${JSON.stringify(KNOWLEDGE_AREAS)}

export const ONET_KNOWLEDGE: Record<string, number[]> = {
${krows.join('\n')}
}
`)
console.log(`Wrote ${profiles.size} occupation profiles and knowledge ratings for ${Object.keys(FIELD_ONET).length} fields.`)
