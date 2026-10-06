import { BIG5_KEYS, FIELDS, SUBJECT_KEYS, VALUE_KEYS } from '../taxonomy/fields.ts'
import type { Big5, Field, Riasec, RiasecKey, SubjectKey } from '../taxonomy/fields.ts'
import { musicBig5 } from './music.ts'
import { riasecCode, riasecCompleteness, scoreBig5, scoreRiasec } from './questionnaire.ts'
import type { FieldMatch, Insight, QuestionnaireAnswers, Reason, Results, SourceId, SourceSummary, Studying } from './types.ts'
import { isStudyInfo } from './text.ts'

/**
 * The matching model. Five components per field, each in 0..1:
 *
 *   interest     What you actually spend attention on, from your footprint:
 *                your share of content on the field against how common that
 *                content is for everyone (log-lift), shrunk towards zero when
 *                there are few items, and rewarded for showing up across many
 *                months rather than in one burst.
 *   riasec       Congruence of your Holland profile with the field's. Your
 *                profile comes from the questionnaire and/or is inferred from
 *                which fields you engage with, which also lets interest spread
 *                to related fields you haven't discovered.
 *   personality  Big Five tilts (questionnaire; music taste as a weak stand-in).
 *   subjects     School subjects you enjoy and are good at, against what the
 *                field draws on.
 *   values       What you want from work against what the field offers.
 *
 * Weights adapt to what is available: interest leads when there is a lot of
 * footprint data, the questionnaire carries more when there is little.
 */

export const SOURCE_RELIABILITY: Record<SourceId, number> = {
  takeout: 1,
  'google-search': 0.5,
  youtube: 1,
  reddit: 0.85,
  github: 0.8,
  spotify: 0.6,
  'spotify-export': 0.7,
  instagram: 0.7,
  tiktok: 0.6,
  questionnaire: 1,
}

const BASE_WEIGHTS = { interest: 0.56, riasec: 0.16, personality: 0.05, subjects: 0.15, values: 0.08 }

/** For showing evidence: what you watched and searched first, old subscriptions last. */
const KIND_WEIGHT: Record<string, number> = { watch: 3, search: 3, google: 3, comment: 0.3, like: 1.5, saved: 2, post: 2.5, upload: 2.5, repo: 2.5, subscription: 0.2 }

const POP_SUM = FIELDS.reduce((s, f) => s + f.popularity, 0)
/** Share of a typical person's recognised content that lands in a given field. */
function baseline(f: Field): number {
  return f.popularity / POP_SUM
}

/**
 * A field's share of what a source says about fields at all. Measured
 * against everything in the source, a big Google history (mostly shopping,
 * news, logins) would make every field look rarer than average.
 */
function fieldShare(s: SourceSummary, id: string, studying?: Studying): number {
  const total = Object.keys(s.fields).reduce((sum, f) => sum + effectiveScore(s, f, studying), 0)
  return total > 0 ? effectiveScore(s, id, studying) / total : 0
}

/**
 * How much an activity from a given year still says about you. The last two
 * years count in full; a comment from ten years ago says nothing about who you
 * are now. Subscriptions you still keep never drop to zero.
 */
export function ageWeight(year: number, source: SourceId, now = new Date().getFullYear()): number {
  const d = now - year
  if (!Number.isFinite(d) || d < -1 || year < 2004) return 0
  const w = d <= 1 ? 1 : d <= 4 ? 1 - 0.15 * (d - 1) : d <= 7 ? 0.4 - 0.1 * (d - 5) : 0
  return source === 'youtube' ? Math.max(w, 0.15) : w
}

/** What a source keeps of a degree's coursework: Google is mostly looking things up for it. */
export const studiedKeep = (source: SourceId) => (source === 'google-search' ? 0.1 : 0.35)

/**
 * The most a year counts for a field you already study, from the start of the
 * degree on: an average year before it. Studying something makes you look at
 * it a lot; that mustn't make it a bigger interest than it was.
 */
