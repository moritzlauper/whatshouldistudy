import type { Field } from '../taxonomy/fields.ts'
import type { Grades } from './types.ts'

/**
 * The maths grade, kept apart from the interest ranking. School grades
 * predict study grades far better than interest fit does (ρ = .46 against
 * .01 to .10; Trapmann et al., 2007; de Vries et al., 2024), and ability and
 * interest act largely independently. Only maths is asked, and only as a
 * band, as it is the one subject whose grade is worth a note for many fields
 * (Trapmann et al., 2007, ρ = .27). It is shown as a note on feasibility and
 * never enters the match.
 */

export interface GradeScale {
  min: number
  max: number
  /** The best grade: the high end (Switzerland) or the low end (Germany, Austria). */
  best: number
  /** The lowest passing grade. */
  pass: number
}

export const GRADE_SCALES = {
  /** Switzerland: 1 to 6, 6 best, 4 sufficient. */
  ch: { min: 1, max: 6, best: 6, pass: 4 },
  /** Germany: 1 to 6, 1 best, 4 sufficient (Abitur 1.0 to 4.0). */
  de: { min: 1, max: 6, best: 1, pass: 4 },
  /** Austria: 1 to 5, 1 best, 4 sufficient. */
  at: { min: 1, max: 5, best: 1, pass: 4 },
  /** France and others marking out of 20, 10 to pass. */
  fr: { min: 0, max: 20, best: 20, pass: 10 },
  /** Percentages, 50 to pass, for everyone else. */
  percent: { min: 0, max: 100, best: 100, pass: 50 },
} satisfies Record<string, GradeScale>

export type GradeScaleId = keyof typeof GRADE_SCALES
export const GRADE_SCALE_IDS = Object.keys(GRADE_SCALES) as GradeScaleId[]

export const isGradeScale = (x: unknown): x is GradeScaleId => typeof x === 'string' && x in GRADE_SCALES

export type GradeBand = 'strong' | 'sufficient' | 'weak'
export const GRADE_BANDS: GradeBand[] = ['weak', 'sufficient', 'strong']
const isBand = (x: unknown): x is GradeBand => typeof x === 'string' && (GRADE_BANDS as string[]).includes(x)

/** Only a known scale and band; null when nothing usable is left. */
export function cleanGrades(input: unknown): Grades | null {
  if (!input || typeof input !== 'object') return null
  const g = input as Record<string, unknown>
  return isGradeScale(g.scale) && isBand(g.math) ? { scale: g.scale, math: g.math } : null
}

/**
 * The grade range of a band on a scale, worst to best: below passing, passing
 * up to halfway to the best grade, and the upper half. People know which band
 * their last maths grade was in without looking it up.
 */
export function bandRange(band: GradeBand, scale: GradeScaleId): [number, number] {
  const s = GRADE_SCALES[scale]
  const mid = s.pass + (s.best - s.pass) / 2
  const worst = s.best === s.max ? s.min : s.max
  return band === 'weak' ? [worst, s.pass] : band === 'sufficient' ? [s.pass, mid] : [mid, s.best]
}

/** How much a field must draw on maths before the maths grade is worth a note. */
export const MATH_CENTRAL = 0.7

/** What the maths grade says about one field. Descriptive only: no prediction of success, no effect on the ranking. */
export function feasibility(field: Pick<Field, 'subjects'>, grades?: Grades | null): { math?: GradeBand } {
  return grades?.math && (field.subjects.math ?? 0) >= MATH_CENTRAL ? { math: grades.math } : {}
}

/** The grading scale a site's visitors most likely know. */
export function defaultGradeScale(site: string): GradeScaleId {
  return site === 'ch' || site === 'de' || site === 'at' ? site : 'percent'
}
