import { FIELDS, FIELD_COUNT, FIELD_INDEX } from '../taxonomy/fields.ts'
import { classify, fieldVector, learningScore, saturate, termsForField, topics } from './classifier.ts'
import { isStudyInfo } from './text.ts'
import type { FieldEvidence, MusicProfile, SignalItem, SourceId, SourceSummary, Topic } from './types.ts'

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
/** Older than this, an item still counts (scoring weighs it down by age) but isn't shown as evidence. */
const EVIDENCE_MAX_AGE = 6 * 365.25 * 864e5
const TOPICS_KEPT = 200
/**
 * Bump when reading or classifying changes in a way stored summaries can't
 * pick up (new filters, new lexicon terms); the results page then suggests
 * reading the files again.
 */
export const SUMMARY_VERSION = 3

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

/** How an item reads as an example: a video by its title (and channel), the rest by its label. */
function exampleOf(it: SignalItem): string {
  if (it.kind !== 'watch') return it.label
  const [title, channel] = it.text.split('\n').map((x) => x.trim())
  if (!title) return it.label
  const t = title.length > 120 ? title.slice(0, 119).trimEnd() + '…' : title
  return channel ? `${t} · ${channel}` : t
}

function monthOf(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function accumulate(items: SignalItem[], opts: AccumulateOptions): SourceSummary {
  items = items.map((it) => (it.time && !plausible(it.time) ? { ...it, time: undefined } : it))
  const fieldScore = new Float64Array(FIELD_COUNT)
  const fieldItems = new Uint32Array(FIELD_COUNT)
  const fieldMonths: Array<Set<string>> = FIELDS.map(() => new Set())
  // `key` keeps one entry per channel (or label); it isn't stored.
  const fieldTop: Array<Array<{ label: string; kind: string; w: number; url?: string; key: string }>> = FIELDS.map(() => [])
  const fieldTerms: Array<Map<string, number>> = FIELDS.map(() => new Map())
  const timeline: Record<string, Float64Array> = {}
  const topicMap = new Map<string, Topic>()
  const study = { n: 0, fields: new Map<string, number>(), ex: [] as string[] }
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
    // Looking into a degree is the decision itself, not an interest: noted, never counted.
    if (it.studyInfo || isStudyInfo(it.text, it.kind)) {
      study.n += 1
      const v = fieldVector(c)
      for (let i = 0; i < FIELD_COUNT; i++) if (v[i] >= STRONG) study.fields.set(FIELDS[i].id, (study.fields.get(FIELDS[i].id) ?? 0) + 1)
      const ex = exampleOf(it)
      if (study.ex.length < 4 && !study.ex.includes(ex)) study.ex.push(ex)
      continue
    }
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

    let vmax = 0
    for (let i = 0; i < FIELD_COUNT; i++) vmax = Math.max(vmax, vec[i])
    const stale = !!it.time && Date.now() - it.time > EVIDENCE_MAX_AGE
    if (!stale) {
      for (const t of topics(c)) {
        let e = topicMap.get(t.key)
        if (!e) topicMap.set(t.key, (e = { w: t.word, n: 0, y: {}, ex: [] }))
        e.n += 1
        e.y[year || '0'] = (e.y[year || '0'] ?? 0) + w
        const ex = e.ex.length < 2 ? exampleOf(it) : ''
        if (ex && !e.ex.includes(ex)) e.ex.push(ex)
      }
    }
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
      // Evidence only where the item is (nearly) strongest.
      if (!stale && s >= 0.8 * vmax && (top.length < EVIDENCE_PER_FIELD || ew > top[top.length - 1].w)) {
        // One entry per channel (or label), with its best item: the video
        // title shows what it was about, the channel name alone doesn't.
        const key = it.group ?? it.label
        const existing = top.find((t) => t.key === key)
        if (existing) {
          if (ew > existing.w) Object.assign(existing, { label: exampleOf(it), w: ew, url: it.url })
        } else top.push({ label: exampleOf(it), kind: it.kind, w: ew, url: it.url, key })
        top.sort((a, b) => b.w - a.w)
        if (top.length > EVIDENCE_PER_FIELD) top.length = EVIDENCE_PER_FIELD
      }
      if (!stale) for (const t of termsForField(c, i)) fieldTerms[i].set(t, (fieldTerms[i].get(t) ?? 0) + 1)
    }
  }

  const fields: Record<string, FieldEvidence> = {}
  for (let i = 0; i < FIELD_COUNT; i++) {
    if (fieldScore[i] <= 0) continue
    fields[FIELDS[i].id] = {
      score: round(fieldScore[i]),
      items: fieldItems[i],
      months: [...fieldMonths[i]].sort(),
      top: fieldTop[i].map(({ key: _key, ...t }) => ({ ...t, w: round(t.w) })),
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
    v: SUMMARY_VERSION,
  }
  if (study.n) {
    summary.studyInfo = {
      n: study.n,
      fields: Object.fromEntries([...study.fields].sort((a, b) => b[1] - a[1]).slice(0, 6)),
      ex: study.ex,
    }
  }
  if (topicMap.size) {
    const total = (t: Topic) => Object.values(t.y).reduce((a, b) => a + b, 0)
    summary.topics = Object.fromEntries(
      [...topicMap]
        .sort((a, b) => total(b[1]) - total(a[1]))
        .slice(0, TOPICS_KEPT)
        .map(([k, t]) => [k, { ...t, y: Object.fromEntries(Object.entries(t.y).map(([yr, v]) => [yr, round(v)])) }]),
    )
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
