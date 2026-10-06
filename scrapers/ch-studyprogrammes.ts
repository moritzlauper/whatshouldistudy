/**
 * Switzerland, programme by programme: studyprogrammes.ch, the catalogue of
 * swissuniversities, lists every bachelor's and master's with its own page,
 * a description, keywords and specialisations. That is what tells two
 * «Master Soziologie» apart. The BFS enrolment data (ch-bfs.ts) stays for
 * subjects the catalogue doesn't cover and for student numbers.
 *
 * Its public JSON API (the one the site itself uses):
 *   /list_studyprogrammes?degree_level=0|1&page=N&page_size=100
 *   /get_studyprogramme_details?id=…
 */
import { join } from 'node:path'
import { CH_ADMISSION, findChInstitution } from '../lib/ch-institutions.ts'
import { classify } from '../lib/engine/classifier.ts'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { FIELDS } from '../lib/taxonomy/fields.ts'
import { OUT, fetchRetry, isMain, log, sleep, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'
import { germanFields } from './lib/de-titles.ts'

const API = 'https://api.studyprogrammes.ch'
const HEADERS = { 'User-Agent': 'whatshouldistudy (github.com/moritzlauper/angebunden)', Accept: 'application/json' }
const LEVELS: Array<[number, Level]> = [
  [0, 'bachelor'],
  [1, 'master'],
]
const PARALLEL = 6

export interface SpDetails {
  id: number
  language?: string
  institute?: { name?: string; abbreviation?: string | null; url?: string | null }
  degree_level?: { id?: number }
  name?: string
  degree_name?: string
  description?: string
  keywords?: string[]
  specialization?: string
  ects_credits?: string
  semester_count?: string
  languages?: Array<{ abbreviation?: string }>
  url?: string
  location?: string
}

/** Some French and Italian texts come through as Windows-1250 read as 1252. */
function fixEncoding(s: string): string {
  if (!/[ŕčęěňůřď]/.test(s)) return s
  const map: Record<string, string> = { ŕ: 'à', č: 'è', ę: 'ê', ě: 'ì', ň: 'ò', ů: 'ù', ř: 'ø', ď: 'ï' }
  return s.replace(/[ŕčęěňůřď]/g, (c) => map[c])
}

const clean = (s?: string) => fixEncoding((s ?? '').replace(/\s+/g, ' ').trim())

/** Fields from the title first; specialisations and keywords add the rest. */
function fieldsFor(d: SpDetails): { fields: string[]; confidence: number } {
  const title = clean(d.name)
  const fromTitle = germanFields(title)
  const extra = classify(clean(`${d.specialization ?? ''} ${(d.keywords ?? []).join(' ')} ${d.description ?? ''}`))
  const fromText = FIELDS.map((f, i) => ({ id: f.id, raw: extra.raw[i] }))
    .filter((x) => x.raw >= 2.5)
    .sort((a, b) => b.raw - a.raw)
    .map((x) => x.id)
  if (fromTitle.fields.length) {
    const fields = [...new Set([...fromTitle.fields, ...fromText])].slice(0, 4)
    return { fields, confidence: Math.max(0.6, fromTitle.confidence) }
  }
  return { fields: fromText.slice(0, 3), confidence: 0.5 }
}

function focusOf(d: SpDetails): string[] {
  const name = clean(d.name).toLowerCase()
  const abbr = (d.institute?.abbreviation ?? '').toLowerCase()
  const parts = [...clean(d.specialization).split(/\s*[,;•\n]\s*|\s+\/\s+/), ...(d.keywords ?? []).map(clean)]
  const out: string[] = []
  for (const p of parts) {
    const x = p.replace(/^[-–•\s]+|[.\s]+$/g, '')
    if (x.length < 3 || x.length > 60) continue
    if (x.toLowerCase() === abbr || name === x.toLowerCase()) continue
    if (!out.some((o) => o.toLowerCase() === x.toLowerCase())) out.push(x)
  }
  return out.slice(0, 8)
}

/**
 * «Majors: Cast / Audiovisual Media, Game Design, …»: some schools (ZHdK) put
 * their separate tracks in the description instead of the specialisation.
 * Those are programmes of their own, with their own admission.
 */
const MAJORS = /^\s*(majors?|majorns|vertiefungen|studienrichtungen|fachrichtungen|orientations?|spécialisations?)\s*:\s*(.+)$/i

export function majorsOf(d: SpDetails): string[] {
  const m = MAJORS.exec(clean(d.description))
  if (!m) return []
  return m[2]
    .split(/\s*,\s*/)
    .map((x) => x.replace(/[.\s]+$/, '').trim())
    .filter((x) => x.length >= 3 && x.length <= 60)
}

function years(d: SpDetails, level: Level): number {
  const sem = /(\d{1,2})/.exec(d.semester_count ?? '')?.[1]
  if (sem && Number(sem) >= 2 && Number(sem) <= 14) return Number(sem) / 2
  const ects = Number(d.ects_credits)
  if (ects >= 60) return Math.round((ects / 60) * 2) / 2
  return level === 'bachelor' ? 3 : 2
}

export function parseSpDetails(d: SpDetails, level: Level, fetchedAt: string): Programme | null {
  const inst = findChInstitution(d.institute?.name ?? '') ?? findChInstitution(d.institute?.abbreviation ?? '')
  if (!inst) return null
  const { fields, confidence } = fieldsFor(d)
  if (!fields.length) return null
  const fee = (inst.feeCh ?? 0) * 2
  const langs = (d.languages ?? []).map((l) => (l.abbreviation ?? '').toLowerCase()).filter(Boolean)
  const url = /^https?:\/\//.test(d.url ?? '') ? d.url : undefined
  return {
    id: programmeId(['ch-sp', d.id]),
    name: clean(d.name),
    institution: inst.name,
    country: 'CH',
    city: clean(d.location) || inst.city,
    region: inst.canton,
    level,
    fields,
    fieldConfidence: Math.round(confidence * 100) / 100,
    languages: langs.length ? langs : inst.languages,
    tuition: !fee
      ? undefined
      : {
          currency: 'CHF',
          domestic: fee,
          eu: inst.feeForeign ? inst.feeForeign * 2 : fee,
          international: inst.feeForeign ? inst.feeForeign * 2 : fee,
          estimated: true,
          note: 'Semestergebühren × 2, Stand 2025/26',
        },
    durationYears: years(d, level),
    mode: /teilzeit|temps partiel|tempo parziale|part-time|berufsbegleitend/i.test(d.semester_count ?? '') ? 'both' : 'full-time',
    url,
    institutionUrl: inst.url,
    public: inst.type !== 'fh' || !['ffhs', 'kalaidos'].includes(inst.id),
    admission: CH_ADMISSION[inst.type].de,
    institutionType: inst.type,
    focus: focusOf(d),
    description: clean(d.description).slice(0, 420) || undefined,
    source: 'ch-studyprogrammes',
    updated: fetchedAt,
  }
}

/**
 * The catalogue entry as rows: one per major where the school lists majors
 * («Bachelor in Design: Cast / Audiovisual Media»), else the programme itself.
 * Each major gets its own fields and topics, so it can fit on its own.
 */
export function parseSpProgrammes(d: SpDetails, level: Level, fetchedAt: string): Programme[] {
  const p = parseSpDetails(d, level, fetchedAt)
  if (!p) return []
  const majors = majorsOf(d)
  if (majors.length < 2) return [p]
  return majors.map((m) => {
    const c = classify(m)
    const own = FIELDS.map((f, i) => ({ id: f.id, raw: c.raw[i] }))
      .filter((x) => x.raw >= 1.5)
      .sort((a, b) => b.raw - a.raw)
      .map((x) => x.id)
    return {
      ...p,
      id: programmeId(['ch-sp', d.id, m]),
      parent: p.id,
      name: `${p.name}: ${m}`,
      fields: [...new Set([...own.slice(0, 2), ...p.fields])].slice(0, 3),
      focus: [m],
      // Not the list of all majors: the other tracks shouldn't match your topics here.
      description: `Einer von ${majors.length} Majors im ${p.name}.`,
    }
  })
}

async function json<T>(path: string): Promise<T> {
  const res = await fetchRetry(API + path, { headers: HEADERS })
  return (await res.json()) as T
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const programmes: Programme[] = []
  const unmatched = new Map<string, number>()
  let unclassified = 0
  for (const [code, level] of LEVELS) {
    const ids: number[] = []
    for (let page = 1; ; page++) {
      const r = await json<{ data: Array<{ id: number }>; metadata: { page_count: number; row_count: number } }>(
        `/list_studyprogrammes?degree_level=${code}&page=${page}&page_size=100`,
      )
      ids.push(...r.data.map((x) => x.id))
      if (page === 1) log(`studyprogrammes.ch ${level}: ${r.metadata.row_count} programmes`)
      if (page >= r.metadata.page_count || !r.data.length) break
      await sleep(150)
    }
    for (let i = 0; i < ids.length; i += PARALLEL) {
      const batch = await Promise.all(
        ids.slice(i, i + PARALLEL).map((id) =>
          json<{ data: SpDetails }>(`/get_studyprogramme_details?id=${id}`)
            .then((r) => r.data)
            .catch(() => null),
        ),
      )
      for (const d of batch) {
        if (!d) continue
        const rows = parseSpProgrammes(d, level, fetchedAt)
        if (rows.length) programmes.push(...rows)
        else if (!findChInstitution(d.institute?.name ?? '')) unmatched.set(d.institute?.name ?? '?', (unmatched.get(d.institute?.name ?? '?') ?? 0) + 1)
        else unclassified++
      }
      if (i % 300 === 0) log(`  ${level}: ${Math.min(i + PARALLEL, ids.length)}/${ids.length}`)
      await sleep(100)
    }
  }
  log(`studyprogrammes.ch: ${programmes.length} programmes, ${programmes.filter((p) => p.focus?.length).length} with focus areas, ${programmes.filter((p) => p.parent).length} majors as their own rows, ${unclassified} without a field`)
  if (unmatched.size) log(`  institutions not matched: ${[...unmatched].map(([n, c]) => `${n} (${c})`).join('; ')}`)
  if (programmes.length < 500) throw new Error(`only ${programmes.length} programmes, the API may have changed`)
  const out: ScrapeOutput = { source: 'ch-studyprogrammes', fetchedAt, programmes }
  writeJson(join(OUT, 'ch-studyprogrammes.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
