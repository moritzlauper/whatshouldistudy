import { FIELDS, RIASEC_KEYS, SUBJECT_KEYS, type RiasecKey } from '../taxonomy/fields.ts'
import { isGenericTopic, textTopics, topicFields } from './classifier.ts'

/**
 * How well a degree programme fits a person. Claude reads each programme's
 * official page and describes it: how much it involves each interest type and
 * which school subjects it needs. Nothing about the person goes to the AI; the
 * comparison with their answers happens here, in the browser.
 */

/** What Claude read about one programme. */
export interface ProgrammeFacts {
  id: string
  /** How strongly the typical study and work involves each interest type, 0..5, in R I A S E C order. */
  riasec: number[]
  /** School subjects the programme clearly relies on, keys from SUBJECT_KEYS. */
  subjects: string[]
  /** Fields the programme clearly covers (field IDs), most central first. */
  topics?: string[]
  /** The specialisations the page names, with the topics each one covers. */
  specialisations?: Array<{ name: string; topics: string[] }>
  /** What sets the programme apart, in the page's own language. */
  distinctive?: string[]
  /** One sentence on what to look into before deciding. */
  check: string
  /** False when the page and the focus areas say too little to judge the content. */
  enough: boolean
}

/** The person's side of the comparison, from their answers. */
export interface LocalProfile {
  /** The person's topics, keys of the lexicon with weights 0..1. */
  topics?: Record<string, number>
  /** Holland profile in R I A S E C order, each 0..1. */
  riasec: number[]
  /** How much they enjoy the school subjects they answered, 1..5. */
  enjoy: Partial<Record<string, number>>
}

/** Why a programme fits: the interest types or the subjects that match. */
export type FitReason =
  | { kind: 'riasec'; types: RiasecKey[] }
  | { kind: 'subjects'; subjects: string[] }
  | { kind: 'topics'; keys: string[] }
  | { kind: 'specialisations'; names: string[] }

export interface LocalFit {
  /** 0..100 from the programme's content against the profile; 50 when neutral or unknown. */
  score: number
  reasons: FitReason[]
}

/** Accept the vocabulary actually emitted by the classifier, plus legacy field IDs. */
export function validatedTopics(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(Object.entries(raw)
    .filter(([k, v]) => !isGenericTopic(k) && (topicFields(k).length > 0 || FIELDS.some((f) => f.id === k)) && typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 40).map(([k, v]) => [k, Math.max(0, Math.min(1, Number(v)))]))
}

/** Pearson correlation of two profiles, -1..1: how alike their shape is. 0 when one of them is flat. */
export function correlation(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const ma = a.slice(0, n).reduce((s, x) => s + x, 0) / n
  const mb = b.slice(0, n).reduce((s, x) => s + x, 0) / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma
    const y = b[i] - mb
    num += x * y
    da += x * x
    db += y * y
  }
  return da < 1e-9 || db < 1e-9 ? 0 : num / Math.sqrt(da * db)
}

