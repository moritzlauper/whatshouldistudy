import { createHash } from 'node:crypto'
import { RIASEC_KEYS, SUBJECT_KEYS } from '../../lib/taxonomy/fields.ts'

/**
 * Pure helpers for the facts database (scrapers/programme-facts.ts). A fact is
 * what Claude said about a programme's official page: how much it involves each
 * interest type, which school subjects it needs, and what to check before
 * deciding. The page text itself is never kept, only its hash, so a page that
 * has not changed costs nothing in the next run.
 */

export const CHECK_LANGUAGES = ['de', 'fr', 'it', 'en'] as const
export type CheckLanguage = (typeof CHECK_LANGUAGES)[number]

export interface StoredFact {
  id: string
  /** The page the reading came from. */
  url: string
  /** SHA-256 of the page text the reading was made from. */
  hash: string
  /** Day of the reading, YYYY-MM-DD. */
  at: string
  /** Interest types R I A S E C, 0..5. */
  riasec: number[]
  /** School subjects the programme clearly relies on, keys from SUBJECT_KEYS. */
  subjects: string[]
  /** False when the page says too little to judge the content. */
  enough: boolean
  checks: Record<CheckLanguage, string>
}

export interface PageMember {
  url: string
  hash: string
}

export const hashText = (text: string): string => createHash('sha256').update(text).digest('hex')

/** Whether the stored reading still describes this page. */
export function isUnchanged(previous: StoredFact | undefined, url: string, hash: string): boolean {
  return !!previous && previous.url === url && previous.hash === hash
}

export function batches<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

/** Fresh readings replace the old ones; programmes not read in this run keep theirs. Sorted by id. */
export function mergeFacts(previous: Record<string, StoredFact>, fresh: StoredFact[]): Record<string, StoredFact> {
  const out: Record<string, StoredFact> = { ...previous }
  for (const f of fresh) out[f.id] = f
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/**
 * Keeps what the model returned that we can use: only ids of the page that
 * was sent, known keys, values in range and one short sentence per language.
 */
export function normaliseFact(raw: unknown, sent: ReadonlyMap<string, PageMember>, at: string): StoredFact | null {
  if (!raw || typeof raw !== 'object') return null
  const x = raw as Record<string, unknown>
  if (typeof x.id !== 'string') return null
  const page = sent.get(x.id)
  if (!page) return null
  const enough = x.enough_info !== false
  const scores = (x.riasec && typeof x.riasec === 'object' ? x.riasec : {}) as Record<string, unknown>
  const riasec = RIASEC_KEYS.map((k) => (enough ? clamp(Math.round(Number(scores[k]) || 0), 0, 5) : 0))
  const subjects = enough && Array.isArray(x.subjects)
    ? [...new Set(x.subjects.filter((s): s is string => typeof s === 'string' && (SUBJECT_KEYS as readonly string[]).includes(s)))].slice(0, 6)
    : []
  const given = (x.checks && typeof x.checks === 'object' ? x.checks : {}) as Record<string, unknown>
  const checks = Object.fromEntries(
    CHECK_LANGUAGES.map((l) => [l, typeof given[l] === 'string' && enough ? (given[l] as string).trim().slice(0, 300) : '']),
  ) as Record<CheckLanguage, string>
  return { id: x.id, url: page.url, hash: page.hash, at, riasec, subjects, enough, checks }
}

export const FACTS_SYSTEM = `You describe degree programmes for a study-choice website, so that a school leaver can compare them. For each programme you get its name, institution, level, the focus areas listed for it and the text of its official web page. You know nothing about any person, and you must not guess one.

For each programme give:
- "riasec": six integers from 0 to 5, in the order R, I, A, S, E, C, for how strongly the programme's typical study and later work involves that kind of activity. R: practical, technical, hands-on, tools, lab or field work. I: research, analysis, theory, science, solving problems by reasoning. A: design, creative expression, language and media, music, art. S: teaching, helping, care, counselling, working with people. E: leading, persuading, starting projects, business, politics, sales. C: structured data, precision, documentation, administration, systems and rules. Judge the content, not the prestige. A programme that is clearly one thing scores high on that type and low on the others.
- "subjects": the school subjects from this list that the programme clearly relies on, most important first; an empty list if none is clearly needed: ${SUBJECT_KEYS.join(', ')}. Use only these keys.
- "checks": one sentence each in German (Swiss standard, never «ß», quotes «»), French, Italian and English on what the person should look into before deciding, for example admission requirements, the language of teaching, how much maths, or whether a track is really offered.
- "enough_info": false when the page and the focus areas say too little about the content to judge. Then give 0 for every type, an empty list of subjects and empty checks.

Rules: base every statement on the page text or the listed focus areas. Write the checks in your own words and never copy sentences from the page.`

export const FACTS_SCHEMA = {
  type: 'object',
  properties: {
    programmes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          riasec: {
            type: 'object',
            properties: Object.fromEntries(RIASEC_KEYS.map((k) => [k, { type: 'integer' }])),
            required: [...RIASEC_KEYS],
            additionalProperties: false,
          },
          subjects: { type: 'array', items: { type: 'string', enum: [...SUBJECT_KEYS] } },
          checks: {
            type: 'object',
            properties: Object.fromEntries(CHECK_LANGUAGES.map((l) => [l, { type: 'string' }])),
            required: [...CHECK_LANGUAGES],
            additionalProperties: false,
          },
          enough_info: { type: 'boolean' },
        },
        required: ['id', 'riasec', 'subjects', 'checks', 'enough_info'],
        additionalProperties: false,
      },
    },
  },
  required: ['programmes'],
  additionalProperties: false,
}

/** Prices in millionths of a dollar per token, set high on purpose: the cap must hold even if the list price is higher. */
export const PRICE_IN = 1
export const PRICE_OUT = 5

export const costMicroUsd = (usage: { input_tokens: number; output_tokens: number }): number =>
  Math.ceil(usage.input_tokens * PRICE_IN + usage.output_tokens * PRICE_OUT)
