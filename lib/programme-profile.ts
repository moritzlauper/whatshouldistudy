import { FIELD_BY_ID, RIASEC_KEYS, SUBJECT_KEYS } from './taxonomy/fields.ts'
import type { RiasecKey } from './taxonomy/fields.ts'
import { BASIC_KEYS } from './taxonomy/basic-interests.ts'
import { questionnaireReady, riasecSummary, scoreBasic, scoreSubjects } from './engine/questionnaire.ts'
import type { QuestionnaireAnswers } from './engine/types.ts'

/**
 * The interest profile of one programme for its public page. A programme with
 * several fields («Business Psychology»: psychology and business) is not the
 * profile of its first field: the fields are mixed, the first with 60 %, the
 * others sharing the rest. The weights are a setting, not a validated model.
 * The ranking itself does not use this; it matches fields.
 */

export const PRIMARY_WEIGHT = 0.6
/** A type counts as different from the first field when it moves at least this much on the 0..1 scale. */
export const TYPE_SHIFT = 0.15
/** A level (z across fields) a field clearly stands out on, as in standoutInterests. */
const STANDOUT = 0.75
const REMOTE = -0.5
/** An answer of 4 or 5 on average: the person likes it. */
export const LIKED = 0.75

export interface ProgrammeProfile {
  /** The known fields mixed, first field first. */
  fields: string[]
  /** R I A S E C, 0..1. */
  riasec: number[]
  /** Level on each basic interest and school subject (`s:math`), standardised across fields. */
  levels: Record<string, number>
}

function fieldLevels(id: string): Record<string, number> {
  const f = FIELD_BY_ID[id]
  return {
    ...Object.fromEntries(BASIC_KEYS.map((k) => [k, f.basic[k]])),
    ...Object.fromEntries(SUBJECT_KEYS.map((k) => [`s:${k}`, f.subjectLevel[k]])),
  }
}

/** The mixed profile of a programme's fields; null when none of them is known. */
export function programmeProfile(fieldIds: readonly string[]): ProgrammeProfile | null {
  const fields = [...new Set(fieldIds)].filter((id) => FIELD_BY_ID[id]).slice(0, 3)
  if (!fields.length) return null
  const weights = fields.length === 1 ? [1] : fields.map((_, i) => (i === 0 ? PRIMARY_WEIGHT : (1 - PRIMARY_WEIGHT) / (fields.length - 1)))
  const each = fields.map(fieldLevels)
  const riasec = RIASEC_KEYS.map((_, i) => round(fields.reduce((s, id, j) => s + weights[j] * FIELD_BY_ID[id].riasec[i], 0)))
  const levels = Object.fromEntries(Object.keys(each[0]).map((k) => [k, round(each.reduce((s, l, j) => s + weights[j] * l[k], 0))]))
  return { fields, riasec, levels }
}

const round = (n: number) => Math.round(n * 1000) / 1000

/** Types in descending order; equal values keep the R I A S E C order. */
const byValue = (riasec: readonly number[]) => RIASEC_KEYS.map((k, i) => ({ k, v: riasec[i], i })).sort((a, b) => b.v - a.v || a.i - b.i)

/** The types the programme is built on: at most three, close to its peak. */
export function profileTypes(riasec: readonly number[]): RiasecKey[] {
  const sorted = byValue(riasec)
  const peak = sorted[0].v
  return sorted.filter((x) => x.v >= Math.max(0.45, peak - 0.2)).slice(0, 3).map((x) => x.k)
}

/** How the programme differs from its first field: at most two types that move by TYPE_SHIFT or more, largest first. */
export function typeShifts(p: ProgrammeProfile): Array<{ k: RiasecKey; more: boolean }> {
  if (p.fields.length < 2) return []
  const base = FIELD_BY_ID[p.fields[0]].riasec
  return RIASEC_KEYS.map((k, i) => ({ k, d: p.riasec[i] - base[i] }))
    .filter((x) => Math.abs(x.d) >= TYPE_SHIFT)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 2)
    .map((x) => ({ k: x.k, more: x.d > 0 }))
}

/**
 * How a rated profile differs from a field in shape: each profile less its own mean, so that a rating that runs high
 * on every type (as single model ratings do) does not read as «more of everything». Both in 0..1.
 */
export function shapeShifts(riasec: readonly number[], base: readonly number[]): Array<{ k: RiasecKey; more: boolean }> {
  const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  const mr = mean(riasec)
  const mb = mean(base)
  return RIASEC_KEYS.map((k, i) => ({ k, d: riasec[i] - mr - (base[i] - mb) }))
    .filter((x) => Math.abs(x.d) >= TYPE_SHIFT)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 2)
    .map((x) => ({ k: x.k, more: x.d > 0 }))
}

/**
 * What speaks for the programme: at most four interests or subjects that stand out in the mix. Each field brings
 * its own two strongest that still stand out, so a second field shows up instead of being drowned by the first.
 */
export function profileStandouts(p: ProgrammeProfile): string[] {
  const out: string[] = []
  const add = (k: string) => {
    if (out.length < 4 && !out.includes(k)) out.push(k)
  }
  for (const id of p.fields) {
    const own = fieldLevels(id)
    Object.keys(own).sort((a, b) => own[b] - own[a]).filter((k) => p.levels[k] >= STANDOUT).slice(0, 2).forEach(add)
  }
  const mixed = Object.keys(p.levels).sort((a, b) => p.levels[b] - p.levels[a])
  mixed.filter((k) => p.levels[k] >= STANDOUT).forEach(add)
  if (!out.length) mixed.slice(0, 2).forEach(add)
  return out
}

/** What the programme draws on least: at most three, clearly below the average field, weakest first. */
export function profileRemote(p: ProgrammeProfile): string[] {
  return Object.keys(p.levels).filter((k) => p.levels[k] <= REMOTE).sort((a, b) => p.levels[a] - p.levels[b]).slice(0, 3)
}

/** The person's side from the questionnaire in this browser: RIASEC and how much they like each interest and subject, 0..1. */
export interface PersonalSide {
  riasec: number[]
  liking: Record<string, number>
}

export function personalSide(a: QuestionnaireAnswers): PersonalSide | null {
  if (!questionnaireReady(a)) return null
  const basic = scoreBasic(a)
  if (!basic) return null
  const subjects = scoreSubjects(a)
  return {
    riasec: [...riasecSummary(basic, subjects)],
    liking: {
      ...Object.fromEntries(BASIC_KEYS.map((k) => [k, basic[k]])),
      ...Object.fromEntries(Object.entries(subjects).map(([k, v]) => [`s:${k}`, v as number])),
    },
  }
}

/** The person's two strongest types. */
export const strongTypes = (riasec: readonly number[]): RiasecKey[] => byValue(riasec).slice(0, 2).map((x) => x.k)

/** The keys the person likes (LIKED or more), in the given order. */
export const likedKeys = (keys: readonly string[], side: PersonalSide): string[] => keys.filter((k) => (side.liking[k] ?? 0) >= LIKED)
