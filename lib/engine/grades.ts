import type { Field } from '../taxonomy/fields.ts'
import type { Grades } from './types.ts'

/**
 * Actual school grades, kept apart from the interest ranking. The grade point
 * average predicts study grades far better than interest fit does (ρ = .46
 * against .01 to .10; Trapmann et al., 2007; de Vries et al., 2024), and
 * ability and interest act largely independently. So grades are shown as a
 * separate note on feasibility and never enter the match.
 */

export interface GradeScale {
  min: number
  max: number
  /** The best grade: the high end (Switzerland) or the low end (Germany, Austria). */
  best: number
  /** The lowest passing grade. */
  pass: number
  step: number
}

export const GRADE_SCALES = {
  /** Switzerland: 1 to 6, 6 best, 4 sufficient. */
  ch: { min: 1, max: 6, best: 6, pass: 4, step: 0.1 },
  /** Germany: 1 to 6, 1 best, 4 sufficient (Abitur 1.0 to 4.0). */
  de: { min: 1, max: 6, best: 1, pass: 4, step: 0.1 },
  /** Austria: 1 to 5, 1 best, 4 sufficient. */
  at: { min: 1, max: 5, best: 1, pass: 4, step: 0.1 },
  /** France and others marking out of 20, 10 to pass. */
  fr: { min: 0, max: 20, best: 20, pass: 10, step: 0.1 },
  /** Percentages, 50 to pass, for everyone else. */
  percent: { min: 0, max: 100, best: 100, pass: 50, step: 1 },
} satisfies Record<string, GradeScale>

export type GradeScaleId = keyof typeof GRADE_SCALES
export const GRADE_SCALE_IDS = Object.keys(GRADE_SCALES) as GradeScaleId[]

export const isGradeScale = (x: unknown): x is GradeScaleId => typeof x === 'string' && x in GRADE_SCALES

export function isGrade(value: unknown, scale: GradeScaleId): value is number {
  const s = GRADE_SCALES[scale]
  return typeof value === 'number' && Number.isFinite(value) && value >= s.min && value <= s.max
}

/** Only a known scale and grades within it; null when nothing usable is left. */
export function cleanGrades(input: unknown): Grades | null {
  if (!input || typeof input !== 'object') return null
  const g = input as Record<string, unknown>
  if (!isGradeScale(g.scale)) return null
  const out: Grades = { scale: g.scale }
  if (isGrade(g.average, g.scale)) out.average = g.average
  if (isGrade(g.math, g.scale)) out.math = g.math
  return out.average === undefined && out.math === undefined ? null : out
}

/** Where a grade lies between passing (0) and the best grade (1); below passing it turns negative. */
export function gradeLevel(value: number, scale: GradeScaleId): number {
  const s = GRADE_SCALES[scale]
  return (value - s.pass) / (s.best - s.pass)
}

export type GradeBand = 'strong' | 'sufficient' | 'weak'

/** Upper half between passing and best, the rest of the passing range, or below passing. */
export function gradeBand(value: number, scale: GradeScaleId): GradeBand {
  const level = gradeLevel(value, scale)
  return level >= 0.5 ? 'strong' : level >= 0 ? 'sufficient' : 'weak'
}

/** How much a field must draw on maths before the maths grade is worth a note. */
export const MATH_CENTRAL = 0.7

export interface Feasibility {
  /** Maths is central to the field and a maths grade was given. */
  math?: { grade: number; band: GradeBand }
}

/** What the grades say about one field. Descriptive only: no prediction of success, no effect on the ranking. */
export function feasibility(field: Pick<Field, 'subjects'>, grades?: Grades): Feasibility {
  if (!grades || grades.math === undefined || (field.subjects.math ?? 0) < MATH_CENTRAL) return {}
  return { math: { grade: grades.math, band: gradeBand(grades.math, grades.scale) } }
}

/** The grading scale a site's visitors most likely know. */
export function defaultGradeScale(site: string): GradeScaleId {
  return site === 'ch' || site === 'de' || site === 'at' ? site : 'percent'
}