/** How the programme's content fits the profile: 40 % the interest shape, 20 % the subjects it needs, 40 % the topics it covers. */
export function localFit(f: ProgrammeFacts, profile: LocalProfile): LocalFit {
  if (!f.enough) return { score: 50, reasons: [] }
  const r = correlation(profile.riasec, f.riasec)
  const interest = 50 + 50 * r
  // The subjects it needs, by how much the person enjoys them: 1..5 becomes 0..100; unanswered counts as 3.
  const needed = f.subjects.filter((s) => (SUBJECT_KEYS as readonly string[]).includes(s))
  const subjects = needed.length ? (needed.reduce((s, k) => s + (profile.enjoy[k] ?? 3), 0) / needed.length - 1) * 25 : 50
  // The topics the programme covers: its own focus and those of its specialisations. It fits well when it is about what the person
  // cares about (recall) and few of its topics are others (precision), so a broad programme scores lower than a focused one.
  const weights = Object.fromEntries(Object.entries(profile.topics ?? {}).filter(([, w]) => Number.isFinite(w) && w > 0))
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  const covers = [...new Set([...(f.topics ?? []), ...(f.specialisations ?? []).flatMap((s) => s.topics)])]
  // User topics are lexical terms (python, p:psycholog); readings use field IDs.
  // Keep the terms for explanations, but compare the fields each term belongs to.
  const fieldsOf = (key: string) => [key, ...topicFields(key)]
  const shared = Object.keys(weights).filter((k) => fieldsOf(k).some((field) => covers.includes(field))).sort((a, b) => weights[b] - weights[a])
  const recall = total > 0 ? shared.reduce((s, k) => s + weights[k], 0) / total : 0
  const precision = covers.length ? covers.filter((field) => shared.some((k) => fieldsOf(k).includes(field))).length / covers.length : 0
  const harmonic = recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : 0
  // Without topics on either side the part is neutral, not a miss.
  const topicScore = total > 0 && covers.length ? 100 * harmonic : 50
  const score = Math.round(Math.max(0, Math.min(100, 0.4 * interest + 0.2 * subjects + 0.4 * topicScore)))
  const reasons: FitReason[] = []
  // The specialisations that cover what the person cares about, strongest first: the most specific reason comes first.
  const named = (f.specialisations ?? [])
    .map((s) => ({ name: s.name, weight: Math.max(0, ...textTopics(s.name).map((k) => weights[k] ?? 0), ...s.topics.map((k) => weights[k] ?? 0)) }))
    .filter((s) => s.weight > 0)
    .sort((a, b) => b.weight - a.weight)
  if (named.length) reasons.push({ kind: 'specialisations', names: named.slice(0, 2).map((s) => s.name) })
  if (shared.length) reasons.push({ kind: 'topics', keys: shared.slice(0, 3) })
  const top = Math.max(0, ...profile.riasec)
  if (r >= 0.3 && top > 0) {
    const types = RIASEC_KEYS.map((k, i) => ({ k, i }))
      .filter(({ i }) => profile.riasec[i] >= 0.7 * top && f.riasec[i] >= 3)
      .sort((x, y) => profile.riasec[y.i] - profile.riasec[x.i])
      .slice(0, 2)
      .map(({ k }) => k)
    if (types.length) reasons.push({ kind: 'riasec', types })
  }
  const liked = needed.filter((s) => (profile.enjoy[s] ?? 0) >= 4)
  if (liked.length) reasons.push({ kind: 'subjects', subjects: liked.slice(0, 3) })
  return { score, reasons }
}

/** How one person's fits spread over the programmes of a country: their mean and standard deviation. */
export interface FitSpread {
  mean: number
  sd: number
}

/** The spread of the given fits; null with fewer than ten, too few to place one against. The spread is at least 5. */
export function fitSpread(scores: number[]): FitSpread | null {
  if (scores.length < 10) return null
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length
  const sd = Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length)
  return { mean, sd: Math.max(sd, 5) }
}

/** A fit placed against the spread: 50 is the average programme, 15 points per standard deviation; further out it flattens between 15 and 85, so no reading alone reaches the top. Unplaced without a spread. */
export function calibrated(raw: number, spread: FitSpread | null): number {
  if (!spread) return Math.round(raw)
  const z = (raw - spread.mean) / spread.sd
  return Math.round(50 + 35 * Math.tanh(Math.atanh(15 / 35) * z))
}

/** The profile remains the basis (80 %); content refines it (20 %), with missing content neutral. */
export const combinedScore = (match: number, score?: number, readings = score !== undefined) => (readings ? Math.round(0.8 * match + 0.2 * (score ?? 50)) : match)

/** The one number a programme shows: Claude's comparison where it rated the programme (not a thin reading), otherwise the profile with the reading's 20 %. */
export function shownScore(match: number, content: number | undefined, readings: boolean, personal?: { score: number; thin?: boolean }): number {
  return personal && !personal.thin ? personal.score : combinedScore(match, content, readings)
}

/** Strongest fields first, keeping the supplied order on equal scores. */
export const orderedFieldIds = (fields: readonly { id: string; score: number }[]): string[] => [...fields].sort((a, b) => b.score - a.score).map((f) => f.id)

/** The main subject comes first; a secondary connection is identified as such. */
export function programmeFieldMatch(p: { fields?: readonly string[]; matchedField?: string }, fieldOrder: readonly string[]): { id: string; rank: number; direct: boolean } | null {
  const primary = fieldOrder.indexOf(p.fields?.[0] ?? p.matchedField ?? '')
  if (primary >= 0) return { id: fieldOrder[primary], rank: primary + 1, direct: true }
  const secondary = fieldOrder.indexOf(p.matchedField ?? '')
  return secondary >= 0 ? { id: fieldOrder[secondary], rank: secondary + 1, direct: false } : null
}

export function programmeFieldRank(p: { fields?: readonly string[]; matchedField?: string }, fieldOrder: readonly string[]): number {
  const field = programmeFieldMatch(p, fieldOrder)
  return field ? field.rank - 1 + (field.direct ? 0 : .5) : Infinity
}

