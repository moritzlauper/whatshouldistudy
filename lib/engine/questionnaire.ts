import { BIG5_KEYS, RIASEC_KEYS } from '../taxonomy/fields.ts'
import type { Big5, Riasec, RiasecKey } from '../taxonomy/fields.ts'
import type { QuestionnaireAnswers } from './types.ts'

/**
 * The questionnaire fills in what no digital footprint shows: what someone
 * likes doing, which school subjects they enjoy, their actual grades, and
 * what they want from a career. Personality items are optional.
 */

export interface LikertItem {
  id: string
  text: string
  key: string
  /** Reverse-keyed items count the other way. */
  reverse?: boolean
}

/**
 * Activity items, eight per Holland type, rated for liking: 1 (dislike) .. 5
 * (love). Short concrete activities rather than job titles, written to be
 * gender-neutral (no «-in», no stereotyped hobbies) and to cover the fields in
 * the taxonomy, including the humanities that common inventories leave out
 * (Su et al., 2019). This is a custom form, not a validated scale. Eight items
 * per type sit between the 8-item public-domain markers (Armstrong et al.,
 * 2008) and the 10-item O*NET short form (Rounds et al., 2010).
 */
const BY_TYPE: Record<RiasecKey, string[]> = {
  R: [
    'Build, fix or take apart things with your hands',
    'Work with machines, tools or vehicles',
    'Spend your working day outdoors or in a workshop',
    'Set up and test electronics, a robot or a 3D printer',
    'Grow plants or look after animals',
    'Measure or build something on a construction site',
    'Install or repair the wiring, plumbing or heating of a building',
    'Look after a forest, a river or a nature reserve',
  ],
  I: [
    'Figure out why something in nature works the way it does',
    'Solve a hard maths, logic or coding problem',
    'Run an experiment and analyse the results',
    'Read up on a scientific question until you really understand it',
    'Find the cause of an illness or a technical fault',
    'Look for patterns in data',
    'Find out how the human body or the brain works',
    'Test a claim against facts and sources',
  ],
  A: [
    'Write a story, song, script or article',
    'Design something that looks good: a poster, an app, a room',
    'Perform: music, theatre, dance or making videos',
    'Take photos or film and edit them',
    'Draw, paint or make something from your own ideas',
    'Play with language: translate, write poems, find the right word',
    'Compose music or produce a track',
    'Interpret a novel, a film or a work of art and write about it',
  ],
  S: [
    'Teach or explain something to others',
    'Help someone through a difficult time',
    "Look after people's health or wellbeing",
    'Organise an activity for children or young people',
    'Listen to someone and help them find their own solution',
    'Work with people from other cultures or backgrounds',
    'Settle a conflict between two people',
    'Work on a project that improves life in your neighbourhood',
  ],
  E: [
    'Convince a group to back your idea',
    'Start and run your own project or business',
    'Lead a team and take responsibility for the result',
    'Negotiate a good deal or price',
    'Present a plan in front of people and defend it',
    "Stand up for someone's case, for example in court",
    'Market a product or an idea so that people want it',
    'Decide how a company or organisation spends its money',
  ],
  C: [
    'Organise information so that everything is accurate',
    'Keep track of money, budgets or numbers',
    'Follow a clear procedure to get a precise result',
    'Check a document for mistakes and inconsistencies',
    'Build a spreadsheet that keeps everything in order',
    'Plan schedules, routes or stock so that nothing goes wrong',
    'Keep records and files complete and up to date',
    'Check that rules and regulations are followed',
  ],
}

/**
 * Two instructed items (Meade & Craig, 2012): someone answering at random
 * misses at least one of them with a probability of 1 - (1/5)² = 96 %.
 */
export const ATTENTION_ITEMS: Array<LikertItem & { answer: number }> = [
  { id: 'chk', key: 'check', text: 'To show you are reading: choose 2 here', answer: 2 },
  { id: 'chk2', key: 'check', text: 'To show you are reading: choose 4 here', answer: 4 },
]

export const ITEMS_PER_TYPE = 8
/** Item IDs are one-based per type (r1 … r8) and stay stable for saved answers and translations. */
export const RIASEC_ITEMS: LikertItem[] = Array.from({ length: ITEMS_PER_TYPE }, (_, n) => n).flatMap((n) =>
  RIASEC_KEYS.map((k) => ({ id: `${k.toLowerCase()}${n + 1}`, key: k, text: BY_TYPE[k][n] })),
)

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
 * one (answers saved before the seed existed) they stay interleaved R, I, A, S,
 * E, C, R, …. The attention items sit after the first and the second third.
 */
