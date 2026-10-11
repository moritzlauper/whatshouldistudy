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
  /** One sentence on what to look into before deciding. */
  check: string
  /** False when the page and the focus areas say too little to judge the content. */
  enough: boolean
}

/** The person's side of the comparison, from their answers. */
export interface LocalProfile {
  /** Holland profile in R I A S E C order, each 0..1. */
  riasec: number[]
  /** How much they enjoy the school subjects they answered, 1..5. */
  enjoy: Partial<Record<string, number>>
}

/** Why a programme fits: the interest types or the subjects that match. */
export type FitReason = { kind: 'riasec'; types: RiasecKey[] } | { kind: 'subjects'; subjects: string[] }

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

/** How the programme's content fits the profile: 60 % the interest shape, 40 % the subjects it needs. */
export function localFit(f: ProgrammeFacts, profile: LocalProfile): LocalFit {
  if (!f.enough) return { score: 50, reasons: [] }
  const r = correlation(profile.riasec, f.riasec)
  const interest = 50 + 50 * r
  // The subjects it needs, by how much the person enjoys them: 1..5 becomes 0..100; unanswered counts as 3.
  const needed = f.subjects.filter((s) => (SUBJECT_KEYS as readonly string[]).includes(s))
  const subjects = needed.length ? (needed.reduce((s, k) => s + (profile.enjoy[k] ?? 3), 0) / needed.length - 1) * 25 : 50
  const score = Math.round(Math.max(0, Math.min(100, 0.6 * interest + 0.4 * subjects)))
  const reasons: FitReason[] = []
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