/** The best by its number first, over all results. The preferred field only decides between equal numbers; stable on ties. */
export function orderByNumber<T extends { id: string; match: number; fields?: readonly string[]; matchedField?: string }>(items: readonly T[], shownOf: (p: T) => number, fieldOrder: readonly string[] = []): T[] {
  const numbers = new Map(items.map((p) => [p.id, shownOf(p)]))
  return [...items].sort((a, b) => {
    const diff = numbers.get(b.id)! - numbers.get(a.id)!
    if (diff !== 0) return diff
    const aField = programmeFieldRank(a, fieldOrder)
    const bField = programmeFieldRank(b, fieldOrder)
    return aField === bField ? 0 : aField < bField ? -1 : 1
  })
}

/** Keeps what the model returned that we can use: known ids and keys, values in range, one short sentence. */
export function toFacts(raw: unknown, allowed: ReadonlySet<string>): ProgrammeFacts | null {
  if (!raw || typeof raw !== 'object') return null
  const x = raw as Record<string, unknown>
  if (typeof x.id !== 'string' || !allowed.has(x.id)) return null
  const enough = x.enough_info !== false
  const scores = (x.riasec && typeof x.riasec === 'object' ? x.riasec : {}) as Record<string, unknown>
  const riasec = RIASEC_KEYS.map((k) => (enough ? Math.max(0, Math.min(5, Math.round(Number(scores[k]) || 0))) : 0))
  const subjects = Array.isArray(x.subjects)
    ? [...new Set(x.subjects.filter((s): s is string => typeof s === 'string' && (SUBJECT_KEYS as readonly string[]).includes(s)))].slice(0, 6)
    : []
  return {
    id: x.id,
    riasec,
    subjects: enough ? subjects : [],
    check: typeof x.check === 'string' ? x.check.trim().slice(0, 300) : '',
    enough,
  }
}

/** Countries with readings in the facts database; the site asks only for these. */
export const FACTS_COUNTRIES = ['CH'] as const

/** Computed comparison with reasons selected by Claude, the optional step. */
/** Most programmes one request to /api/personal-fit may carry; a longer list is asked in several requests. */
export const PERSONAL_REQUEST = 20

export interface PersonalFit {
  id: string
  /** 1 (little in common) .. 5 (very close). */
  fit: number
  /** 0..100, consistent with fit. */
  score: number
  /** Complete explanations in the reader's language, addressed to the person informally. */
  reasons: string[]
  /** No sufficient reading: reasons use catalogue data and the rating stays neutral. */
  thin: boolean
}

/** One programme from the model's answer, kept only if it is one of the programmes asked about. */
export function toPersonalFit(raw: unknown, asked: ReadonlySet<string>): PersonalFit | null {
  if (!raw || typeof raw !== 'object') return null
  const x = raw as Record<string, unknown>
  if (typeof x.id !== 'string' || !asked.has(x.id)) return null
  if (typeof x.enough_info !== 'boolean') return null
  // Too little on the page to judge is no reason to rank a programme low.
  if (x.enough_info === false) return { id: x.id, fit: 3, score: 50, reasons: [], thin: true }
  const band = Math.max(1, Math.min(5, Math.round(Number(x.fit) || 3)))
  const score = typeof x.score === 'number' && Number.isFinite(x.score) ? Math.max(0, Math.min(100, Math.round(x.score))) : band * 20 - 10
  const fit = fitBand(score)
  const reasons = (Array.isArray(x.reasons) ? x.reasons : [])
    .filter((r): r is string => typeof r === 'string')
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 2)
  return { id: x.id, fit, score, reasons, thin: false }
}

export const fitBand = (score: number) => score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1

/** How far the personal comparison may move the computed score, in points either way. */
export const PERSONAL_SWING = 30

/**
 * Claude's own rating of one programme: its score kept within PERSONAL_SWING of the computed number, and at most three of its
 * explanations, without cutting off sentences. Without explanations the computed connections stand. Thin readings stay neutral.
 */
export function aiPersonalFit(raw: Record<string, unknown>, canonical: PersonalFit): PersonalFit {
  if (raw.id !== canonical.id || typeof raw.score !== 'number' || !Number.isFinite(raw.score)) throw new Error('Unknown programme or score')
  const low = Math.max(0, canonical.score - PERSONAL_SWING)
  const high = Math.min(100, canonical.score + PERSONAL_SWING)
  const score = Math.round(Math.max(low, Math.min(high, raw.score)))
  const sentences = (Array.isArray(raw.reasons) ? raw.reasons : [])
    .filter((r): r is string => typeof r === 'string')
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, 3)
  const reasons = sentences.length ? sentences : canonical.reasons
  if (canonical.thin) return { ...canonical, score: 50, fit: fitBand(50), reasons }
  return { id: canonical.id, fit: fitBand(score), score, reasons, thin: false }
}
