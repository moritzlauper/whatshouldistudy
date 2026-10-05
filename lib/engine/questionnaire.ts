import { BIG5_KEYS, RIASEC_KEYS } from '../taxonomy/fields.ts'
import type { Big5, Big5Key, Riasec, RiasecKey } from '../taxonomy/fields.ts'
import type { QuestionnaireAnswers } from './types.ts'

/**
 * The questionnaire fills in what no digital footprint shows: how someone
 * describes themselves, which school subjects they like and are good at, and
 * what they want from a career. Every part is optional.
 */

export interface LikertItem {
  id: string
  text: string
  key: string
  /** Reverse-keyed items count the other way. */
  reverse?: boolean
}

/** Activity items, three per Holland type. Answer: 1 (dislike) .. 5 (love). */
export const RIASEC_ITEMS: LikertItem[] = [
  { id: 'r1', key: 'R', text: 'Build, fix or take apart things with your hands' },
  { id: 'r2', key: 'R', text: 'Work with machines, tools or vehicles' },
  { id: 'r3', key: 'R', text: 'Spend your working day outdoors or in a workshop' },
  { id: 'i1', key: 'I', text: 'Figure out why something in nature works the way it does' },
  { id: 'i2', key: 'I', text: 'Solve a hard maths, logic or coding problem' },
  { id: 'i3', key: 'I', text: 'Run an experiment and analyse the results' },
  { id: 'a1', key: 'A', text: 'Write a story, song, script or article' },
  { id: 'a2', key: 'A', text: 'Design something that looks good: a poster, an app, a room' },
  { id: 'a3', key: 'A', text: 'Perform: music, theatre, dance or making videos' },
  { id: 's1', key: 'S', text: 'Teach or explain something to others' },
  { id: 's2', key: 'S', text: 'Help someone through a difficult time' },
  { id: 's3', key: 'S', text: "Look after people's health or wellbeing" },
  { id: 'e1', key: 'E', text: 'Convince a group to back your idea' },
  { id: 'e2', key: 'E', text: 'Start and run your own project or business' },
  { id: 'e3', key: 'E', text: 'Lead a team and take responsibility for the result' },
  { id: 'c1', key: 'C', text: 'Organise information so that everything is accurate' },
  { id: 'c2', key: 'C', text: 'Keep track of money, budgets or numbers' },
  { id: 'c3', key: 'C', text: 'Follow a clear procedure to get a precise result' },
]

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

/** RIASEC profile in 0..1 from the activity items, or null if too few answers. */
export function scoreRiasec(a: QuestionnaireAnswers): Riasec | null {
  if (!a.riasec) return null
  const out: number[] = []
  let answered = 0
  for (const k of RIASEC_KEYS) {
    const vals = RIASEC_ITEMS.filter((i) => i.key === k)
      .map((i) => a.riasec![i.id])
      .filter((v): v is number => typeof v === 'number')
    answered += vals.length
    out.push(vals.length ? (avg(vals) - 1) / 4 : 0.5)
  }
  return answered >= 6 ? (out as Riasec) : null
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
  const total = RIASEC_ITEMS.length + BIG5_ITEMS.length + 14 + 8
  const done =
    Object.keys(a.riasec ?? {}).length +
    Object.keys(a.big5 ?? {}).length +
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
