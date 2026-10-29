import { BIG5_KEYS, FIELDS, RIASEC_KEYS, SUBJECT_KEYS, VALUE_KEYS } from '../taxonomy/fields.ts'
import type { Big5, Field, Riasec, RiasecKey, SubjectKey, ValueKey } from '../taxonomy/fields.ts'
import { BASIC_KEYS } from '../taxonomy/basic-interests.ts'
import type { BasicKey } from '../taxonomy/basic-interests.ts'
import { musicBig5 } from './music.ts'
import { ASKED_SUBJECTS, careless, interestCompleteness, profileShape, riasecCode, riasecSummary, scoreBasic } from './questionnaire.ts'
import { correlation } from './programme-fit.ts'
import type { FieldMatch, Insight, QuestionnaireAnswers, Reason, Results, SourceId, SourceSummary, Studying } from './types.ts'
import { isGenericTopic } from './classifier.ts'
import { isStudyInfo } from './text.ts'
import { activityAgeWeight } from './recency.ts'
import { ASSESSMENT_VERSION } from './assessment-version.ts'

/**
 * The matching model. Components per field, each in 0..1:
 *
 *   basic        Interest fit from the questionnaire: the profile correlation
 *                of your basic interests with the field's (fields.ts, from
 *                O*NET knowledge), extended by the few school subjects the
 *                basic interests cannot tell apart.
 *   interest     What you actually spend attention on, from your footprint:
 *                your share of content on the field against how common that
 *                content is for everyone (log-lift), shrunk towards zero when
 *                there are few items, and rewarded for showing up across many
 *                months rather than in one burst.
 *   riasec       Without the questionnaire: congruence of the Holland profile
 *                inferred from which fields you engage with and the field's.
 *   personality  Without the questionnaire: Big Five tilts from music taste,
 *                a weak stand-in.
 *   subjects     Without the questionnaire: how the subjects you enjoy line up
 *                with what the field draws on.
 *
 * Two modes. With the interest questions answered (the standard), the
 * ranking is `basic` and nothing else. Basic-interest fit predicts better
 * than RIASEC fit (Chu et al., 2025), the profile correlation is the best
 * single interpretable fit index, and distance measures add next to nothing
 * (Granillo-Velasquez et al., 2025). Everything else stays out of the number:
 * grades are a separate note on feasibility (grades.ts), values a filter the
 * person sets (`offers`), and data from exports appear as evidence only.
 *
 * Without the interest questions the data lead. That mode is an experiment,
 * labelled as such, with low confidence.
 */

// Product weights: YouTube leads My Activity; situational Google searches and News remain supplementary.
export const SOURCE_RELIABILITY: Record<SourceId, number> = {
  takeout: 0.85,
  'google-search': 0.15,
  youtube: 0.75,
  reddit: 1,
  github: 1,
  spotify: 0.6,
  'spotify-export': 0.7,
  instagram: 0.6,
  tiktok: 0.5,
  questionnaire: 1,
}

/** Data-only mode (experiment): what the data show leads, the questionnaire parts present refine it. */
const BASE_WEIGHTS = { interest: 0.6, riasec: 0.17, personality: 0.05, subjects: 0.18 }
/** Closer than this, two fields are a tie the questionnaire can't separate. */
const TIE = 0.03
/**
 * Fields within this many points of the best in their group form one group.
 * Field profiles are coded by hand and coding sources disagree (Eggerth et
 * al., 2005), so a few points apart is no real order.
 */
export const GROUP_WIDTH = 5
/** A field «offers» a value from this level of its 0..1 profile on. */
export const OFFERS = 0.6
/** Alternatives from other areas: at most this many, at least this score. */
const ALTERNATIVES = 4
const ALTERNATIVE_MIN = 50

/** For showing evidence: what you watched and searched first, old subscriptions last. */
const KIND_WEIGHT: Record<string, number> = { watch: 3, search: 3, google: 3, comment: 0.3, like: 1.5, saved: 2, post: 2.5, upload: 2.5, repo: 2.5, subscription: 0.2 }

const FIELD_GROUP = new Map(FIELDS.map((f) => [f.id, f.group]))

