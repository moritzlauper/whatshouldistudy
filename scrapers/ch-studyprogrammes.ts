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
  additional_languages?: Array<{ abbreviation?: string } | string>
  admission_fields_of_study?: Array<{ name?: string } | string>
  admission_requirements?: string
  admission_deadline?: string
  departement?: string
  partner_institutes?: string
  regulations_url?: string
  tuition_fee?: string
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

const fieldsByText = (text: string, min: number) => {
  const c = classify(clean(text))
  return FIELDS.map((f, i) => ({ id: f.id, raw: c.raw[i] }))
    .filter((x) => x.raw >= min)
    .sort((a, b) => b.raw - a.raw)
    .map((x) => x.id)
}

/**
 * Fields from the title first; the specialisations and keywords add the rest.
 * The description only counts when the title says nothing: its marketing prose
 * («a history of breakthroughs», «liberal arts of engineering») put Quantum
 * Science under History and Liberal Arts.
 */
function fieldsFor(d: SpDetails): { fields: string[]; confidence: number } {
  const fromTitle = germanFields(clean(d.name))
  // A list of majors in the description («Majors: Game Design, …») is as good as specialisations.
  const tagged = `${d.specialization ?? ''} ${(d.keywords ?? []).join(' ')} ${MAJORS.test(clean(d.description)) ? clean(d.description) : ''}`
  if (fromTitle.fields.length) {
    const fields = [...new Set([...fromTitle.fields, ...fieldsByText(tagged, 2.5)])].slice(0, 4)
    return { fields, confidence: Math.max(0.6, fromTitle.confidence) }
  }
  return { fields: fieldsByText(`${tagged} ${d.description ?? ''}`, 2.5).slice(0, 3), confidence: 0.5 }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Specialisations as listed, keywords only where they say more than the title
 * and the fields do: «Physics» on a physics master or «BFH» tells nobody anything.
 */
function focusOf(d: SpDetails, fields: string[]): string[] {
  const abbr = norm(d.institute?.abbreviation ?? '')
  const known = ` ${norm([d.name, d.degree_name, d.institute?.name, ...fields.map((f) => FIELDS.find((x) => x.id === f)?.name ?? '')].join(' '))} `
  const said = (x: string) => {
    const words = norm(x).split(' ').filter((w) => w.length > 2)
    return !words.length || words.every((w) => known.includes(` ${w}`) || known.includes(`${w} `))
  }
  const spec = clean(d.specialization).split(/\s*[,;•\n]\s*|\s+\/\s+/)
  const out: string[] = []
  const add = (p: string, keyword: boolean) => {
    const x = p.replace(/^[-–•\s]+|[.\s]+$/g, '')
    if (x.length < 3 || x.length > 60) return
    if (norm(x) === abbr || norm(x) === norm(clean(d.name))) return
    if (keyword && said(x)) return
    if (!out.some((o) => norm(o) === norm(x))) out.push(x)
  }
  for (const p of spec) add(p, false)
  for (const k of d.keywords ?? []) add(clean(k), true)
  return out.slice(0, 8)
}

const names = (xs?: Array<{ name?: string; abbreviation?: string } | string>) =>
  (xs ?? []).map((x) => clean(typeof x === 'string' ? x : (x.name ?? x.abbreviation))).filter(Boolean)

const link = (s?: string) => (/^https?:\/\/\S+$/.test((s ?? '').trim()) ? s!.trim() : undefined)

/** «30.04.» → «30. April»; free text («30. April (HS), 15. Dezember (FS)») stays as written. */
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
export function deadlineText(s?: string): string | undefined {
  const x = clean(s)
  if (!x) return undefined
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/.exec(x)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${Number(m[1])}. ${MONTHS[Number(m[2]) - 1]}${m[3] ? ` ${m[3]}` : ''}`
  return x.slice(0, 120)
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
  const ects = Number(d.ects_credits)
  const extra = names(d.additional_languages)
  const prior = names(d.admission_fields_of_study)
  // The programme's own admission rule, in the institution's words, next to the general one for its type.
  const requirements = clean(d.admission_requirements).slice(0, 400)
  const fees = clean(d.tuition_fee)
  const fee = (inst.feeCh ?? 0) * 2
  const langs = (d.languages ?? []).map((l) => (l.abbreviation ?? '').toLowerCase()).filter(Boolean)
  const url = /^https?:\/\//.test(d.url ?? '') ? d.url : undefined
  // Some entries carry the programme page in `location` instead of a place.
  const place = clean(d.location)
  return {
    id: programmeId(['ch-sp', d.id]),
    name: clean(d.name),
    institution: inst.name,
    country: 'CH',
    city: place && !/^https?:\/\/|^www\./i.test(place) ? place : inst.city,
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
          note: fees ? `Laut Hochschule: ${fees.slice(0, 200)}` : 'Semestergebühren × 2, Stand 2025/26',
        },
    durationYears: years(d, level),
    mode: /teilzeit|temps partiel|tempo parziale|part-time|berufsbegleitend/i.test(d.semester_count ?? '') ? 'both' : 'full-time',
    url,
    institutionUrl: inst.url,
    public: inst.type !== 'fh' || !['ffhs', 'kalaidos'].includes(inst.id),
    admission: CH_ADMISSION[inst.type].de,
    requirements: requirements || undefined,
    institutionType: inst.type,
    focus: focusOf(d, fields),
    degreeTitle: clean(d.degree_name) || undefined,
    ects: ects >= 30 && ects <= 400 ? ects : undefined,
    deadline: deadlineText(d.admission_deadline),
    department: clean(d.departement) || undefined,
    partners: clean(d.partner_institutes) || undefined,
    otherLanguages: extra.length ? extra : undefined,
    priorStudies: prior.length ? prior.slice(0, 12) : undefined,
    regulationsUrl: link(d.regulations_url),
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
      // An umbrella («Design»: graphic, industrial, game …) gives way to the
      // major's own field; a single-field programme («Theater») stays first.
      // Without a field of its own, a major of an umbrella takes only its main field.
      fields: p.fields.length >= 2 ? (own.length ? own.slice(0, 2) : p.fields.slice(0, 1)) : [...new Set([...p.fields, ...own.slice(0, 1)])],
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
