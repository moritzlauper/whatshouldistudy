import { topicFields } from './classifier.ts'
import { SOURCE_RELIABILITY, ageWeight, studiedCap, studiedKeep } from './scoring.ts'
import type { SourceId, SourceSummary, Studying } from './types.ts'

export interface UserTopic {
  key: string
  /** The word as it appeared in your data. */
  word: string
  /** 0..1; your strongest topic is 1. */
  weight: number
  /** Items that mentioned it, over all sources. */
  n: number
  bySource: Array<{ source: SourceId; n: number }>
  examples: Array<{ label: string; source: SourceId }>
}

/**
 * What you looked at, by topic, over all sources. Each source counts by its
 * share (so 50'000 watched videos don't drown out 300 searches), weighted like
 * the field interest: recent years more, older ones less, and a degree you
 * already study not from its start on. Programmes are matched on these; only
 * keys and weights go to the server, titles stay in the browser.
 */
export function userTopics(summaries: SourceSummary[], studying?: Studying, limit = 80): UserTopic[] {
  const acc = new Map<string, { w: number; word: string; n: number; bySource: Map<SourceId, number>; examples: UserTopic['examples'] }>()
  for (const s of summaries) {
    if (!s.topics) continue
    const volume = Math.min(1, Math.log10(1 + s.dataPoints) / 3)
    const reliability = (SOURCE_RELIABILITY[s.source] ?? 0.7) * volume
    const keep = studiedKeep(s.source)
    const since = studying?.since
    const activeYears = Object.keys(s.timeline ?? {}).map(Number)
    const eff = new Map<string, number>()
    let total = 0
    for (const [key, t] of Object.entries(s.topics)) {
      const studied = !!studying && topicFields(key).includes(studying.field)
      const cap = studied ? studiedCap(activeYears.length ? activeYears : Object.keys(t.y).map(Number), (y) => t.y[y] ?? 0, since) : Infinity
      let v = 0
      for (const [y, x] of Object.entries(t.y)) {
        const year = Number(y)
        const age = year ? ageWeight(year, s.source) : 0.7
        v += (studied && (!since || !year || year >= since) ? Math.min(x * keep, cap) : x) * age
      }
      eff.set(key, v)
      total += v
    }
    if (!total) continue
    for (const [key, t] of Object.entries(s.topics)) {
      const v = eff.get(key) ?? 0
      if (v <= 0) continue
      let a = acc.get(key)
      if (!a) acc.set(key, (a = { w: 0, word: t.w, n: 0, bySource: new Map(), examples: [] }))
      // One or two mentions are chance; from three on a topic counts fully.
      a.w += (v / total) * reliability * Math.min(1, t.n / 3)
      a.n += t.n
      a.bySource.set(s.source, (a.bySource.get(s.source) ?? 0) + t.n)
      for (const label of t.ex) if (a.examples.length < 3 && !a.examples.some((e) => e.label === label)) a.examples.push({ label, source: s.source })
    }
  }
  const list = [...acc].sort((a, b) => b[1].w - a[1].w).slice(0, limit)
  const max = list[0]?.[1].w ?? 0
  if (!max) return []
  return list
    .map(([key, a]) => ({
      key,
      word: a.word,
      weight: Math.round((a.w / max) * 1000) / 1000,
      n: a.n,
      bySource: [...a.bySource].map(([source, n]) => ({ source, n })).sort((x, y) => y.n - x.n),
      examples: a.examples,
    }))
    .filter((t) => t.weight >= 0.02)
}

/** What the programme search gets: topic keys and weights, nothing else. */
export function topicWeights(topics: UserTopic[]): Record<string, number> {
  return Object.fromEntries(topics.map((t) => [t.key, t.weight]))
}