/** How much each field draws on the asked subjects, standardised across fields like the basic interests. */
const SUBJECT_LEVEL: Map<string, Record<string, number>> = (() => {
  const out = new Map(FIELDS.map((f) => [f.id, {} as Record<string, number>]))
  for (const k of ASKED_SUBJECTS) {
    const raw = FIELDS.map((f) => f.subjects[k] ?? 0)
    const mean = raw.reduce((s, x) => s + x, 0) / raw.length
    const sd = Math.sqrt(raw.reduce((s, x) => s + (x - mean) ** 2, 0) / raw.length) || 1
    FIELDS.forEach((f, i) => (out.get(f.id)![k] = (raw[i] - mean) / sd))
  }
  return out
})()

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
 * Current interests: halve the weight every two calendar years; six-year-old
 * activity stays in the historical timeline but no longer affects matching.
 */
export function ageWeight(year: number, _source: SourceId, now = new Date().getFullYear()): number {
  return activityAgeWeight(year, now)
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
  locale?: string
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
    if (s.totalWeight <= 0 || !Object.keys(s.fields).some((id) => effectiveScore(s, id, studying) > 1e-6)) continue
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
        const months = ev.months.reduce((sum, month) => sum + ageWeight(Number(month.slice(0, 4)), s.source), 0)
        const pers = Math.min(1, months / Math.min(12, s.span.months))
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
  const qBasic = scoreBasic(answers)
  const qRiasec = qBasic ? riasecSummary(qBasic) : null
  let riasec: Riasec | null = null
  const riasecFrom: string[] = []
  // Answered interest scales stand on their own; data show up separately and as a capped share of the match.
  if (qRiasec) {
    riasec = qRiasec
    riasecFrom.push('questionnaire')
  } else if (footRiasec) {
    riasec = footRiasec
    riasecFrom.push('footprint')
  }

  // Big Five only from music taste (weak), and only where the data lead.
  let big5: Big5 | null = null
  // Heuristic weight only; not an empirically established reliability estimate.
  const big5Conf = 0.3
  const musicSource = summaries.find((s) => s.music)
  if (musicSource?.music) big5 = { O: 0, C: 0, E: 0, A: 0, N: 0, ...musicBig5(musicSource.music) }

  // Subjects: how much each is enjoyed, -1..1. Ability is the grades' part, shown separately.
  const subj: Partial<Record<string, number>> = {}
  for (const k of SUBJECT_KEYS) {
    const e = answers.subjects?.[k]?.enjoy
    if (typeof e === 'number' && Number.isInteger(e) && e >= 1 && e <= 5) subj[k] = (e - 3) / 2
  }
  const subjKeys = Object.keys(subj)
  // Four answers at least, and not all the same: an even rating says nothing about which subjects.
  const hasSubjects = subjKeys.length >= 4 && new Set(subjKeys.map((k) => subj[k])).size > 1

  const userR = riasec ? centeredUnit(riasec) : null
  const questionnaireLed = !!qBasic
  const shape = qBasic ? profileShape(BASIC_KEYS.map((k) => qBasic[k])) : null
  // The person's side of the interest fit: the basic interests, then the asked subjects they answered.
  const askedKeys = ASKED_SUBJECTS.filter((k) => subj[k] !== undefined)
  const person = qBasic ? [...BASIC_KEYS.map((k) => qBasic[k]), ...askedKeys.map((k) => (subj[k]! + 1) / 2)] : null
  const fieldValue = (f: Field, k: ValueKey) =>
    k === 'salary' && fieldStats[f.id]?.salaryPercentile !== undefined ? 0.5 * f.values[k] + 0.5 * fieldStats[f.id]!.salaryPercentile! : f.values[k]

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
      // When the questionnaire leads, data are evidence only, not part of the match.
      if (!questionnaireLed) w.interest = BASE_WEIGHTS.interest * (0.4 + 0.6 * footprintConf)
    }
    if (person && !shape?.flat) {
      // Profile correlation: the shape of the two profiles, not how much someone ticks overall.
      const level = SUBJECT_LEVEL.get(f.id)!
      comp.basic = (correlation(person, [...BASIC_KEYS.map((k) => f.basic[k]), ...askedKeys.map((k) => level[k])]) + 1) / 2
      w.basic = 1
    }
    if (!questionnaireLed && userR) {
      comp.riasec = (cosine(userR, centeredUnit(f.riasec)) + 1) / 2
      w.riasec = BASE_WEIGHTS.riasec
    }
    if (big5 && !questionnaireLed) {
      let dot = 0
      for (const k of BIG5_KEYS) dot += (big5[k] ?? 0) * (f.big5[k] ?? 0)
      comp.personality = 0.5 + 0.5 * Math.tanh(dot)
      w.personality = BASE_WEIGHTS.personality * big5Conf
    }
    // Without the questionnaire: the profile correlation over the answered subjects.
    if (!questionnaireLed && hasSubjects && subjKeys.some((k) => (f.subjects[k as SubjectKey] ?? 0) > 0)) {
      comp.subjects = (correlation(subjKeys.map((k) => subj[k]!), subjKeys.map((k) => f.subjects[k as SubjectKey] ?? 0)) + 1) / 2
      w.subjects = BASE_WEIGHTS.subjects
    }
    const offers = VALUE_KEYS.filter((k) => fieldValue(f, k) >= OFFERS)

    let num = 0
    let den = 0
    for (const [k, wk] of Object.entries(w)) {
      num += wk * (comp[k as keyof typeof comp] ?? 0)
      den += wk
    }
    let match = den ? num / den : 0
    if (!questionnaireLed && comp.interest !== undefined) {
      // Data alone: a field you hardly engage with drops.
      match -= 0.7 * Math.max(0, 0.5 - comp.interest) * footprintConf
    }

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
        evidence.push({ label: t.label, kind: t.kind, source: s.source, url: t.url, ...(t.interpretation ? { interpretation: t.interpretation, interpretationFromChannel: t.interpretationFromChannel } : {}), w: t.w * (KIND_WEIGHT[t.kind] ?? 1) })
      }
      // Generic words («society») count as evidence, but are not shown as terms.
      for (const [t, n] of Object.entries(ev.terms)) if (!t.includes('…') && !isGenericTopic(t)) terms.set(t, (terms.get(t) ?? 0) + n)
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
    // What does not fit: a type the field lives on that you like clearly less than your strongest.
    if (comp.riasec !== undefined && riasec) {
      const peak = Math.max(...riasec)
      const low = RIASEC_KEYS.filter((_, i) => f.riasec[i] >= 0.7 && riasec![i] <= 0.4 && riasec![i] <= peak - 0.3)
      if (low.length) reasons.push({ k: 'riasecLow', types: low })
    }
    // The basic interests you like most where the field is clearly above average, and those it needs that you like little.
    if (comp.basic !== undefined && qBasic) {
      const liked = BASIC_KEYS.filter((k) => qBasic[k] >= 0.75 && f.basic[k] >= 1).sort((a, b) => qBasic[b] * f.basic[b] - qBasic[a] * f.basic[a])
      if (liked.length) reasons.push({ k: 'basic', keys: liked.slice(0, 3) })
      const low = BASIC_KEYS.filter((k) => f.basic[k] >= 1.5 && qBasic[k] <= 0.35).sort((a, b) => f.basic[b] - f.basic[a])
      if (low.length) reasons.push({ k: 'basicLow', keys: low.slice(0, 2) as BasicKey[] })
    }
    if ((comp.subjects ?? comp.basic ?? 0) > 0.62) {
      const liked = Object.entries(f.subjects)
        .filter(([k, d]) => (d ?? 0) >= 0.6 && (subj[k] ?? 0) > 0.3)
        .map(([k]) => k as SubjectKey)
      if (liked.length) reasons.push({ k: 'subjects', subjects: liked })
    }
    if ((comp.subjects ?? comp.basic ?? 1) < 0.4) {
      const disliked = Object.entries(f.subjects)
        .filter(([k, d]) => (d ?? 0) >= 0.7 && (subj[k] ?? 0) < -0.3)
        .map(([k]) => k as SubjectKey)
      if (disliked.length) reasons.push({ k: 'subjectsLow', subjects: disliked })
    }
    if (comp.personality !== undefined && comp.personality > 0.62 && big5) {
      const k = BIG5_KEYS.filter((k) => (f.big5[k] ?? 0) * (big5![k] ?? 0) > 0.15)[0]
      if (k) reasons.push({ k: 'personality', trait: k, high: big5[k] > 0 })
    }

    evidence.sort((a, b) => b.w - a.w)
    // What does not fit comes after what does: a card's summary line shows the first reason.
    const negative = (r: Reason) => r.k === 'riasecLow' || r.k === 'subjectsLow' || r.k === 'basicLow'
    reasons.sort((a, b) => Number(negative(a)) - Number(negative(b)))
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
      offers,
    }
  })

  const sorted = [...matches].sort((a, b) => b.match - a.match)
  if (questionnaireLed) {
    // The fit as it is, not stretched: a profile that suits nothing well shouldn't read 95.
    for (const m of sorted) m.score = Math.round(100 * Math.max(0, Math.min(1, m.match)))
  } else {
    // Data alone: spread the composite so the best match reads high and an average field around 50.
    const mean = sorted.reduce((s, m) => s + m.match, 0) / sorted.length
    const sd = Math.sqrt(sorted.reduce((s, m) => s + (m.match - mean) ** 2, 0) / sorted.length) || 1
    for (const m of sorted) m.score = Math.round(100 * sigmoid((m.match - mean) / sd * 1.1))
  }

  // Groups of similar fit instead of a seemingly exact order.
  let tier = 0
  let tierTop = Infinity
  for (const m of sorted) {
    if (m.score < tierTop - GROUP_WIDTH) {
      tier++
      tierTop = m.score
    }
    m.tier = tier
  }

  // Alternatives: the best field of each area that has none among the first ten,
  // so the result does not narrow the choice to one corner (Su et al., 2009).
  const leading = sorted.slice(0, 10)
  const leadingGroups = new Set(leading.map((m) => FIELD_GROUP.get(m.id)))
  const seen = new Set<string>()
  const hidden = sorted
    .slice(10)
    .filter((m) => {
      const g = FIELD_GROUP.get(m.id)!
      if (leadingGroups.has(g) || seen.has(g)) return false
      seen.add(g)
      return m.score >= ALTERNATIVE_MIN
    })
    .slice(0, ALTERNATIVES)
    .map((m) => ({ ...m, reasons: [{ k: 'hidden' } as Reason, ...m.reasons] }))

  const dataPoints = summaries.reduce((s, x) => s + x.dataPoints, 0)
  // With the questionnaire, confidence rests on how complete and how clear it is. Signs of careless
  // answering lead to a notice of their own instead of quietly lowering it.
  // Data alone can carry a solid result when there is plenty of it; «high» needs the questionnaire.
  const isCareless = careless(answers)
  const flat = !!shape?.flat
  const confidence: Results['confidence'] = !questionnaireLed
    ? footprintConf >= 0.6 ? 'medium' : 'low'
    : flat
      ? 'low'
      : interestCompleteness(answers) >= 0.9 && (shape?.differentiation ?? 0) >= 0.45
        ? 'high'
        : 'medium'
  const topTie = sorted.length > 1 && sorted[0].match - sorted[1].match < TIE

  return {
    version: 1,
    method: { interests: ASSESSMENT_VERSION.interests, scoring: ASSESSMENT_VERSION.scoring, ...(input.locale ? { locale: input.locale } : {}) },
    generatedAt: new Date().toISOString(),
    dataPoints,
    sources: summaries.map((s) => ({ id: s.source, label: s.label, dataPoints: s.dataPoints })),
    confidence,
    fields: sorted,
    hidden,
    riasec: riasec
      ? { profile: riasec.map((x) => Math.round(x * 100) / 100) as Riasec, code: riasecCode(riasec), from: riasecFrom }
      : { profile: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], code: '', from: [] },
    ...(qBasic ? { basic: Object.fromEntries(BASIC_KEYS.map((k) => [k, Math.round(qBasic[k] * 100) / 100])) } : {}),
    quality: { flat, careless: isCareless, topTie, differentiation: shape?.differentiation ?? 0, elevation: shape?.elevation ?? 0, questionnaireLed },
    big5: big5 && !questionnaireLed ? { z: big5, from: ['music'], confidence: big5Conf } : undefined,
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
    // Older versions stored word stems («sociolog…»); they read badly. Generic words («society») are no topic.
    for (const [t, n] of Object.entries(ev.terms)) if (!t.includes('…') && !isGenericTopic(t)) termCounts.set(t, (termCounts.get(t) ?? 0) + n)
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
