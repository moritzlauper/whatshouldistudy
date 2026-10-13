/**
 * What changed in the top programmes when the content analysis was added. Each
 * programme keeps the place and the number it had before, and its place and number
 * now, with the AI's number where it rated the programme.
 */

/** How many of the top programmes the AI compares after the content analysis. */
export const COMPARE_TOP = 60

export interface ProgrammeEntry {
  id: string
  name: string
  institution: string
  /** The number shown for the programme. */
  score: number
}

export interface ProgrammeChange {
  id: string
  name: string
  institution: string
  /** Place and number before the analysis; null when the programme was not among the matches then. */
  before: { rank: number; score: number } | null
  /** Place and number now. The number is the AI's where it rated the programme; `computed` is the number without it. */
  after: { rank: number; score: number; computed: number; reasons: string[]; fit?: number }
}

/** The stored comparison: running, finished with its rows, or stopped by a limit. */
export type ProgrammeCompare =
  | { status: 'pending'; fresh?: boolean }
  | { status: 'done'; at: string; rows?: ProgrammeChange[]; key?: string }
  | { status: 'failed'; limit?: 'budget' | 'daily' }

/** Version of the key below. A comparison stored under another version was made by an older app, and no list accepts it. */
const KEY_VERSION = 4

/**
 * What a rating is based on: the questionnaire answers, the field of study and each imported source with its
 * collection time. Filters do not count, and nor do scores derived from them: those can shift between loads.
 */
export function profileKeyOf(state: { answers: unknown; prefs: unknown; summaries: unknown }): string {
  const studying = (state.prefs as { studying?: unknown } | undefined)?.studying ?? null
  const sources = Object.values((state.summaries ?? {}) as Record<string, { source?: string; collectedAt?: string } | undefined>)
    .flatMap((s) => (s ? [`${s.source ?? ''}@${s.collectedAt ?? ''}`] : []))
    .sort()
  return JSON.stringify({ v: KEY_VERSION, answers: state.answers, studying, sources })
}

/** Whether a stored comparison was made under the current key version. */
export function isCurrentKey(key: string | undefined): boolean {
  if (!key) return false
  try {
    return (JSON.parse(key) as { v?: unknown }).v === KEY_VERSION
  } catch {
    return false
  }
}

/**
 * Both lists in their order: `before` every match before the analysis, `after` the
 * compared programmes now, ordered by their shown number. Each row keeps the place
 * the programme had before, if it was among the matches then.
 */
export function programmeChanges(before: ProgrammeEntry[], after: Array<ProgrammeEntry & { computed: number; reasons: string[] }>): ProgrammeChange[] {
  const earlier = new Map(before.map((p, i) => [p.id, { rank: i + 1, score: p.score }]))
  return after.map((p, i) => ({
    id: p.id,
    name: p.name,
    institution: p.institution,
    before: earlier.get(p.id) ?? null,
    after: { rank: i + 1, score: p.score, computed: p.computed, reasons: p.reasons },
  }))
}

/** How the rows moved: up, down, new in the list, and where the AI changed the number. */
export function changeSummary(rows: ProgrammeChange[]) {
  const summary = { up: 0, down: 0, added: 0, changed: 0 }
  for (const r of rows) {
    if (!r.before) summary.added++
    else if (r.before.rank > r.after.rank) summary.up++
    else if (r.before.rank < r.after.rank) summary.down++
    if (r.after.score !== r.after.computed) summary.changed++
  }
  return summary
}