export function studiedCap(activeYears: number[], valueOf: (year: number) => number, since?: number): number {
  if (!since) return Infinity
  const before = activeYears.filter((y) => y >= 2004 && y < since)
  if (!before.length) return Infinity
  return before.reduce((sum, y) => sum + valueOf(y), 0) / before.length
}

/**
 * A field's weight in a source, read from the per-year totals so it also
 * works on data stored by older versions:
 * - older years count less (ageWeight), misread years not at all;
 * - a field you already study keeps only a small part of what came after you
 *   started (Google 10 %, the rest 35 %), and never more than an average year
 *   before: that's coursework, not interest.
 */
function effectiveScore(s: SourceSummary, id: string, studying?: Studying): number {
  const ev = s.fields[id]
  if (!ev) return 0
  const studied = studying?.field === id
  const keep = studiedKeep(s.source)
  const since = studying?.since
  const cap = studied ? studiedCap(Object.keys(s.timeline ?? {}).map(Number), (y) => s.timeline![y]?.[id] ?? 0, since) : Infinity
  let timed = 0
  let eff = 0
  for (const [y, m] of Object.entries(s.timeline ?? {})) {
    const v = m[id] ?? 0
    if (!v) continue
    const year = Number(y)
    timed += v
    const counted = studied && (!since || year >= since) ? Math.min(v * keep, cap) : v
    eff += counted * ageWeight(year, s.source)
  }
  // Activity without a date (subscriptions from exports, some likes) counts as it is.
  const undated = Math.max(0, ev.score - timed)
  return eff + undated * (studied && !studying!.since ? keep : 1)
}

export interface FieldStats {
  /** Median earnings percentile among fields (0..1), from the programme data. */
  salaryPercentile?: number
}

export interface ScoreInput {
  summaries: SourceSummary[]
  answers?: QuestionnaireAnswers
  fieldStats?: Record<string, FieldStats>
  studying?: Studying
}

interface InterestDetail {
  value: number
  persistence?: number
  sources: SourceId[]
  /** What each source added to the interest value (only positive parts). */
  bySource: Partial<Record<SourceId, number>>
}

