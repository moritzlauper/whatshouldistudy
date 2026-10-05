import { BIG5_KEYS, FIELDS, SUBJECT_KEYS, VALUE_KEYS } from '../taxonomy/fields.ts'
import type { Big5, Field, Riasec, RiasecKey, SubjectKey } from '../taxonomy/fields.ts'
import { musicBig5 } from './music.ts'
import { riasecCode, scoreBig5, scoreRiasec } from './questionnaire.ts'
import type { FieldMatch, Insight, QuestionnaireAnswers, Reason, Results, SourceId, SourceSummary } from './types.ts'

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
  'google-search': 0.7,
  youtube: 0.9,
  reddit: 0.85,
  github: 0.8,
  spotify: 0.6,
  'spotify-export': 0.7,
  instagram: 0.7,
  tiktok: 0.6,
  questionnaire: 1,
}

const BASE_WEIGHTS = { interest: 0.45, riasec: 0.2, personality: 0.07, subjects: 0.18, values: 0.1 }

const POP_SUM = FIELDS.reduce((s, f) => s + f.popularity, 0)
/** Share of a typical person's content that lands in a given field. */
function baseline(f: Field): number {
  return (0.25 * f.popularity) / POP_SUM
}

export interface FieldStats {
  /** Median earnings percentile among fields (0..1), from the programme data. */
  salaryPercentile?: number
}

export interface ScoreInput {
  summaries: SourceSummary[]
  answers?: QuestionnaireAnswers
  fieldStats?: Record<string, FieldStats>
}

interface InterestDetail {
  value: number
  persistence?: number
  sources: SourceId[]
}

export function computeInterest(summaries: SourceSummary[]): { byField: Map<string, InterestDetail>; confidence: number } {
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
    for (const { s, w } of perSource) {
      const ev = s.fields[f.id]
      const p = ev ? ev.score / s.totalWeight : 0
      const b = baseline(f)
      const lift = Math.log((p + 0.001) / (b + 0.001))
      const n = ev?.items ?? 0
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
      if (v > 0.5) {
        strongSources++
        sources.push(s.source)
      }
    }
    let value = acc / weightSum
    if (strongSources >= 2) value += 0.15 * (strongSources - 1)
    byField.set(f.id, { value, persistence: persW ? persSum / persW : undefined, sources })
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
  const { summaries, answers = {}, fieldStats = {} } = input
  const footprint = summaries.filter((s) => s.source !== 'questionnaire')
  const { byField: interest, confidence: footprintConf } = computeInterest(footprint)

  // Footprint RIASEC: fields you engage with, weighted by how much.
  let footRiasec: Riasec | null = null
  if (footprintConf > 0) {
    const acc = [0, 0, 0, 0, 0, 0]
    let tot = 0
    for (const f of FIELDS) {
      const v = Math.max(0, interest.get(f.id)?.value ?? 0)
      const w = v ** 1.5
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
    const wf = 0.6 * footprintConf
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

  const matches: FieldMatch[] = FIELDS.map((f) => {
    const comp: FieldMatch['components'] = {}
    const w: Record<string, number> = {}
    const reasons: Reason[] = []
    const it = interest.get(f.id)

    if (footprintConf > 0 && it) {
      comp.interest = sigmoid(1.3 * (it.value - 0.8))
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
    const match = den ? num / den : 0

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
      for (const t of ev.top) evidence.push({ label: t.label, kind: t.kind, source: s.source, url: t.url, w: t.w })
      for (const [t, n] of Object.entries(ev.terms)) terms.set(t, (terms.get(t) ?? 0) + n)
    }
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
        .slice(0, 10)
        .map(({ w: _w, ...e }) => e),
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
    timeline: timeline(footprint),
  }
}

function dedupe<T extends { label: string }>(xs: T[]): T[] {
  const seen = new Set<string>()
  return xs.filter((x) => (seen.has(x.label) ? false : (seen.add(x.label), true)))
}


function timeline(summaries: SourceSummary[]): Results['timeline'] {
  const years = new Map<string, Map<string, number>>()
  for (const s of summaries) {
    if (!s.timeline) continue
    for (const [y, fields] of Object.entries(s.timeline)) {
      const m = years.get(y) ?? new Map<string, number>()
      // Lift over baseline, so every year isn't just "the most common topic".
      for (const [id, v] of Object.entries(fields)) m.set(id, (m.get(id) ?? 0) + v)
      years.set(y, m)
    }
  }
  return [...years.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, m]) => {
      const total = [...m.values()].reduce((s, x) => s + x, 0) || 1
      const scored = [...m.entries()].map(([id, v]) => {
        const f = FIELDS.find((x) => x.id === id)!
        return { id, share: v / total, lift: v / total / (baseline(f) * 4) }
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
