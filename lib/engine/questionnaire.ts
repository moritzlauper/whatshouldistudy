import { BIG5_KEYS, RIASEC_KEYS } from '../taxonomy/fields.ts'
import type { Big5, Big5Key, Riasec, RiasecKey } from '../taxonomy/fields.ts'
import type { QuestionnaireAnswers } from './types.ts'

/**
 * The questionnaire fills in what no digital footprint shows: how someone
 * describes themselves, which school subjects they like and are good at, and
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
 * Activity items, four per Holland type, rated for liking: 1 (dislike) .. 5
 * (love). Short concrete activities rather than job titles, written to be
 * gender-neutral (no «-in», no stereotyped hobbies) and to cover the fields in
 * the taxonomy. This is a custom short form, not a validated scale; item
 * selection preserves concrete activities and breadth, not measured reliability.
 * They are shown interleaved (R, I, A, S, E, C, R, …) so that no block of one
 * type invites answering on autopilot.
 */
const BY_TYPE: Record<RiasecKey, string[]> = {
  R: [
    'Build, fix or take apart things with your hands',
    'Work with machines, tools or vehicles',
    'Spend your working day outdoors or in a workshop',
    'Set up and test electronics, a robot or a 3D printer',
    'Grow plants or look after animals',
    'Measure or build something on a construction site',
  ],
  I: [
    'Figure out why something in nature works the way it does',
    'Solve a hard maths, logic or coding problem',
    'Run an experiment and analyse the results',
    'Read up on a scientific question until you really understand it',
    'Find the cause of an illness or a technical fault',
    'Look for patterns in data',
  ],
  A: [
    'Write a story, song, script or article',
    'Design something that looks good: a poster, an app, a room',
    'Perform: music, theatre, dance or making videos',
    'Take photos or film and edit them',
    'Draw, paint or make something from your own ideas',
    'Play with language: translate, write poems, find the right word',
  ],
  S: [
    'Teach or explain something to others',
    'Help someone through a difficult time',
    "Look after people's health or wellbeing",
    'Organise an activity for children or young people',
    'Listen to someone and help them find their own solution',
    'Work with people from other cultures or backgrounds',
  ],
  E: [
    'Convince a group to back your idea',
    'Start and run your own project or business',
    'Lead a team and take responsibility for the result',
    'Negotiate a good deal or price',
    'Present a plan in front of people and defend it',
    "Stand up for someone's case, for example in court",
  ],
  C: [
    'Organise information so that everything is accurate',
    'Keep track of money, budgets or numbers',
    'Follow a clear procedure to get a precise result',
    'Check a document for mistakes and inconsistencies',
    'Build a spreadsheet that keeps everything in order',
    'Plan schedules, routes or stock so that nothing goes wrong',
  ],
}

/** One instructed item in the middle of the list: answering it as asked shows the list is being read. */
export const ATTENTION_ITEM: LikertItem = { id: 'chk', key: 'check', text: 'To show you are reading: choose 2 here' }
export const ATTENTION_ANSWER = 2

// Original one-based item numbers keep saved answers and translations stable.
const SELECTED: Record<RiasecKey, number[]> = {
  R: [1, 2, 5, 6], I: [1, 2, 3, 6], A: [1, 2, 3, 5],
  S: [1, 2, 3, 4], E: [1, 2, 3, 4], C: [1, 2, 4, 6],
}
export const ITEMS_PER_TYPE = 4
export const RIASEC_ITEMS: LikertItem[] = Array.from({ length: ITEMS_PER_TYPE }, (_, n) => n).flatMap((n) =>
  RIASEC_KEYS.map((k) => ({ id: `${k.toLowerCase()}${SELECTED[k][n]}`, key: k, text: BY_TYPE[k][SELECTED[k][n] - 1] })),
)

/** The interest list as shown: the attention item sits after the first half. */
export const INTEREST_LIST: LikertItem[] = [...RIASEC_ITEMS.slice(0, 12), ATTENTION_ITEM, ...RIASEC_ITEMS.slice(12)]

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

/**
 * Approximate item-mean norms (mean, SD) for the Mini-IPIP scales in young
 * adult samples (Donnellan et al. 2006; Baldasaro et al. 2013), used to turn
 * answers into z-scores. Rough by design: we compare fields, not people.
 */
const BIG5_NORMS: Record<Big5Key, [number, number]> = {
  E: [3.0, 0.85],
  A: [3.9, 0.7],
  C: [3.4, 0.8],
  N: [2.7, 0.8],
  O: [3.7, 0.7],
}

export const LIKERT_INTEREST = ['Dislike', 'Not really', 'Neutral', 'Like', 'Love']
export const LIKERT_ACCURACY = ['Very inaccurate', 'Inaccurate', 'Neither', 'Accurate', 'Very accurate']

/** Share of the interest items answered, 0..1. */
export function riasecCompleteness(a: QuestionnaireAnswers): number {
  if (!a.riasec) return 0
  return RIASEC_ITEMS.filter((i) => typeof a.riasec![i.id] === 'number').length / RIASEC_ITEMS.length
}

/** Answers per Holland type needed before its scale counts. Fewer would be noise, and a missing type is not «neutral». */
export const MIN_PER_TYPE = Math.ceil(ITEMS_PER_TYPE / 2)

/** RIASEC profile in 0..1 from the activity items, or null until every type has enough answers. */
export function scoreRiasec(a: QuestionnaireAnswers): Riasec | null {
  if (!a.riasec) return null
  const out: number[] = []
  for (const k of RIASEC_KEYS) {
    const vals = RIASEC_ITEMS.filter((i) => i.key === k)
      .map((i) => a.riasec![i.id])
      .filter((v): v is number => typeof v === 'number')
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

/**
 * Signs of answering without reading: the attention item answered otherwise
 * than asked, or ten or more identical answers in a row in the interest
 * list. Only the wording of the result changes; nobody is locked out.
 */
export function careless(a: QuestionnaireAnswers): boolean {
  const r = a.riasec ?? {}
  if (typeof r[ATTENTION_ITEM.id] === 'number' && r[ATTENTION_ITEM.id] !== ATTENTION_ANSWER) return true
  let run = 0
  let last: number | undefined
  for (const it of INTEREST_LIST) {
    const v = r[it.id]
    if (typeof v !== 'number') {
      last = undefined
      run = 0
      continue
    }
    run = v === last ? run + 1 : 1
    last = v
    if (run >= 10) return true
  }
  return false
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

/** Big Five z-scores, or null if fewer than half the items were answered. */
export function scoreBig5(a: QuestionnaireAnswers): Big5 | null {
  if (!a.big5) return null
  const z = {} as Big5
  let answered = 0
  for (const k of BIG5_KEYS) {
    const vals = BIG5_ITEMS.filter((i) => i.key === k)
      .map((i) => {
        const v = a.big5![i.id]
        return typeof v === 'number' ? (i.reverse ? 6 - v : v) : null
      })
      .filter((v): v is number => v !== null)
    answered += vals.length
    const [m, sd] = BIG5_NORMS[k]
    z[k] = vals.length ? clamp((avg(vals) - m) / sd, -2.5, 2.5) : 0
  }
  return answered >= 10 ? z : null
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
    INTEREST_LIST.filter((i) => typeof a.riasec?.[i.id] === 'number').length +
    big5Answered(a) +
    Object.values(a.subjects ?? {}).filter((s) => s && (s.enjoy || s.grade)).length +
    Object.keys(a.values ?? {}).length
  return { done, total }
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}