export function computeInterest(summaries: SourceSummary[], studying?: Studying): { byField: Map<string, InterestDetail>; confidence: number } {
  const byField = new Map<string, InterestDetail>()
  let weightSum = 0
  const perSource: Array<{ s: SourceSummary; w: number }> = []
  for (const s of summaries) {
    if (s.totalWeight <= 0) continue
    const volume = Math.min(1, Math.log10(1 + s.dataPoints) / 3)
    const w = (SOURCE_RELIABILITY[s.source] ?? 0.7) * volume
    perSource.push({ s, w })
    weightSum += w
  }
  if (!weightSum) return { byField, confidence: 0 }

  for (const f of FIELDS) {
    let acc = 0
    let strongSources = 0
    let persSum = 0
    let persW = 0
    const sources: SourceId[] = []
    const bySource: Partial<Record<SourceId, number>> = {}
    for (const { s, w } of perSource) {
      const ev = s.fields[f.id]
      const p = fieldShare(s, f.id, studying)
      const b = baseline(f)
      const lift = Math.log((p + 0.004) / (b + 0.004))
      const n = ev ? ev.items * (ev.score > 0 ? effectiveScore(s, f.id, studying) / ev.score : 1) : 0
      const shrink = n / (n + 4)
      let factor = 0.9
      if (s.span && s.span.months >= 3 && ev) {
        const pers = Math.min(1, ev.months.length / Math.min(12, s.span.months))
        factor = 0.65 + 0.35 * pers
        persSum += pers * w
        persW += w
      }
      const v = lift > 0 ? shrink * lift * factor : 0.3 * lift * Math.max(shrink, 0.3)
      acc += w * v
      if (v > 0) bySource[s.source] = (bySource[s.source] ?? 0) + w * v
      if (v > 0.5) {
        strongSources++
        sources.push(s.source)
      }
    }
    let value = acc / weightSum
    if (strongSources >= 2) value += 0.15 * (strongSources - 1)
    byField.set(f.id, { value, persistence: persW ? persSum / persW : undefined, sources, bySource })
  }
  return { byField, confidence: Math.min(1, weightSum) }
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

function centeredUnit(v: number[]): number[] {
  const m = v.reduce((s, x) => s + x, 0) / v.length
  const c = v.map((x) => x - m)
  const n = Math.sqrt(c.reduce((s, x) => s + x * x, 0)) || 1
  return c.map((x) => x / n)
}

function cosine(a: number[], b: number[]): number {
  return a.reduce((s, x, i) => s + x * b[i], 0)
}

export function score(input: ScoreInput): Results {
  const { summaries, answers = {}, fieldStats = {}, studying } = input
  const footprint = summaries.filter((s) => s.source !== 'questionnaire')
  const { byField: interest, confidence: footprintConf } = computeInterest(footprint, studying)

  // Footprint RIASEC: what you actually spend your attention on. Unlike field
  // interest this isn't measured against what everyone watches: making music
  // is artistic even though music is common, so the plain share counts.
  let footRiasec: Riasec | null = null
  if (footprintConf > 0) {
    const acc = [0, 0, 0, 0, 0, 0]
    let tot = 0
    const sourceW = footprint.filter((s) => s.totalWeight > 0).map((s) => ({ s, w: (SOURCE_RELIABILITY[s.source] ?? 0.7) * Math.min(1, Math.log10(1 + s.dataPoints) / 3) }))
    for (const f of FIELDS) {
      const attention = sourceW.reduce((sum, { s, w }) => sum + w * fieldShare(s, f.id, studying), 0)
      const w = attention ** 1.3
      if (!w) continue
      f.riasec.forEach((x, i) => (acc[i] += w * x))
      tot += w
    }
    if (tot > 0) {
      const max = Math.max(...acc)
      footRiasec = acc.map((x) => x / max) as Riasec
    }
  }
  const qRiasec = scoreRiasec(answers)
  let riasec: Riasec | null = null
  const riasecFrom: string[] = []
  if (qRiasec && footRiasec) {
    // The more of the questionnaire is answered, the less the footprint shifts the profile.
    const wf = 0.6 * footprintConf * (1 - 0.6 * riasecCompleteness(answers))
    riasec = qRiasec.map((x, i) => (x + wf * footRiasec![i]) / (1 + wf)) as Riasec
    riasecFrom.push('questionnaire', 'footprint')
  } else if (qRiasec) {
    riasec = qRiasec
    riasecFrom.push('questionnaire')
  } else if (footRiasec) {
    riasec = footRiasec
    riasecFrom.push('footprint')
  }

  // Big Five: questionnaire, else music taste (weak).
  const qBig5 = scoreBig5(answers)
  let big5: Big5 | null = qBig5
  let big5Conf = qBig5 ? 1 : 0
  const big5From: string[] = qBig5 ? ['questionnaire'] : []
  const musicSource = summaries.find((s) => s.music)
  if (musicSource?.music) {
    const nudge = musicBig5(musicSource.music)
    if (!big5) {
      big5 = { O: 0, C: 0, E: 0, A: 0, N: 0, ...nudge }
      big5Conf = 0.3
    }
    big5From.push('music')
  }

  // Subjects: enjoyment counts more than grades.
  const subj: Partial<Record<string, number>> = {}
  for (const k of SUBJECT_KEYS) {
    const s = answers.subjects?.[k]
    if (!s || (!s.enjoy && !s.grade)) continue
    const e = s.enjoy ?? s.grade!
    const g = s.grade ?? s.enjoy!
    subj[k] = (0.6 * e + 0.4 * g - 3) / 2
  }
  const hasSubjects = Object.keys(subj).length >= 4

  const valueWeights: Partial<Record<string, number>> = {}
  for (const k of VALUE_KEYS) {
    const v = answers.values?.[k]
    if (typeof v === 'number') valueWeights[k] = (v - 1) / 4
  }
  const hasValues = Object.values(valueWeights).some((w) => (w ?? 0) > 0)

  const userR = riasec ? centeredUnit(riasec) : null

  // Per source and label, the field where an evidence item weighs most.
  const bestEvidence = new Map<SourceId, Map<string, number>>()
  for (const s of footprint) {
    const m = new Map<string, number>()
    for (const ev of Object.values(s.fields)) for (const t of ev.top) m.set(t.label, Math.max(m.get(t.label) ?? 0, t.w))
    bestEvidence.set(s.source, m)
  }

  const matches: FieldMatch[] = FIELDS.map((f) => {
    const comp: FieldMatch['components'] = {}
    const w: Record<string, number> = {}
    const reasons: Reason[] = []
    const it = interest.get(f.id)

    if (footprintConf > 0 && it) {
      comp.interest = sigmoid(1.7 * (it.value - 0.8))
      w.interest = BASE_WEIGHTS.interest * (0.4 + 0.6 * footprintConf)
    }
    if (userR) {
      const cos = cosine(userR, centeredUnit(f.riasec))
      comp.riasec = (cos + 1) / 2
      w.riasec = qRiasec ? BASE_WEIGHTS.riasec : 0.12
    }
    if (big5) {
      let dot = 0
      for (const k of BIG5_KEYS) dot += (big5[k] ?? 0) * (f.big5[k] ?? 0)
      comp.personality = 0.5 + 0.5 * Math.tanh(dot)
      w.personality = BASE_WEIGHTS.personality * big5Conf
    }
    if (hasSubjects) {
      let num = 0
      let den = 0
      for (const [k, demand] of Object.entries(f.subjects)) {
        const s = subj[k]
        if (s === undefined || !demand) continue
        num += demand * s
        den += demand
      }
      if (den > 0) {
        comp.subjects = 0.5 + 0.5 * Math.max(-1, Math.min(1, num / den))
        w.subjects = BASE_WEIGHTS.subjects
      }
    }
    if (hasValues) {
      let num = 0
      let den = 0
      for (const k of VALUE_KEYS) {
        const uw = valueWeights[k] ?? 0
        if (!uw) continue
        let fv = f.values[k]
        if (k === 'salary' && fieldStats[f.id]?.salaryPercentile !== undefined) {
          fv = 0.5 * fv + 0.5 * fieldStats[f.id]!.salaryPercentile!
        }
        num += uw * fv
        den += uw
      }
      if (den > 0) {
        comp.values = num / den
        w.values = BASE_WEIGHTS.values
      }
    }

    let num = 0
    let den = 0
    for (const [k, wk] of Object.entries(w)) {
      num += wk * (comp[k as keyof typeof comp] ?? 0)
      den += wk
    }
    let match = den ? num / den : 0
    // With plenty of data, a field you hardly engage with can't ride on the
    // questionnaire alone: the less you engage, the more it drops.
    if (comp.interest !== undefined) match -= 0.7 * Math.max(0, 0.5 - comp.interest) * footprintConf

    // Where the match comes from: the interest part split by source, the
    // questionnaire parts as they are.
    const parts: Record<string, number> = {}
    for (const [k, wk] of Object.entries(w)) {
      const c = wk * (comp[k as keyof typeof comp] ?? 0)
      if (k !== 'interest') {
        // Without a questionnaire the interest type is inferred from the data.
        parts[k === 'riasec' && !qRiasec ? 'riasecData' : k] = c
        continue
      }
      const src = Object.entries(it?.bySource ?? {}) as Array<[string, number]>
      const total = src.reduce((s, [, v]) => s + v, 0)
      if (total > 0) for (const [id, v] of src) parts[id] = (parts[id] ?? 0) + (c * v) / total
      else parts.footprint = c
    }
    const partSum = Object.values(parts).reduce((s, v) => s + v, 0) || 1
    const contributions = Object.entries(parts)
      .map(([key, v]) => ({ key, share: v / partSum }))
      .filter((x) => x.share >= 0.005)
      .sort((a, b) => b.share - a.share)

    // Reasons, strongest first.
    const evidence: Array<FieldMatch['evidence'][number] & { w: number }> = []
    const terms = new Map<string, number>()
    let items = 0
    let months = new Set<string>()
    for (const s of footprint) {
      const ev = s.fields[f.id]
      if (!ev) continue
      items += ev.items
      months = new Set([...months, ...ev.months])
      const strongest = bestEvidence.get(s.source)
      for (const t of ev.top) {
        // A channel about music that also mentions society is evidence for music, not sociology.
        if (t.w < 0.8 * (strongest?.get(t.label) ?? 0)) continue
        // Searching for a programme is the decision, not a reason for it.
        if (isStudyInfo(t.label, t.kind)) continue
        // Comments are chatter, often years old: not shown as evidence.
        if (t.kind === 'comment') continue
        evidence.push({ label: t.label, kind: t.kind, source: s.source, url: t.url, w: t.w * (KIND_WEIGHT[t.kind] ?? 1) })
      }
      for (const [t, n] of Object.entries(ev.terms)) if (!t.includes('…')) terms.set(t, (terms.get(t) ?? 0) + n)
    }
    if (studying?.field === f.id) reasons.push({ k: 'studying', since: studying.since })
    if (comp.interest !== undefined && comp.interest > 0.55 && items > 0) {
      reasons.push({ k: 'interest', items, months: months.size })
    }
    if (comp.riasec !== undefined && comp.riasec > 0.75 && riasec) {
      const code = riasecCode(riasec)
      const fieldCode = riasecCode(f.riasec)
      const shared = [...code].filter((c) => fieldCode.includes(c))
      if (shared.length) reasons.push({ k: 'riasec', types: shared as RiasecKey[] })
    }
    if (comp.subjects !== undefined && comp.subjects > 0.62) {
      const liked = Object.entries(f.subjects)
        .filter(([k, d]) => (d ?? 0) >= 0.6 && (subj[k] ?? 0) > 0.3)
        .map(([k]) => k as SubjectKey)
      if (liked.length) reasons.push({ k: 'subjects', subjects: liked })
    }
    if (comp.subjects !== undefined && comp.subjects < 0.4) {
      const disliked = Object.entries(f.subjects)
        .filter(([k, d]) => (d ?? 0) >= 0.7 && (subj[k] ?? 0) < -0.3)
        .map(([k]) => k as SubjectKey)
      if (disliked.length) reasons.push({ k: 'subjectsLow', subjects: disliked })
    }
    if (comp.values !== undefined && comp.values > 0.7) {
      const offered = VALUE_KEYS.filter((k) => (valueWeights[k] ?? 0) >= 0.75 && f.values[k] >= 0.75)
      if (offered.length) reasons.push({ k: 'values', values: offered })
    }
    if (comp.personality !== undefined && comp.personality > 0.62 && big5) {
      const k = BIG5_KEYS.filter((k) => (f.big5[k] ?? 0) * (big5![k] ?? 0) > 0.15)[0]
      if (k) reasons.push({ k: 'personality', trait: k, high: big5[k] > 0 })
    }

    evidence.sort((a, b) => b.w - a.w)
    return {
      id: f.id,
      match,
      score: 0,
      components: comp,
      interest: it?.value,
      reasons,
      evidence: dedupe(evidence)
        .filter((e, i, all) => e.kind !== 'subscription' || all.slice(0, i).filter((x) => x.kind === 'subscription').length < 2)
        .slice(0, 10)
        .map(({ w: _w, ...e }) => e),
      contributions,
      terms: [...terms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t),
      persistence: it?.persistence,
      sources: it?.sources ?? [],
    }
  })

  // Display scores: spread the composite so the best match reads in the 90s
  // and an average field around 50, without pretending to absolute precision.
  const sorted = [...matches].sort((a, b) => b.match - a.match)
  const mean = sorted.reduce((s, m) => s + m.match, 0) / sorted.length
  const sd = Math.sqrt(sorted.reduce((s, m) => s + (m.match - mean) ** 2, 0) / sorted.length) || 1
  for (const m of sorted) m.score = Math.round(100 * sigmoid((m.match - mean) / sd * 1.1))

  const top = sorted.slice(0, 12)
  const topIds = new Set(top.map((m) => m.id))
  const hidden = sorted
    .filter((m) => !topIds.has(m.id))
    .filter((m) => (m.components.interest ?? 0) < 0.4)
    .map((m) => {
      const parts = (['riasec', 'subjects', 'personality', 'values'] as const)
        .map((k) => m.components[k])
        .filter((x): x is number => x !== undefined)
      return { m, fit: parts.length ? parts.reduce((s, x) => s + x, 0) / parts.length : 0 }
    })
    .filter((x) => x.fit > 0.6)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 4)
    .map((x) => ({ ...x.m, reasons: [{ k: 'hidden' } as Reason, ...x.m.reasons] }))

  const dataPoints = summaries.reduce((s, x) => s + x.dataPoints, 0)
  const answeredQ = !!(qRiasec || qBig5 || hasSubjects)
  const confidence: Results['confidence'] =
    footprintConf >= 0.9 && answeredQ ? 'high' : footprintConf >= 0.6 || (answeredQ && footprintConf > 0.2) ? 'medium' : 'low'

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    dataPoints,
    sources: summaries.map((s) => ({ id: s.source, label: s.label, dataPoints: s.dataPoints })),
    confidence,
    fields: sorted,
    hidden,
    riasec: riasec
      ? { profile: riasec.map((x) => Math.round(x * 100) / 100) as Riasec, code: riasecCode(riasec), from: riasecFrom }
      : { profile: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], code: '', from: [] },
    big5: big5 ? { z: big5, from: big5From, confidence: big5Conf } : undefined,
    insights: insights(footprint, interest, sorted),
    timeline: timeline(footprint, studying),
  }
}

