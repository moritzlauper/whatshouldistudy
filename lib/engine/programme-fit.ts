import { RIASEC_KEYS, SUBJECT_KEYS, type RiasecKey } from '../taxonomy/fields.ts'

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
  /** Topics the programme clearly covers, keys of the lexicon, most central first. */
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
  const weights = profile.topics ?? {}
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  const covers = [...new Set([...(f.topics ?? []), ...(f.specialisations ?? []).flatMap((s) => s.topics)])]
  const shared = covers.filter((k) => weights[k] !== undefined).sort((a, b) => weights[b] - weights[a])
  const recall = total > 0 ? shared.reduce((s, k) => s + weights[k], 0) / total : 0
  const precision = covers.length ? shared.length / covers.length : 0
  const harmonic = recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : 0
  // Without topics on either side the part is neutral, not a miss.
  const topicScore = total > 0 && covers.length ? 100 * harmonic : 50
  const score = Math.round(Math.max(0, Math.min(100, 0.4 * interest + 0.2 * subjects + 0.4 * topicScore)))
  const reasons: FitReason[] = []
  // The specialisations that cover what the person cares about, strongest first: the most specific reason comes first.
  const named = (f.specialisations ?? [])
    .map((s) => ({ name: s.name, weight: Math.max(0, ...s.topics.map((k) => weights[k] ?? 0)) }))
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

/** A fit placed against the spread: 50 is the average programme, 15 points per standard deviation, 0..100. Unplaced without a spread. */
export function calibrated(raw: number, spread: FitSpread | null): number {
  if (!spread) return Math.round(raw)
  return Math.round(Math.max(0, Math.min(100, 50 + (15 * (raw - spread.mean)) / spread.sd)))
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

/** Claude's comparison of one programme with the person's answers, the optional step. */
export interface PersonalFit {
  id: string
  /** 1 (little in common) .. 5 (very close). */
  fit: number
  /** 0..100, consistent with fit. */
  score: number
  /** One or two short sentences in the reader's language, addressed to the person informally. */
  reasons: string[]
  /** The reading says too little to judge; the rating is neutral. */
  thin: boolean
}

/** One programme from the model's answer, kept only if it is one of the programmes asked about. */
export function toPersonalFit(raw: unknown, asked: ReadonlySet<string>): PersonalFit | null {
  if (!raw || typeof raw !== 'object') return null
  const x = raw as Record<string, unknown>
  if (typeof x.id !== 'string' || !asked.has(x.id)) return null
  // Too little on the page to judge is no reason to rank a programme low.
  if (x.enough_info === false) return { id: x.id, fit: 3, score: 50, reasons: [], thin: true }
  const fit = Math.max(1, Math.min(5, Math.round(Number(x.fit) || 1)))
  const score = Number.isFinite(Number(x.score)) ? Math.max(0, Math.min(100, Math.round(Number(x.score)))) : (fit - 1) * 25 + 12
  const reasons = (Array.isArray(x.reasons) ? x.reasons : [])
    .filter((r): r is string => typeof r === 'string')
    .map((r) => r.trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, 2)
  return { id: x.id, fit, score, reasons, thin: false }
}
