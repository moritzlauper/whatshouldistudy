import { FIELDS, FIELD_COUNT, FIELD_INDEX } from '../taxonomy/fields.ts'
import { classify, fieldVector, learningScore, saturate, termsForField } from './classifier.ts'
import type { FieldEvidence, MusicProfile, SignalItem, SourceId, SourceSummary } from './types.ts'

/**
 * Turns the raw items of one source into a SourceSummary: per field, how much
 * weight it collected, from how many items, in which months, and the most
 * telling examples. Only this summary is kept; the raw items are dropped.
 *
 * - Channel context: an item inherits half of its channel's (group's) profile,
 *   so a physics channel's vaguely titled videos still count towards physics.
 * - Diminishing returns: within one group and month, n items weigh like
 *   log2(1 + n) items. A weekend binge doesn't outweigh years of steady interest.
 * - Learning: content that reads as learning (lectures, explainers, the
 *   Education category) weighs up to 1.3×, pure entertainment down to 0.7×.
 */

const EVIDENCE_PER_FIELD = 8
const STRONG = 0.35

export interface AccumulateOptions {
  source: SourceId
  label: string
  /** Descriptions of groups (channels, subreddits), classified once per group. */
  groupText?: Map<string, string>
  stats?: Record<string, number | string>
  music?: MusicProfile
  maker?: number
  notes?: string[]
  /** Raw data points read, if more than the items passed in (e.g. music plays). */
  dataPoints?: number
}

/** Nothing we read is older than 2004; anything else is a misread date. */
const EARLIEST = Date.UTC(2004, 0, 1)
const plausible = (t: number) => t >= EARLIEST && t <= Date.now() + 86_400_000

function monthOf(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function accumulate(items: SignalItem[], opts: AccumulateOptions): SourceSummary {
  items = items.map((it) => (it.time && !plausible(it.time) ? { ...it, time: undefined } : it))
  const fieldScore = new Float64Array(FIELD_COUNT)
  const fieldItems = new Uint32Array(FIELD_COUNT)
  const fieldMonths: Array<Set<string>> = FIELDS.map(() => new Set())
  const fieldTop: Array<Array<{ label: string; kind: string; w: number; url?: string }>> = FIELDS.map(() => [])
  const fieldTerms: Array<Map<string, number>> = FIELDS.map(() => new Map())
  const timeline: Record<string, Float64Array> = {}
  const hours = new Array<number>(24).fill(0)
  let totalWeight = 0
  let learningWeight = 0
  let minT = Infinity
  let maxT = -Infinity

  // Group-level vectors, classified once.
  const groupVec = new Map<string, Float32Array>()
  if (opts.groupText) {
    for (const [g, text] of opts.groupText) groupVec.set(g, fieldVector(classify(text, { splitCamel: true })))
  }

  // Diminishing returns per group and month.
  const bucketCount = new Map<string, number>()
  const bucketOf = (it: SignalItem) => (it.group ? `${it.group}|${it.time ? monthOf(it.time) : ''}|${it.kind}` : '')
  for (const it of items) {
    const b = bucketOf(it)
    if (b) bucketCount.set(b, (bucketCount.get(b) ?? 0) + 1)
  }

  for (const it of items) {
    if (it.isMusic) continue
    const c = classify(it.text, { splitCamel: it.splitCamel })
    const vec = fieldVector(c)
    const g = it.group ? groupVec.get(it.group) : undefined
    if (g) for (let i = 0; i < FIELD_COUNT; i++) vec[i] = Math.min(1, vec[i] + 0.5 * g[i])
    if (it.fieldHints) {
      for (const id of it.fieldHints) {
        const i = FIELD_INDEX[id]
        if (i !== undefined) vec[i] = Math.max(vec[i], 0.9)
      }
    }

    const n = bucketCount.get(bucketOf(it)) ?? 1
    const dim = n > 1 ? Math.log2(1 + n) / n : 1
    const learn = learningScore(c, it.learningPrior ?? 0.3)
    const w = it.weight * dim * (0.7 + 0.6 * learn)
    totalWeight += w
    learningWeight += w * learn

    let month = ''
    if (it.time) {
      month = monthOf(it.time)
      minT = Math.min(minT, it.time)
      maxT = Math.max(maxT, it.time)
      hours[new Date(it.time).getHours()] += 1
    }
    const year = it.time ? String(new Date(it.time).getFullYear()) : ''

    for (let i = 0; i < FIELD_COUNT; i++) {
      const s = vec[i]
      if (s <= 0.05) continue
      fieldScore[i] += w * s
      if (year) (timeline[year] ??= new Float64Array(FIELD_COUNT))[i] += w * s
      if (s < STRONG) continue
      fieldItems[i] += 1
      if (month) fieldMonths[i].add(month)
      const top = fieldTop[i]
      const ew = w * s
      if (top.length < EVIDENCE_PER_FIELD || ew > top[top.length - 1].w) {
        // Keep one entry per label (a channel shows up once, with its best weight).
        const existing = top.find((t) => t.label === it.label)
        if (existing) existing.w = Math.max(existing.w, ew)
        else top.push({ label: it.label, kind: it.kind, w: ew, url: it.url })
        top.sort((a, b) => b.w - a.w)
        if (top.length > EVIDENCE_PER_FIELD) top.length = EVIDENCE_PER_FIELD
      }
      for (const t of termsForField(c, i)) fieldTerms[i].set(t, (fieldTerms[i].get(t) ?? 0) + 1)
    }
  }

  const fields: Record<string, FieldEvidence> = {}
  for (let i = 0; i < FIELD_COUNT; i++) {
    if (fieldScore[i] <= 0) continue
    fields[FIELDS[i].id] = {
      score: round(fieldScore[i]),
      items: fieldItems[i],
      months: [...fieldMonths[i]].sort(),
      top: fieldTop[i].map((t) => ({ ...t, w: round(t.w) })),
      terms: Object.fromEntries(
        [...fieldTerms[i].entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      ),
    }
  }

  const summary: SourceSummary = {
    source: opts.source,
    label: opts.label,
    collectedAt: new Date().toISOString(),
    dataPoints: opts.dataPoints ?? items.length,
    totalWeight: round(totalWeight),
    learningWeight: round(learningWeight),
    fields,
    stats: opts.stats ?? {},
    music: opts.music,
    maker: opts.maker,
    notes: opts.notes,
  }
  if (Number.isFinite(minT)) {
    const months = Math.max(1, Math.round((maxT - minT) / (30.44 * 864e5)) + 1)
    summary.span = { from: new Date(minT).toISOString(), to: new Date(maxT).toISOString(), months }
    summary.hours = hours
    summary.timeline = Object.fromEntries(
      Object.entries(timeline).map(([y, arr]) => [
        y,
        Object.fromEntries(
          [...arr]
            .map((v, i) => [FIELDS[i].id, round(v)] as const)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12),
        ),
      ]),
    )
  }
  return summary
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000
}

/** Classifies a single short text and returns the best field, for the scrapers. */
export function bestField(text: string): { id: string; strength: number } | null {
  const c = classify(text)
  let best = -1
  let bestRaw = 0
  for (let i = 0; i < FIELD_COUNT; i++) {
    if (c.raw[i] > bestRaw) {
      bestRaw = c.raw[i]
      best = i
    }
  }
  return best < 0 ? null : { id: FIELDS[best].id, strength: saturate(bestRaw) }
}