function dedupe<T extends { label: string }>(xs: T[]): T[] {
  const seen = new Set<string>()
  return xs.filter((x) => (seen.has(x.label) ? false : (seen.add(x.label), true)))
}


function timeline(summaries: SourceSummary[], studying?: Studying): Results['timeline'] {
  const years = new Map<string, Map<string, number>>()
  for (const s of summaries) {
    if (!s.timeline) continue
    for (const [y, fields] of Object.entries(s.timeline)) {
      // Data read by older versions can carry misread dates (1953, 202218).
      if (!/^\d{4}$/.test(y) || Number(y) < 2004 || Number(y) > new Date().getFullYear() + 1) continue
      const m = years.get(y) ?? new Map<string, number>()
      // Lift over baseline, so every year isn't just "the most common topic".
      for (const [id, v] of Object.entries(fields)) {
        // The degree you're in, from the year it started: coursework, not a shift in interest.
        if (studying?.field === id && (!studying.since || Number(y) >= studying.since)) continue
        m.set(id, (m.get(id) ?? 0) + v)
      }
      years.set(y, m)
    }
  }
  return [...years.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, m]) => {
      const total = [...m.values()].reduce((s, x) => s + x, 0) || 1
      const scored = [...m.entries()].map(([id, v]) => {
        const f = FIELDS.find((x) => x.id === id)!
        return { id, share: v / total, lift: v / total / baseline(f) }
      })
      return {
        year,
        fields: scored
          .sort((a, b) => b.lift * Math.sqrt(b.share) - a.lift * Math.sqrt(a.share))
          .slice(0, 3)
          .map(({ id, share }) => ({ id, share: Math.round(share * 1000) / 1000 })),
      }
    })
    .filter((y) => y.fields.length)
}

