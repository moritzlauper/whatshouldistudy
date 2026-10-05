/**
 * United States: U.S. Department of Education College Scorecard API.
 * Every Title IV institution (~6,500) with its programmes by 4-digit CIP code
 * and credential level, tuition, admission rate, and programme-level median
 * earnings and debt. Public domain.
 *
 * Needs a free api.data.gov key in SCORECARD_API_KEY (1,000 requests/hour);
 * DEMO_KEY works for a trial run but is limited to 30 requests per hour.
 */
import { join } from 'node:path'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, cleanTitle, fieldsForCip, fieldsForTitle, getJson, isMain, log, sleep, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const API = 'https://api.data.gov/ed/collegescorecard/v1/schools'

const FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.school_url',
  'school.ownership',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.admissions.admission_rate.overall',
  'latest.student.size',
  'latest.programs.cip_4_digit',
].join(',')

interface RawProgram {
  code?: string
  title?: string
  credential?: { level?: number | null; title?: string | null }
  counts?: { ipeds_awards1?: number | null; ipeds_awards2?: number | null }
  earnings?: Record<string, unknown>
  debt?: { staff_grad_plus?: { all?: { all_inst?: { median?: number | null } } } }
}

export interface RawSchool {
  id: number
  'school.name'?: string
  'school.city'?: string
  'school.state'?: string
  'school.school_url'?: string
  'school.ownership'?: number
  'latest.cost.tuition.in_state'?: number | null
  'latest.cost.tuition.out_of_state'?: number | null
  'latest.admissions.admission_rate.overall'?: number | null
  'latest.student.size'?: number | null
  'latest.programs.cip_4_digit'?: RawProgram[]
}

const LEVELS: Record<number, { level: Level; label: string; years?: number }> = {
  3: { level: 'bachelor', label: "Bachelor's", years: 4 },
  5: { level: 'master', label: "Master's", years: 2 },
  6: { level: 'doctorate', label: 'Doctorate' },
  7: { level: 'professional', label: 'Professional degree' },
}

/** Programme-level median earnings; the API has moved these around between releases. */
function earnings(p: RawProgram): Programme['earnings'] {
  const e = p.earnings as Record<string, Record<string, { overall_median_earnings?: number | null } | undefined> | undefined> | undefined
  if (!e) return undefined
  const candidates: Array<[unknown, number]> = [
    [e.highest?.['1_yr']?.overall_median_earnings, 1],
    [(e['4_yr'] as { overall_median_earnings?: number } | undefined)?.overall_median_earnings, 4],
    [(e['5_yr'] as { overall_median_earnings?: number } | undefined)?.overall_median_earnings, 5],
    [(e['1_yr'] as { overall_median_earnings?: number } | undefined)?.overall_median_earnings, 1],
    [e.highest?.['2_yr']?.overall_median_earnings, 2],
  ]
  for (const [v, years] of candidates) if (typeof v === 'number' && v > 0) return { median: v, currency: 'USD', yearsAfter: years }
  return undefined
}

function url(u?: string): string | undefined {
  if (!u) return undefined
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

export function parseSchools(schools: RawSchool[], fetchedAt: string): Programme[] {
  const out: Programme[] = []
  for (const s of schools) {
    const name = s['school.name']
    if (!name) continue
    const isPublic = s['school.ownership'] === 1
    const inState = s['latest.cost.tuition.in_state'] ?? undefined
    const outState = s['latest.cost.tuition.out_of_state'] ?? undefined
    const seen = new Set<string>()
    for (const p of s['latest.programs.cip_4_digit'] ?? []) {
      const lvl = LEVELS[p.credential?.level ?? 0]
      if (!lvl || !p.code || !p.title) continue
      const awards = (p.counts?.ipeds_awards2 ?? 0) + (p.counts?.ipeds_awards1 ?? 0)
      // Programmes with no recent graduates are often discontinued.
      if (p.counts && awards === 0) continue
      const key = `${p.code}|${lvl.level}`
      if (seen.has(key)) continue
      seen.add(key)
      const title = cleanTitle(p.title)
      let fields = fieldsForCip(p.code)
      let confidence = 1
      if (!fields.length) {
        const t = fieldsForTitle(title)
        fields = t.fields
        confidence = t.confidence
      }
      if (!fields.length) continue
      const debt = p.debt?.staff_grad_plus?.all?.all_inst?.median
      out.push({
        id: programmeId(['us', s.id, p.code, lvl.level]),
        name: `${lvl.label} in ${title}`,
        institution: name,
        country: 'US',
        city: s['school.city'],
        region: s['school.state'],
        level: lvl.level,
        fields,
        fieldConfidence: confidence,
        languages: ['en'],
        tuition:
          lvl.level === 'bachelor' && (inState || outState)
            ? { currency: 'USD', domestic: inState, international: outState ?? inState, note: isPublic ? 'In-state / out-of-state' : undefined }
            : undefined,
        durationYears: lvl.years,
        mode: 'full-time',
        institutionUrl: url(s['school.school_url']),
        url: url(s['school.school_url']),
        earnings: earnings(p),
        debt: typeof debt === 'number' && debt > 0 ? { median: debt, currency: 'USD' } : undefined,
        admissionRate: s['latest.admissions.admission_rate.overall'] ?? undefined,
        public: isPublic,
        source: 'us-college-scorecard',
        updated: fetchedAt,
      })
    }
  }
  return out
}

async function main() {
  const key = process.env.SCORECARD_API_KEY || 'DEMO_KEY'
  if (key === 'DEMO_KEY') log('SCORECARD_API_KEY not set, using DEMO_KEY (very limited)')
  const fetchedAt = new Date().toISOString()
  const schools: RawSchool[] = []
  // Operating institutions that award at least a bachelor's degree.
  const base = `${API}?api_key=${key}&school.operating=1&school.degrees_awarded.highest__range=3..4&fields=${FIELDS}&per_page=100`
  let total = Infinity
  for (let page = 0; page * 100 < total; page++) {
    const res = await getJson<{ metadata: { total: number }; results: RawSchool[] }>(`${base}&page=${page}`)
    total = res.metadata.total
    schools.push(...res.results)
    log(`US: page ${page + 1}/${Math.ceil(total / 100)}, ${schools.length} schools`)
    // Stay well under 1,000 requests per hour.
    await sleep(key === 'DEMO_KEY' ? 2500 : 400)
  }
  const programmes = parseSchools(schools, fetchedAt)
  log(`US: ${programmes.length} programmes from ${schools.length} schools`)
  const out: ScrapeOutput = { source: 'us-college-scorecard', fetchedAt, programmes }
  writeJson(join(OUT, 'us-college-scorecard.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