export function interestList(seed?: number): LikertItem[] {
  const items = [...RIASEC_ITEMS]
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

/**
 * Mini-IPIP (Donnellan, Oswald, Baird & Lucas, 2006): 20 items, four per Big
 * Five trait, from the public-domain International Personality Item Pool.
 * Answer: 1 (very inaccurate) .. 5 (very accurate) for "I ...".
 * Imagination (O) is the IPIP name for Openness/Intellect.
 */
export const BIG5_ITEMS: LikertItem[] = [
  { id: 'b1', key: 'E', text: 'Am the life of the party.' },
  { id: 'b2', key: 'A', text: "Sympathize with others' feelings." },
  { id: 'b3', key: 'C', text: 'Get chores done right away.' },
  { id: 'b4', key: 'N', text: 'Have frequent mood swings.' },
  { id: 'b5', key: 'O', text: 'Have a vivid imagination.' },
  { id: 'b6', key: 'E', text: "Don't talk a lot.", reverse: true },
  { id: 'b7', key: 'A', text: "Am not interested in other people's problems.", reverse: true },
  { id: 'b8', key: 'C', text: 'Often forget to put things back in their proper place.', reverse: true },
  { id: 'b9', key: 'N', text: 'Am relaxed most of the time.', reverse: true },
  { id: 'b10', key: 'O', text: 'Am not interested in abstract ideas.', reverse: true },
  { id: 'b11', key: 'E', text: 'Talk to a lot of different people at parties.' },
  { id: 'b12', key: 'A', text: "Feel others' emotions." },
  { id: 'b13', key: 'C', text: 'Like order.' },
  { id: 'b14', key: 'N', text: 'Get upset easily.' },
  { id: 'b15', key: 'O', text: 'Have difficulty understanding abstract ideas.', reverse: true },
  { id: 'b16', key: 'E', text: 'Keep in the background.', reverse: true },
  { id: 'b17', key: 'A', text: 'Am not really interested in others.', reverse: true },
  { id: 'b18', key: 'C', text: 'Make a mess of things.', reverse: true },
  { id: 'b19', key: 'N', text: 'Seldom feel blue.', reverse: true },
  { id: 'b20', key: 'O', text: 'Do not have a good imagination.', reverse: true },
]

export const LIKERT_INTEREST = ['Dislike', 'Not really', 'Neutral', 'Like', 'Love']
export const LIKERT_ACCURACY = ['Very inaccurate', 'Inaccurate', 'Neither', 'Accurate', 'Very accurate']

export const isLikert = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5

/** Share of the interest items answered, 0..1. */
export function riasecCompleteness(a: QuestionnaireAnswers): number {
  if (!a.riasec) return 0
  return RIASEC_ITEMS.filter((i) => isLikert(a.riasec![i.id])).length / RIASEC_ITEMS.length
}

/** Answers per Holland type needed before its scale counts: three quarters. Fewer would be noise, and a missing type is not «neutral». */
export const MIN_PER_TYPE = 6

/** RIASEC profile in 0..1 from the activity items, or null until every type has enough answers. */
export function scoreRiasec(a: QuestionnaireAnswers): Riasec | null {
  if (!a.riasec) return null
  const out: number[] = []
  for (const k of RIASEC_KEYS) {
    const vals = RIASEC_ITEMS.filter((i) => i.key === k)
      .map((i) => a.riasec![i.id])
      .filter(isLikert)
    if (vals.length < MIN_PER_TYPE) return null
    out.push((avg(vals) - 1) / 4)
  }
  return out as Riasec
}

/**
 * Elevation (how much you like anything at all) and differentiation (how
 * clearly some types stand out) are separate facts about a profile. A flat
 * profile, all types within less than one answer step of three quarters of
 * the scale, carries no clear direction: ranking 80 fields on it would only
 * sort noise.
 */
export const FLAT_BELOW = 0.19

export function profileShape(p: Riasec): { elevation: number; differentiation: number; flat: boolean } {
  const differentiation = Math.max(...p) - Math.min(...p)
  return { elevation: avg(p), differentiation, flat: differentiation < FLAT_BELOW }
}

/** Identical answers in a row that count as answering on autopilot, in a randomly ordered list of 50. */
export const LONGSTRING = 12

/** Longest run of identical answers in the order the person saw the items. */
export function longestRun(a: QuestionnaireAnswers): number {
  const r = a.riasec ?? {}
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
  const r = a.riasec ?? {}
  return {
    attention: ATTENTION_ITEMS.some((it) => isLikert(r[it.id]) && r[it.id] !== it.answer),
    longstring: longestRun(a) >= LONGSTRING,
  }
}

export function careless(a: QuestionnaireAnswers): boolean {
  const f = responseFlags(a)
  return f.attention || f.longstring
}

/** Count only valid responses to the twenty current personality items. */
export function big5Answered(a: QuestionnaireAnswers): number {
  return BIG5_ITEMS.filter((i) => {
    const value = a.big5?.[i.id]
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
  }).length
}

/** Imported data or sufficient interest answers suffice; personality is optional. Shared by all result entry points. */
export function resultsReady(a: QuestionnaireAnswers, sources: number): boolean {
  return sources > 0 || scoreRiasec(a) !== null
}

/** Descriptive item means (1..5), not population norms. All four items per trait are required. */
export function big5Means(a: QuestionnaireAnswers): Big5 | null {
  if (!a.big5) return null
  const means = {} as Big5
  for (const k of BIG5_KEYS) {
    const vals = BIG5_ITEMS.filter((i) => i.key === k)
      .map((i) => {
        const v = a.big5![i.id]
        return Number.isInteger(v) && v >= 1 && v <= 5 ? (i.reverse ? 6 - v : v) : null
      })
      .filter((v): v is number => v !== null)
    if (vals.length !== 4) return null
    means[k] = avg(vals)
  }
  return means
}

/** Internally centre on the response midpoint; this is not a z-score or an age comparison. */
export function scoreBig5(a: QuestionnaireAnswers): Big5 | null {
  const means = big5Means(a)
  return means ? Object.fromEntries(BIG5_KEYS.map(k => [k, means[k] - 3])) as Big5 : null
}

export function riasecCode(p: Riasec): string {
  return RIASEC_KEYS.map((k, i) => [k, p[i]] as [RiasecKey, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k)
    .join('')
}

export function questionnaireProgress(a: QuestionnaireAnswers): { done: number; total: number } {
  const total = INTEREST_LIST.length + BIG5_ITEMS.length + 14 + 8
  const done =
    INTEREST_LIST.filter((i) => isLikert(a.riasec?.[i.id])).length +
    big5Answered(a) +
    Object.values(a.subjects ?? {}).filter((s) => s?.enjoy).length +
    Object.keys(a.values ?? {}).length
  return { done, total }
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}