function insights(
  summaries: SourceSummary[],
  interest: Map<string, InterestDetail>,
  sorted: FieldMatch[],
): Insight[] {
  const out: Insight[] = []
  const total = summaries.reduce((s, x) => s + x.totalWeight, 0)
  const learn = summaries.reduce((s, x) => s + x.learningWeight, 0)
  const points = summaries.reduce((s, x) => s + x.dataPoints, 0)
  if (points) out.push({ id: 'datapoints', data: { points, sources: summaries.length } })
  if (total > 0) out.push({ id: 'learning', data: { share: Math.round((learn / total) * 100) } })

  const pos = [...interest.entries()].filter(([, d]) => d.value > 0.3)
  if (pos.length >= 3) {
    const sum = pos.reduce((s, [, d]) => s + d.value, 0)
    let h = 0
    for (const [, d] of pos) {
      const p = d.value / sum
      h -= p * Math.log(p)
    }
    const breadth = h / Math.log(Math.max(2, Math.min(pos.length, 25)))
    const groups = new Set(sorted.slice(0, 3).map((m) => FIELDS.find((f) => f.id === m.id)!.group)).size
    const style = pos.length >= 12 && breadth > 0.8 ? 'explorer' : pos.length <= 6 ? 'specialist' : 'focused'
    out.push({ id: 'breadth', data: { style, areas: pos.length, spread: groups === 3 } })
  }

  const pers = sorted
    .slice(0, 5)
    .map((m) => m.persistence)
    .filter((x): x is number => x !== undefined)
  if (pers.length >= 2) {
    const avgP = pers.reduce((s, x) => s + x, 0) / pers.length
    out.push({ id: 'consistency', data: { level: avgP > 0.6 ? 'long' : avgP > 0.3 ? 'recurring' : 'recent' } })
  }

  const hours = new Array(24).fill(0)
  for (const s of summaries) s.hours?.forEach((h, i) => (hours[i] += h))
  const hTotal = hours.reduce((s, x) => s + x, 0)
  if (hTotal > 200) {
    const night = (hours[0] + hours[1] + hours[2] + hours[3] + hours[4]) / hTotal
    const peak = hours.indexOf(Math.max(...hours))
    out.push({ id: 'rhythm', data: { type: night > 0.2 ? 'owl' : peak < 12 ? 'early' : 'day', peak, night: Math.round(night * 100) } })
  }

  const maker = summaries.reduce((s, x) => s + (x.maker ?? 0), 0)
  if (maker > 0) out.push({ id: 'maker', data: { count: maker } })
  return out
}

