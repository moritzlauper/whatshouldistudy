import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { StoredFact } from '../../scrapers/lib/facts.ts'
import { toPersonalFit, type PersonalFit } from '../engine/programme-fit.ts'
import type { Locale } from '../site/config.ts'
import { aiAllowed, aiSpend } from './ai-budget.ts'
import { countryFacts } from './facts-db.ts'
import { findProgramme, type FoundProgramme } from './programme.ts'

/**
 * The optional step «include my answers»: Claude compares a person's interest
 * profile and the school subjects they enjoy with the readings of the programmes
 * they are shown, and writes how each one fits them. It gets the profile and the
 * readings, never a name or an account. Nothing is stored; the browser keeps the
 * ratings only while the step is on.
 */

export interface PersonalProfile {
  /** Interest profile R I A S E C, each 0..1. */
  riasec: number[]
  /** School subjects the person enjoys, keys from SUBJECT_KEYS. */
  subjects: string[]
  /** Topics the person cares about, keys of the lexicon with weights 0..1. */
  topics: Record<string, number>
}

export interface PersonalRequest {
  programmes: Array<{ id: string; field: string; country: string }>
  profile: PersonalProfile
  locale: Locale
}

export const MAX_PERSONAL = 20
const BATCH = 5
const MODEL = 'claude-haiku-5-5'

const LANGUAGE: Record<Locale, string> = {
  en: 'English',
  'de-CH': 'Swiss Standard German (never «ß», always «ss»; quotes «»)',
  'de-DE': 'German',
  'de-AT': 'Austrian Standard German',
  'fr-CH': 'French',
  'it-CH': 'Italian',
}

const SCHEMA = {
  type: 'object',
  properties: {
    programmes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fit: { type: 'integer' },
          score: { type: 'integer' },
          reasons: { type: 'array', items: { type: 'string' } },
          enough_info: { type: 'boolean' },
        },
        required: ['id', 'fit', 'score', 'reasons', 'enough_info'],
        additionalProperties: false,
      },
    },
  },
  required: ['programmes'],
  additionalProperties: false,
}

const system = (locale: Locale) => `You help a school leaver see how specific degree programmes fit their own answers from a study-choice questionnaire.

For each programme you get its name, institution, level, the focus areas listed for it, and a reading of its official page: how strongly it involves each interest type R I A S E C (0..5), which school subjects it clearly relies on, the topics it covers, its specialisations (Vertiefungen) with the topics each one covers, and what the page says sets it apart. You also get the person's interest profile (R I A S E C, each 0..1), the school subjects they enjoy and the topics they care about (keys with weights 0..1).

For each programme give:
- "fit": 1 (little in common) to 5 (very close).
- "score": 0 to 100, the same judgement on a finer scale: 1 ≈ 0–20, 2 ≈ 20–40, 3 ≈ 40–60, 4 ≈ 60–80, 5 ≈ 80–100. Use the whole band. Programmes in the same field get different scores when their content differs.
- "reasons": one or two short sentences in ${LANGUAGE[locale]}, addressed to the person informally (du, tu or you, as the language requires), on why it fits or does not, in terms of this programme's content and the person's interests and subjects.
- "enough_info": false when the reading and the focus areas say too little about the content to judge. Then give fit 3, score 50 and no reasons.

Rules: base every statement on the reading and the listed focus areas. Name only what the person's profile and the programme have in common, or a clear gap between them. Never name an interest, topic or subject the person did not give, and do not add interests of your own. Do not invent specialisations, modules or admission rules. The profile is a rough self-description, not a diagnosis: make no statements about mental health or personality.`

const block = (p: FoundProgramme['p'], f: StoredFact) =>
  [
    `<programme id="${p.id}">`,
    `Name: ${p.name}`,
    `Institution: ${p.institution}${p.city ? `, ${p.city}` : ''}`,
    `Level: ${p.level}`,
    p.focus?.length ? `Listed focus areas: ${p.focus.join('; ')}` : '',
    f.enough
      ? [
          `Reading of the official page, interest types R I A S E C (0..5): ${f.riasec.join(' ')}`,
          `Subjects it relies on: ${f.subjects.join(', ') || 'none stated'}`,
          `Topics it covers: ${(f.topics ?? []).join(', ') || 'none stated'}`,
          `Specialisations it names, with their topics: ${(f.specialisations ?? []).map((s) => `${s.name} (${s.topics.join(', ') || 'no topic'})`).join('; ') || 'none named'}`,
          `What the page says sets it apart: ${(f.distinctive ?? []).join(' ') || 'nothing beyond the name'}`,
        ].join('\n')
      : 'Reading: the official page says too little to judge the content.',
    '</programme>',
  ]
    .filter(Boolean)
    .join('\n')

const profileText = (pr: PersonalProfile) =>
  [
    `Interest profile, R I A S E C (0..1): ${pr.riasec.map((x) => x.toFixed(2)).join(' ')}`,
    `School subjects they enjoy: ${pr.subjects.join(', ') || 'none named'}`,
    `Topics they care about, weights 0..1: ${Object.entries(pr.topics).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ') || 'none named'}`,
  ].join('\n')

/** The comparison and what it cost; null when it cannot be made (no key, budget used up, no readings). */
export async function personalFits(req: PersonalRequest): Promise<{ fits: PersonalFit[]; costMicroUsd: number } | null> {
  if (!process.env.ANTHROPIC_API_KEY || !(await aiAllowed('fit'))) return null
  const wanted = req.programmes.slice(0, MAX_PERSONAL)
  const stores = new Map<string, Record<string, StoredFact> | null>()
  for (const c of new Set(wanted.map((x) => x.country))) stores.set(c, await countryFacts(c))
  const found = (
    await Promise.all(
      wanted.map(async (x) => {
        const reading = stores.get(x.country)?.[x.id]
        const hit = reading ? await findProgramme(x.country, x.field, x.id) : null
        return hit && reading ? { p: hit.p, reading } : null
      }),
    )
  ).flatMap((x) => (x ? [x] : []))
  if (!found.length) return null

  const ids = new Set(found.map((x) => x.p.id))
  const profile = profileText(req.profile)
  const groups = Array.from({ length: Math.ceil(found.length / BATCH) }, (_, i) => found.slice(i * BATCH, (i + 1) * BATCH))
  const client = new Anthropic()
  let costMicroUsd = 0
  const results = await Promise.all(
    groups.map(async (group) => {
      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 2500,
          output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
          system: system(req.locale),
          messages: [{ role: 'user', content: `Person's profile:\n${profile}\n\nProgrammes:\n${group.map((x) => block(x.p, x.reading)).join('\n\n')}` }],
        })
        costMicroUsd += await aiSpend('fit', MODEL, response.usage)
        if (response.stop_reason !== 'end_turn') throw new Error(`stopped: ${response.stop_reason}`)
        const out = JSON.parse(response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')) as { programmes?: unknown[] }
        return (out.programmes ?? []).flatMap((raw) => {
          const f = toPersonalFit(raw, ids)
          return f ? [f] : []
        })
      } catch (e) {
        console.error(`personal comparison: ${(e as Error).message}`)
        return []
      }
    }),
  )
  return { fits: results.flat(), costMicroUsd }
}
