import { scoreRiasec } from '../engine/questionnaire.ts'
import { sourceProfile } from '../engine/scoring.ts'
import type { QuestionnaireAnswers, SourceSummary, Studying } from '../engine/types.ts'
import { FIELD_BY_ID, RIASEC_KEYS } from '../taxonomy/fields.ts'
import type { RiasecKey } from '../taxonomy/fields.ts'
import { OCCUPATIONS } from './occupations.ts'
import type { OccupationId } from './occupations.ts'
import { jobSector } from './sources.ts'
import type { Job, WorkPreferences } from './types.ts'

export interface OccupationMatch {
  id: OccupationId
  score: number
  interests: RiasecKey[]
  fromData: boolean
}

const validRating = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

/** Independent, exploratory job-family ranking. Never reads the paid programme
 * list, unlock state, or study rankings; no Big Five-based employer judgement. */
export function matchOccupations(answers: QuestionnaireAnswers, summaries: SourceSummary[], studying?: Studying): OccupationMatch[] {
  const riasec = scoreRiasec(answers)
  const signals = summaries.map((s) => sourceProfile(s, studying).fields)
  const hasData = signals.some((s) => s.length)
  if (!riasec && !hasData) return []
  return OCCUPATIONS.map((occupation): OccupationMatch => {
    const fields = occupation.fields.map((id) => FIELD_BY_ID[id])
    const profile = RIASEC_KEYS.map((_, i) => mean(fields.map((f) => f.riasec[i])))
    const interests = RIASEC_KEYS.filter((_, i) => riasec && riasec[i] >= 0.65 && profile[i] >= 0.55)
      .sort((a, b) => riasec![RIASEC_KEYS.indexOf(b)] * profile[RIASEC_KEYS.indexOf(b)] - riasec![RIASEC_KEYS.indexOf(a)] * profile[RIASEC_KEYS.indexOf(a)]).slice(0, 2)
    const q = riasec ? profile.reduce((sum, weight, i) => sum + weight * riasec[i], 0) / profile.reduce((a, b) => a + b, 0) : 0
    const subjects = Object.entries(answers.subjects ?? {}).filter(([, a]) => validRating(a?.enjoy))
    const subjectParts = subjects.map(([id, a]) => {
      const weight = mean(fields.map((f) => f.subjects[id as keyof typeof f.subjects] ?? 0))
      return { weight, value: (a!.enjoy! - 1) / 4 }
    })
    const subjectWeight = subjectParts.reduce((s, p) => s + p.weight, 0)
    const subject = subjectWeight ? subjectParts.reduce((s, p) => s + p.value * p.weight, 0) / subjectWeight : q
    const shares = signals.filter((s) => s.length).map((s) => s.filter((f) => (occupation.fields as readonly string[]).includes(f.id)).reduce((sum, f) => sum + f.share, 0))
    const data = mean(shares)
    const score = riasec ? 0.75 * q + 0.25 * subject + (hasData ? 0.25 * data : 0) : data
    return { id: occupation.id, score, interests, fromData: data > 0 }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

export type FitStatus = 'match' | 'different' | 'unknown' | 'unset'
export interface CompanyFit {
  city: FitStatus
  workplace: FitStatus
  sector: FitStatus
  matched: number
  requested: number
}

export const normaliseSearch = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ß/g, 'ss').trim()

/** Only verifiable conditions of this specific job. Different openings at a
 * company cannot be combined into a fictitious ideal job. */
export function companyFit(job: Job, prefs: WorkPreferences): CompanyFit {
  const industry = jobSector(job)
  const city: FitStatus = !prefs.city.trim() ? 'unset' : !job.city ? 'unknown' : normaliseSearch(job.city).includes(normaliseSearch(prefs.city)) ? 'match' : 'different'
  const workplace: FitStatus = prefs.workplace === 'any' ? 'unset' : job.workplace === 'unknown' ? 'unknown' : job.workplace === prefs.workplace ? 'match' : 'different'
  const sector: FitStatus = prefs.sector === 'any' ? 'unset' : !industry ? 'unknown' : industry === prefs.sector ? 'match' : 'different'
  const statuses = [city, workplace, sector]
  return { city, workplace, sector, matched: statuses.filter((s) => s === 'match').length, requested: statuses.filter((s) => s !== 'unset').length }
}

export function rankJobs(jobs: Job[], occupations: OccupationMatch[], prefs: WorkPreferences) {
  return jobs.map((job) => {
    const occupation = occupations.find((o) => job.occupationIds.includes(o.id))
    const fit = companyFit(job, prefs)
    const conflicts = [fit.city, fit.workplace, fit.sector].filter((s) => s === 'different').length
    return { job, occupation, fit, score: (occupation?.score ?? 0) + fit.matched * 0.08 - conflicts * 0.12 }
  }).sort((a, b) => b.score - a.score || a.job.title.localeCompare(b.job.title))
}

export function rankCompanies(ranked: ReturnType<typeof rankJobs>) {
  const companies = new Map<string, { best: (typeof ranked)[number]; jobs: Job[] }>()
  for (const row of ranked) {
    const key = `${row.job.sourceId}:${row.job.company}`
    const company = companies.get(key)
    if (company) company.jobs.push(row.job)
    else companies.set(key, { best: row, jobs: [row.job] })
  }
  return [...companies.values()]
}
