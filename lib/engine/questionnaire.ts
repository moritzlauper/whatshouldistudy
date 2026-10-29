import { RIASEC_KEYS, SUBJECT_KEYS } from '../taxonomy/fields.ts'
import type { Riasec, RiasecKey } from '../taxonomy/fields.ts'
import { BASIC_INTERESTS, BASIC_KEYS, SUBJECT_RIASEC } from '../taxonomy/basic-interests.ts'
import type { BasicKey, BasicProfile } from '../taxonomy/basic-interests.ts'
import type { SubjectKey } from '../taxonomy/fields.ts'
import type { QuestionnaireAnswers } from './types.ts'

/**
 * The questionnaire asks only what decides the result: how much someone
 * enjoys their school subjects, what they would like doing in areas no
 * subject covers, and roughly their last maths grade. Everything else would
 * lengthen it without changing the ranking.
 */

export interface LikertItem {
  id: string
  text: string
  /** The basic interest the item belongs to; `check` for instructed items. */
  key: string
}

/**
 * Three activities per basic interest, rated for liking: 1 (dislike) .. 5
 * (love). The CABIN-NET items are the published public-domain wording
 * (Chu et al., 2025, Table 1); agriculture, protective service and media are
 * our own items, written in the same style. Translations are our own and not adapted after Beaton et
 * al. (2000).
 */
const ITEMS: Record<BasicKey, [string, string, string]> = {
  mechanics: ['Repair car engines', 'Perform aircraft maintenance', 'Maintain wind turbine generators'],
  construction: ['Build kitchen cabinets', 'Sand and refinish a piece of furniture', 'Build a fence'],
  engineering: ['Design a structure that can withstand heavy wind', 'Develop lighter and stronger materials for new products', 'Redesign a production line to improve its efficiency'],
  agriculture: ['Grow vegetables or fruit and bring in the harvest', 'Look after a forest, a river or a nature reserve', 'Find out which soil suits which plant'],
  protective: ['Solve a crime and secure the evidence', 'Keep people safe at a large event', 'Check that rules and regulations are followed'],
  medicalScience: ['Investigate the cause of a health problem', 'Research the side effects of a medicine', 'Investigate prevention methods for diseases'],
  socialScience: ['Investigate how poverty influences educational attainment', 'Study the effects of public policy on violence reduction', 'Research why people have stereotypes and prejudice'],
  design: ['Create a piece of artistic and functional furniture', 'Create the set for a movie or stage play', 'Design the layout and lighting of an exhibition'],
  media: ['Produce a video, a podcast or a radio show', 'Report on current events for a newspaper or website', 'Plan and run a social media channel'],
  teaching: ['Teach students a new set of skills', 'Explain a topic to someone with no prior knowledge', 'Teach a beginner how to perform a task'],
  counseling: ['Help people with family problems', 'Help conduct a group therapy session', 'Help kids through interpersonal problems'],
  management: ['Manage a medium-sized organization', 'Supervise a large number of employees', 'Serve as the leader of a work team'],
  sales: ['Persuade customers to try a new product', 'Increase sales for a company during a promotion week', 'Sell services to a target group of people'],
  law: ['Present arguments in a courtroom', 'Resolve legal disputes between parties', 'Lead a committee to make policy decisions'],
  finance: ['Analyze the financial statements of a company', 'Monitor account balance and prepare monthly statements', 'Calculate tax deductions for a business'],
}

export const ITEMS_PER_SCALE = 3
/** Item IDs: the basic interest and a number, e.g. `math2`. */
export const INTEREST_ITEMS: LikertItem[] = Array.from({ length: ITEMS_PER_SCALE }, (_, n) => n).flatMap((n) =>
  BASIC_KEYS.map((k) => ({ id: `${k}${n + 1}`, key: k, text: ITEMS[k][n] })),
)

/**
 * Two instructed items (Meade & Craig, 2012): someone answering at random
 * misses at least one of them with a probability of 1 - (1/5)² = 96 %.
 */
export const ATTENTION_ITEMS: Array<LikertItem & { answer: number }> = [
  { id: 'chk', key: 'check', text: 'To show you are reading: choose 2 here', answer: 2 },
  { id: 'chk2', key: 'check', text: 'To show you are reading: choose 4 here', answer: 4 },
]

/** Deterministic pseudo-random numbers (mulberry32), so one person always sees the same order. */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A fresh order seed for someone who has not answered yet. */
export const newOrderSeed = () => Math.floor(Math.random() * 2 ** 31) + 1

/**
 * The interest list as shown. With a seed the items come in a random order of
 * their own, which a run of identical answers needs to mean anything; without
 * one they stay interleaved by basic interest. The attention items sit after
 * the first and the second third.
 */
export function interestList(seed?: number): LikertItem[] {
  const items = [...INTEREST_ITEMS]
  if (seed) {
    const next = random(seed)
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      ;[items[i], items[j]] = [items[j], items[i]]
    }
  }
  const third = Math.round(items.length / 3)
  return [...items.slice(0, third), ATTENTION_ITEMS[0], ...items.slice(third, 2 * third), ATTENTION_ITEMS[1], ...items.slice(2 * third)]
}

/** The default order, for item listings that belong to nobody in particular. */
export const INTEREST_LIST: LikertItem[] = interestList()

