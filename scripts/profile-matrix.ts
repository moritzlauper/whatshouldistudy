/**
 * Runs synthetic questionnaire profiles through the real scoring and prints
 * which fields come out on top: one profile per basic interest (that one
 * loved, the rest disliked) and one per three-letter Holland code. A check of
 * the field mapping for plausibility, no empirical validation and no
 * participant data.
 *
 *   node scripts/profile-matrix.ts [--top 5] [--json]
 */
import { score } from '../lib/engine/scoring.ts'
import { ATTENTION_ITEMS, INTEREST_ITEMS } from '../lib/engine/questionnaire.ts'
import { BASIC_INTERESTS, BASIC_KEYS } from '../lib/taxonomy/basic-interests.ts'
import type { BasicKey } from '../lib/taxonomy/basic-interests.ts'
import { FIELDS, RIASEC_KEYS } from '../lib/taxonomy/fields.ts'
import type { RiasecKey } from '../lib/taxonomy/fields.ts'
import type { QuestionnaireAnswers } from '../lib/engine/types.ts'

const args = process.argv.slice(2)
const topN = Math.max(1, Number(args[args.indexOf('--top') + 1]) || 5)
const asJson = args.includes('--json')

/** Every item of a basic interest answered alike; instructed items answered as asked. */
function answers(level: (k: BasicKey) => number): QuestionnaireAnswers {
  const interests: Record<string, number> = Object.fromEntries(INTEREST_ITEMS.map((i) => [i.id, level(i.key as BasicKey)]))
  for (const it of ATTENTION_ITEMS) interests[it.id] = it.answer
  return { interests, order: 1 }
}

const typeOf = Object.fromEntries(BASIC_INTERESTS.map((b) => [b.key, b.riasec])) as Record<BasicKey, RiasecKey>
const codes = RIASEC_KEYS.flatMap((a) => RIASEC_KEYS.flatMap((b) => RIASEC_KEYS.map((c) => a + b + c))).filter((c) => new Set(c).size === 3)

const profiles: Array<{ group: 'basic' | 'holland'; name: string; answers: QuestionnaireAnswers }> = [
  ...BASIC_KEYS.map((k) => ({ group: 'basic' as const, name: k, answers: answers((x) => (x === k ? 5 : 2)) })),
  // Basic interests of the first type loved, the second liked, the third neutral, the rest disliked.
  ...codes.map((code) => ({ group: 'holland' as const, name: code, answers: answers((x) => [5, 4, 3][code.indexOf(typeOf[x])] ?? 1) })),
]

const rows = profiles.map((p) => {
  const r = score({ summaries: [], answers: p.answers })
  return {
    group: p.group,
    profile: p.name,
    code: r.riasec.code,
    flat: !!r.quality?.flat,
    top: r.fields.slice(0, topN).map((f) => ({ id: f.id, score: f.score, tier: f.tier })),
  }
})

// Fields no synthetic profile brings into its top N: either hard to reach or covered by no interest scale.
const reached = new Map<string, number>()
for (const row of rows) for (const f of row.top) reached.set(f.id, (reached.get(f.id) ?? 0) + 1)
const unreached = FIELDS.map((f) => f.id).filter((id) => !reached.has(id))

if (asJson) {
  console.log(JSON.stringify({ topN, rows, reached: Object.fromEntries(reached), unreached }, null, 2))
} else {
  const cell = (f: { id: string; score: number; tier?: number }) => `${f.id} ${f.score}${f.tier ? ` (${f.tier})` : ''}`
  const table = (group: string, title: string) => {
    console.log(`\n## ${title}\n`)
    console.log(`| Profil | Code | ${Array.from({ length: topN }, (_, i) => `#${i + 1}`).join(' | ')} |`)
    console.log(`| --- | --- | ${Array(topN).fill('---').join(' | ')} |`)
    for (const row of rows.filter((x) => x.group === group)) {
      console.log(`| ${row.profile}${row.flat ? ' (flach)' : ''} | ${row.code} | ${row.top.map(cell).join(' | ')} |`)
    }
  }
  console.log(`# Profilmatrix: Top ${topN} je synthetischem Profil\n`)
  console.log('Score 0–100, in Klammern die Gruppe ähnlicher Passung (1 = beste). Keine Teilnehmerdaten.')
  table('basic', 'Eine Grundinteresse-Skala hoch (5), alle anderen tief (2)')
  table('holland', 'Holland-Code: erster Typ 5, zweiter 4, dritter 3, Rest 1')
  console.log(`\n## Felder nach Häufigkeit in den Top ${topN}\n`)
  console.log([...reached].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(', '))
  console.log(`\n## Nie in den Top ${topN} (${unreached.length} von ${FIELDS.length})\n`)
  console.log(unreached.join(', ') || 'keine')
}