export interface SourceProfile {
  /** Fields this source leans to (most above the usual share first), with their share and a few examples. */
  fields: Array<{ id: string; share: number; examples: Array<{ label: string; kind: string }> }>
  terms: string[]
  /** Share of attention that looks like learning, 0..1. */
  learning?: number
  /** Busiest three hours of the day, start hour. */
  peakHour?: number
}

/** What one source says on its own, for the detailed report. */
export function sourceProfile(s: SourceSummary, studying?: Studying): SourceProfile {
  const fields = FIELDS.map((f) => {
    const ev = s.fields[f.id]
    if (!ev || ev.items < 3) return null
    const p = fieldShare(s, f.id, studying)
    return { id: f.id, share: p, lift: (ev.items / (ev.items + 4)) * Math.log((p + 0.004) / (baseline(f) + 0.004)) }
  })
    .filter((x): x is { id: string; share: number; lift: number } => !!x && x.lift > 0)
    .sort((a, b) => b.lift - a.lift)
    .slice(0, 3)
  const termCounts = new Map<string, number>()
  for (const ev of Object.values(s.fields)) {
    // Older versions stored word stems («sociolog…»); they read badly.
    for (const [t, n] of Object.entries(ev.terms)) if (!t.includes('…')) termCounts.set(t, (termCounts.get(t) ?? 0) + n)
  }
  // Examples: what was watched, searched or liked first, a subscription only if that's all there is.
  const examplesFor = (id: string) =>
    [...(s.fields[id]?.top ?? [])]
      .filter((t) => t.kind !== 'comment' && !isStudyInfo(t.label, t.kind))
      .sort((a, b) => (a.kind === 'subscription' ? 1 : 0) - (b.kind === 'subscription' ? 1 : 0) || b.w - a.w)
      .slice(0, 2)
      .map((t) => ({ label: t.label, kind: t.kind }))
  let peakHour: number | undefined
  if (s.hours && s.hours.reduce((a, b) => a + b, 0) >= 50) {
    let best = -1
    for (let h = 0; h < 24; h++) {
      const v = s.hours[h] + s.hours[(h + 1) % 24] + s.hours[(h + 2) % 24]
      if (v > best) [best, peakHour] = [v, h]
    }
  }
  return {
    fields: fields.map(({ id, share }) => ({ id, share, examples: examplesFor(id) })),
    terms: [...termCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t),
    learning: s.totalWeight > 0 ? s.learningWeight / s.totalWeight : undefined,
    peakHour,
  }
}