/** All school subjects are asked: quick to answer, and they carry the content areas no activity scale repeats. */
export const ASKED_SUBJECTS = SUBJECT_KEYS
/** Subjects answered before a result: most, as a school may not teach every one. */
export const MIN_SUBJECTS = 10

export const isLikert = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5

/** Share of the interest items answered, 0..1. */
export function interestCompleteness(a: QuestionnaireAnswers): number {
  return INTEREST_ITEMS.filter((i) => isLikert(a.interests?.[i.id])).length / INTEREST_ITEMS.length
}

/** Answers per basic interest needed before it counts: two of three. A missing scale is not «neutral». */
export const MIN_PER_SCALE = 2

/** Basic-interest profile in 0..1, or null until every basic interest has enough answers. */
export function scoreBasic(a: QuestionnaireAnswers): BasicProfile | null {
  const out = {} as BasicProfile
  for (const k of BASIC_KEYS) {
    const vals = INTEREST_ITEMS.filter((i) => i.key === k)
      .map((i) => a.interests?.[i.id])
      .filter(isLikert)
    if (vals.length < MIN_PER_SCALE) return null
    out[k] = (avg(vals) - 1) / 4
  }
  return out
}

/** Enjoyment of the answered subjects, 0..1. */
export function scoreSubjects(a: QuestionnaireAnswers): Partial<Record<SubjectKey, number>> {
  return Object.fromEntries(SUBJECT_KEYS.flatMap((k) => (isLikert(a.subjects?.[k]?.enjoy) ? [[k, (a.subjects![k]!.enjoy! - 1) / 4]] : [])))
}

/** RIASEC as a summary: the mean of the basic interests and answered subjects organised under each type. */
export function riasecSummary(b: BasicProfile, subjects: Partial<Record<SubjectKey, number>> = {}): Riasec {
  return RIASEC_KEYS.map((t) => avg([
    ...BASIC_INTERESTS.filter((x) => x.riasec === t).map((x) => b[x.key]),
    ...SUBJECT_KEYS.filter((k) => SUBJECT_RIASEC[k] === t && subjects[k] !== undefined).map((k) => subjects[k]!),
  ])) as Riasec
}

/** RIASEC profile in 0..1, or null until the questionnaire is complete enough. */
export function scoreRiasec(a: QuestionnaireAnswers): Riasec | null {
  const b = questionnaireReady(a) ? scoreBasic(a) : null
  return b ? riasecSummary(b, scoreSubjects(a)) : null
}

/** Enough for a result: every activity scale with two answers and most subjects. */
export function questionnaireReady(a: QuestionnaireAnswers): boolean {
  return scoreBasic(a) !== null && Object.keys(scoreSubjects(a)).length >= MIN_SUBJECTS
}

/**
 * Elevation (how much someone likes anything at all) and differentiation (how
 * clearly some interests stand out) are separate facts about a profile. A
 * flat profile, all interests and subjects within less than one answer step,
 * carries no clear direction: ranking 80 fields on it would only sort noise.
 */
export const FLAT_BELOW = 0.19

export function profileShape(p: readonly number[]): { elevation: number; differentiation: number; flat: boolean } {
  const differentiation = Math.max(...p) - Math.min(...p)
  return { elevation: avg([...p]), differentiation, flat: differentiation < FLAT_BELOW }
}

/** Identical answers in a row that count as answering on autopilot, in a randomly ordered list of 47. */
export const LONGSTRING = 12

/** Longest run of identical answers in the order the person saw the items. */
export function longestRun(a: QuestionnaireAnswers): number {
  const r = a.interests ?? {}
  let run = 0
  let best = 0
  let last: number | undefined
  for (const it of interestList(a.order)) {
    const v = r[it.id]
    if (!isLikert(v)) {
      last = undefined
      run = 0
      continue
    }
    run = v === last ? run + 1 : 1
    last = v
    best = Math.max(best, run)
  }
  return best
}

/**
 * Signs of answering without reading, each its own index (Meade & Craig,
 * 2012): an instructed item answered otherwise than asked, and a long run of
 * identical answers. They lead to a notice asking to go through the
 * questions again; the ranking itself stays as answered.
 */
export function responseFlags(a: QuestionnaireAnswers): { attention: boolean; longstring: boolean } {
  const r = a.interests ?? {}
  return {
    attention: ATTENTION_ITEMS.some((it) => isLikert(r[it.id]) && r[it.id] !== it.answer),
    longstring: longestRun(a) >= LONGSTRING,
  }
}

export function careless(a: QuestionnaireAnswers): boolean {
  const f = responseFlags(a)
  return f.attention || f.longstring
}

/** Imported data or a sufficiently answered questionnaire suffice. Shared by all result entry points. */
export function resultsReady(a: QuestionnaireAnswers, sources: number): boolean {
  return sources > 0 || questionnaireReady(a)
}

export function riasecCode(p: Riasec): string {
  return RIASEC_KEYS.map((k, i) => [k, p[i]] as [RiasecKey, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k)
    .join('')
}

export function questionnaireProgress(a: QuestionnaireAnswers): { done: number; total: number } {
  const total = INTEREST_LIST.length + ASKED_SUBJECTS.length
  const done =
    INTEREST_LIST.filter((i) => isLikert(a.interests?.[i.id])).length +
    ASKED_SUBJECTS.filter((k) => isLikert(a.subjects?.[k]?.enjoy)).length
  return { done, total }
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}
