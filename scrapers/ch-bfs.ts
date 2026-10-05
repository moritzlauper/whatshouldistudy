/**
 * Switzerland: the Federal Statistical Office (BFS) publishes how many students
 * are enrolled per institution, subject (Fachrichtung) and level. A subject
 * with Bachelor or Master students at an institution is a programme on offer,
 * with its real size. Institutions are matched to lib/ch-institutions.ts for
 * type, fees, languages and admission.
 *
 * Open use, source must be credited: «Quelle: BFS».
 *
 * The tables are PXWeb cubes. opendata.swiss lists them (the CKAN search finds
 * the current table ids); the PXWeb API gives their variables and the numbers.
 * Variables are recognised by name because BFS releases differ in layout, and
 * everything found is logged, so a format change shows up in the run log.
 */
import { join } from 'node:path'
import { CH_ADMISSION, CH_INSTITUTIONS, findChInstitution } from '../lib/ch-institutions.ts'
import type { ChInstitution } from '../lib/ch-institutions.ts'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, fieldsForTitle, getJson, isMain, log, sleep, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const CKAN = 'https://ckan.opendata.swiss/api/3/action'
const QUERIES = [
  'Studierende universitären Hochschulen Fachrichtung Studienstufe',
  'Studierende Fachhochschulen pädagogischen Hochschulen Fachrichtung',
  'Studierende Hochschulen Fachrichtung',
]

interface Resource {
  url?: string
  download_url?: string
  format?: string
  title?: Record<string, string> | string
  name?: Record<string, string> | string
}

interface Package {
  name: string
  title: Record<string, string> | string
  resources: Resource[]
  metadata_modified?: string
}

const de = (x: Record<string, string> | string | undefined) => (typeof x === 'string' ? x : (x?.de ?? x?.en ?? x?.fr ?? ''))

/** Which column holds what, by header name. */
export function detectColumns(header: string[]) {
  const find = (re: RegExp, not?: RegExp) => header.find((h) => re.test(h) && !(not && not.test(h)))
  return {
    year: find(/jahr|year|annee|ann[ée]e|^periode|zeit/i),
    institution: find(/hochschule|institution|universit|^uh$|^fh$|^ph$|ecole|haute/i, /typ|type|art/i),
    field: find(/fachrichtung|studienfach|field of study|discipline/i) ?? find(/fachbereich|domaine/i, /gruppe|groupe/i),
    level: find(/studienstufe|stufe|niveau|level|examen|abschluss/i),
    value: find(/^wert$|value|anzahl|^obs|^n$|studierende|effectif/i),
  }
}

/** BFS subject names too generic for the lexicon. */
const BFS_FIELDS: Record<string, string[]> = {
  design: ['graphic-design', 'industrial-design'],
  musik: ['music'],
  'musik, theater und andere künste': ['music', 'performing-arts'],
  film: ['film-production'],
  sport: ['sports-science'],
  theater: ['performing-arts'],
  kunst: ['fine-arts'],
  'bildende kunst': ['fine-arts'],
  'angewandte kunst': ['graphic-design', 'fine-arts'],
  kommunikation: ['media-communication'],
  wirtschaft: ['business-management', 'economics'],
  'wirtschaft und dienstleistungen': ['business-management'],
  'technik und it': ['computer-science', 'electrical-engineering', 'mechanical-engineering'],
  gesundheit: ['nursing', 'physiotherapy'],
  'chemie und life sciences': ['chemistry', 'molecular-biology'],
  'land- und forstwirtschaft': ['agriculture'],
  'lehrkräfteausbildung': ['education'],
  holztechnik: ['materials-science', 'mechanical-engineering'],
  telekommunikation: ['electrical-engineering', 'computer-engineering'],
  aviatik: ['aviation', 'aerospace-engineering'],
  'life technologies': ['biomedical-engineering', 'molecular-biology'],
  'information und dokumentation': ['information-systems'],
  konservierung: ['fine-arts', 'archaeology'],
  filmrealisation: ['film-production'],
  'bildnerisches gestalten': ['fine-arts', 'education'],
  'ästhetische erziehung': ['education', 'fine-arts'],
  'vermittlung von kunst und design': ['education', 'fine-arts'],
  'schul- und kirchenmusik': ['music', 'education'],
  'theaterschaffen in den darstellenden künsten': ['performing-arts'],
  'angewandte sprachen': ['languages', 'linguistics'],
  'klassische sprachen europas': ['languages', 'literature'],
  recht: ['law'],
  'exakte wissenschaften übergreifend/übrige': ['mathematics', 'physics'],
  'naturwissenschaften übergreifend/übrige': ['biology', 'environmental-science'],
  'exakte und naturwissenschaften übergreifend/übrige': ['physics', 'biology'],
  kommunikationssysteme: ['electrical-engineering', 'computer-engineering'],
  'betriebs- und produktionswissenschaften': ['industrial-engineering', 'mechanical-engineering'],
  'technische wissenschaften übergreifend/übrige': ['industrial-engineering', 'materials-science'],
  militärwissenschaften: ['political-science'],
  verkehrssysteme: ['civil-engineering', 'logistics'],
  informationstechnologie: ['computer-science', 'information-systems'],
  'technik und it fächerübergreifend / übrige': ['industrial-engineering', 'computer-science'],
  'wirtschaft und dienstleistungen fächerübergreifend / übrige': ['business-management'],
  'design (masterstudio)': ['graphic-design', 'industrial-design'],
  'design fächerübergreifend / übrige': ['graphic-design', 'industrial-design'],
  spitzensport: ['sports-science'],
  transdisziplinarität: ['liberal-arts'],
  'musik und bewegung': ['music', 'education'],
  'gesundheit fächerübergreifend / übrige': ['public-health', 'nursing'],
  fachdidaktik: ['education'],
}

/** Teacher education by subject: Primarstufe is a Bachelor, Sek I a Bachelor plus Master, special needs a Master. */
export function teacherLevels(field: string): Level[] {
  if (/sekundarstufe i(?!i)|sek(\.|undar)?\s*i(?!i)\b/i.test(field)) return ['bachelor', 'master']
  if (/sekundarstufe ii|maturitätsschul|gymnas|berufsfachschul|heilpädagog|förderung|fachdidaktik/i.test(field)) return ['master']
  return ['bachelor']
}

/** «Theologie übergreifend/übrige» reads badly as a programme name. */
export function chProgrammeName(level: Level, field: string): string {
  const name = field.replace(/\s*(fächer)?übergreifend\s*\/\s*übrige$/i, ' (fächerübergreifend)')
  return `${level === 'bachelor' ? 'Bachelor' : 'Master'} ${name}`
}

const ARTS = new Set(['fine-arts', 'graphic-design', 'fashion-design', 'film-production', 'animation-vfx', 'music', 'music-production', 'performing-arts', 'game-design'])
const byId = (id: string) => CH_INSTITUTIONS.find((i) => i.id === id)!

/** BFS counts some schools under their umbrella; teaching and the arts have schools of their own. */
export function splitUmbrella(inst: ChInstitution, bfsName: string, fields: string[]): ChInstitution {
  const teaching = fields[0] === 'education'
  if (inst.id === 'zfh' && !/zhaw|angewandte wissenschaften/i.test(bfsName)) {
    if (fields.some((f) => ARTS.has(f))) return byId('zhdk')
    if (teaching) return byId('phzh')
  }
  if (inst.id === 'fhnw' && teaching) return byId('fhnw-ph')
  if (inst.id === 'supsi' && teaching) return byId('dfa')
  return inst
}

const LEVEL: Array<[RegExp, Level]> = [
  [/bachelor/i, 'bachelor'],
  [/master/i, 'master'],
]

export function parseRows(rows: Array<Record<string, string>>, fetchedAt: string): { programmes: Programme[]; unmatched: Set<string>; unclassified: Set<string> } {
  const header = Object.keys(rows[0] ?? {})
  const col = detectColumns(header)
  const unmatched = new Set<string>()
  const unclassified = new Set<string>()
  if (!col.institution || !col.field) return { programmes: [], unmatched, unclassified }

  // Latest year only.
  const years = col.year ? rows.map((r) => r[col.year!]).filter(Boolean).sort() : []
  const latest = years[years.length - 1]

  const acc = new Map<string, { inst: string; field: string; level: Level; students: number; shared?: boolean }>()
  for (const r of rows) {
    if (latest && col.year && r[col.year] !== latest) continue
    const inst = r[col.institution!]?.trim()
    const field = r[col.field!]?.trim()
    const skip = /^total|^insgesamt|^alle|^ensemble|^andere|^übrige|- total$/i
    if (!inst || !field || skip.test(inst) || skip.test(field)) continue
    const levelText = col.level ? (r[col.level] ?? '') : ''
    const found = LEVEL.find(([re]) => re.test(levelText))?.[1]
    // Without a level column (teacher education), the subject tells.
    const levels = col.level ? (found ? [found] : []) : teacherLevels(field)
    const n = col.value ? Number(String(r[col.value]).replace(/['’\s]/g, '')) : 1
    if (!levels.length || !Number.isFinite(n) || n <= 0) continue
    for (const level of levels) {
      const key = `${inst}|${field}|${level}`
      const a = acc.get(key)
      if (a) a.students += n
      else acc.set(key, { inst, field, level, students: n, shared: levels.length > 1 })
    }
  }

  const programmes: Programme[] = []
  for (const { inst, field, level, students, shared } of acc.values()) {
    const found = findChInstitution(inst)
    if (!found) {
      unmatched.add(inst)
      continue
    }
    const fixed = BFS_FIELDS[field.toLowerCase()]
    const { fields, confidence } = fixed ? { fields: fixed, confidence: 0.8 } : fieldsForTitle(field)
    if (!fields.length) {
      unclassified.add(field)
      continue
    }
    const institution = splitUmbrella(found, inst, fields)
    const fee = (institution.feeCh ?? 0) * 2
    programmes.push({
      id: programmeId(['ch', institution.id, field, level]),
      name: chProgrammeName(level, field),
      institution: institution.name,
      country: 'CH',
      city: institution.city,
      region: institution.canton,
      level,
      fields,
      fieldConfidence: confidence,
      languages: institution.languages,
      tuition: !fee ? undefined : {
        currency: 'CHF',
        domestic: fee,
        eu: institution.feeForeign ? institution.feeForeign * 2 : fee,
        international: institution.feeForeign ? institution.feeForeign * 2 : fee,
        estimated: true,
        note: 'Semestergebühren × 2, Stand 2025/26',
      },
      durationYears: level === 'bachelor' ? 3 : 2,
      mode: 'full-time',
      url: institution.url,
      institutionUrl: institution.url,
      capacity: shared ? undefined : students,
      public: institution.type !== 'fh' || !['ffhs', 'kalaidos'].includes(institution.id),
      admission: CH_ADMISSION[institution.type].de,
      institutionType: institution.type,
      source: 'ch-bfs',
      updated: fetchedAt,
    })
  }
  return { programmes, unmatched, unclassified }
}

const PXWEB = 'https://www.pxweb.bfs.admin.ch/api/v1/de'
/** Students by year, subject, level and institution: universities, then UAS and UTE. */
const KNOWN_TABLES = ['px-x-1502040100_105', 'px-x-1502040400_135']

interface PxVariable {
  code: string
  text: string
  values: string[]
  valueTexts: string[]
  elimination?: boolean
  time?: boolean
}

/** What to ask PXWeb for: the latest year, every subject, level and institution, totals of the rest. */
export function pxQuery(vars: PxVariable[]) {
  const query: Array<{ code: string; selection: { filter: string; values: string[] } }> = []
  for (const v of vars) {
    const name = `${v.code} ${v.text}`
    if (v.time || /jahr|year|ann[ée]e/i.test(name)) {
      // Codes are often just indexes ("0" … "45"); the newest year is the highest text.
      const latest = v.valueTexts.reduce((best, t, i) => (t > v.valueTexts[best] ? i : best), 0)
      query.push({ code: v.code, selection: { filter: 'item', values: [v.values[latest]] } })
    } else if (/studienstufe/i.test(name)) {
      // Only Bachelor and Master: smaller answers, fewer rate limits.
      const wanted = v.values.filter((_, i) => /bachelor|master/i.test(v.valueTexts[i]))
      query.push({ code: v.code, selection: wanted.length ? { filter: 'item', values: wanted } : { filter: 'all', values: ['*'] } })
    } else if (/hochschule|fachrichtung|institution/i.test(name)) {
      query.push({ code: v.code, selection: { filter: 'all', values: ['*'] } })
    } else {
      const total = v.valueTexts.findIndex((t) => /total|insgesamt/i.test(t))
      if (total >= 0) query.push({ code: v.code, selection: { filter: 'item', values: [v.values[total]] } })
      else if (!v.elimination) query.push({ code: v.code, selection: { filter: 'all', values: ['*'] } })
    }
  }
  return { query, response: { format: 'json' } }
}

/** PXWeb «json» answer to rows keyed by variable name, with value texts. */
export function pxRows(vars: PxVariable[], res: { columns: Array<{ code: string; text: string; type: string }>; data: Array<{ key: string[]; values: string[] }> }) {
  const byCode = new Map(vars.map((v) => [v.code, v]))
  const dims = res.columns.filter((c) => c.type !== 'c')
  return res.data.map((d) => {
    const row: Record<string, string> = {}
    dims.forEach((c, i) => {
      const v = byCode.get(c.code)
      const idx = v ? v.values.indexOf(d.key[i]) : -1
      row[c.text] = idx >= 0 ? v!.valueTexts[idx] : d.key[i]
    })
    row.Wert = d.values[0] ?? ''
    return row
  })
}

async function tableIds(): Promise<string[]> {
  const ids = new Set<string>()
  try {
    const found = new Map<string, Package>()
    for (const q of QUERIES) {
      const res = await getJson<{ result: { results: Package[] } }>(`${CKAN}/package_search?q=${encodeURIComponent(q)}&rows=40`)
      for (const p of res.result.results) found.set(p.name, p)
    }
    log(`CH: ${found.size} candidate datasets`)
    // Enrolment by subject, level and institution; the narrowest table per type of school.
    for (const p of found.values()) {
      const t = de(p.title)
      if (!/^studierende/i.test(t) || !/fachrichtung/i.test(t) || !/hochschule$/i.test(t)) continue
      if (/staatsangeh|bildungsherkunft|alter|ohne ph/i.test(t)) continue
      // The universities of teacher education have their own table, without study level.
      const ph = /pädagogischen hochschulen \(ohne fh\)/i.test(t)
      if (!ph && (!/studienstufe/i.test(t) || /geschlecht/i.test(t))) continue
      for (const r of p.resources) {
        const id = (r.url ?? '').match(/(px-x-\d+_\d+)/)?.[1]
        if (id) ids.add(id)
      }
      log(`CH table: ${p.name} | ${t}`)
    }
  } catch (e) {
    log(`CH: opendata.swiss search failed (${(e as Error).message}); using the known tables`)
  }
  for (const id of KNOWN_TABLES) ids.add(id)
  return [...ids]
}

const FIXTURE_SCHOOLS = /^(ETHZ|EPFL|UZH|BE|SG|ZHAW|ZHdK|HSLU|FHNW|BFH|PH Zürich|PHBern|PHLU)$/
const FIXTURE_SUBJECTS = /^(Informatik|Maschineningenieurwesen|Psychologie|Humanmedizin|Rechtswissenschaft|Architektur|Soziale Arbeit|Biologie|Physik|Pflege|Elektrotechnik|Wirtschaftsinformatik|Musik|Vorschul- und Primarstufe|Sekundarstufe I|Betriebsökonomie|Volkswirtschaftslehre|Geschichte|Design|Film)$/

/** Retries a rate-limited call after longer and longer pauses. */
async function patiently<T>(fn: () => Promise<T>): Promise<T> {
  for (let round = 1; ; round++) {
    try {
      return await fn()
    } catch (e) {
      if (round >= 4 || !/429/.test((e as Error).message)) throw e
      log(`CH: rate limited, waiting ${round} min`)
      await sleep(round * 60_000)
    }
  }
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const programmes: Programme[] = []
  const seen = new Set<string>()
  const unmatched = new Set<string>()
  const unclassified = new Set<string>()
  const ids = await tableIds()
  for (const [n, id] of ids.entries()) {
    const url = `${PXWEB}/${id}/${id}.px`
    // PXWeb limits requests per address; give it room between tables.
    if (n > 0) await sleep(20_000)
    try {
      const meta = await patiently(() => getJson<{ title: string; variables: PxVariable[] }>(url))
      log(`CH ${id}: ${meta.title}`)
      for (const v of meta.variables) {
        const all = /hochschule|institution/i.test(v.text) || v.values.length <= 8
        log(`CH ${id} variable ${v.code} «${v.text}»: ${v.values.length} values: ${(all ? v.valueTexts : v.valueTexts.slice(0, 6)).join(' | ')}`)
      }
      const body = pxQuery(meta.variables)
      await sleep(3_000)
      const res = await patiently(() =>
        getJson<Parameters<typeof pxRows>[1]>(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      )
      const rows = pxRows(meta.variables, res)
      log(`CH ${id}: ${rows.length} rows; columns ${JSON.stringify(detectColumns(Object.keys(rows[0] ?? {})))}`)
      for (const r of rows.slice(0, 3)) log(`CH sample: ${JSON.stringify(r)}`)
      // A small slice of real rows for the demo dataset (scrapers/fixtures/ch-bfs.json).
      const slice = rows.filter((r) => Number(r.Wert) > 0 && FIXTURE_SCHOOLS.test(r.Hochschule ?? '') && FIXTURE_SUBJECTS.test(r.Fachrichtung ?? ''))
      log(`CH fixture ${id}: ${JSON.stringify(slice.slice(0, 60))}`)
      const parsed = parseRows(rows, fetchedAt)
      parsed.unmatched.forEach((x) => unmatched.add(x))
      parsed.unclassified.forEach((x) => unclassified.add(x))
      let added = 0
      for (const p of parsed.programmes) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        programmes.push(p)
        added++
      }
      log(`CH ${id}: ${added} programmes`)
    } catch (e) {
      log(`CH ${id} failed: ${(e as Error).message}`)
    }
  }
  if (unmatched.size) log(`CH institutions not matched: ${[...unmatched].slice(0, 40).join(' || ')}`)
  if (unclassified.size) log(`CH subjects not classified: ${[...unclassified].slice(0, 80).join(' || ')}`)
  const byType = new Map<string, number>()
  for (const p of programmes) byType.set(p.institutionType ?? '?', (byType.get(p.institutionType ?? '?') ?? 0) + 1)
  log(`CH: ${programmes.length} programmes (${[...byType].map(([k, v]) => `${k} ${v}`).join(', ')})`)
  if (!programmes.length) throw new Error('No Swiss programmes parsed')
  const out: ScrapeOutput = { source: 'ch-bfs', fetchedAt, programmes }
  writeJson(join(OUT, 'ch-bfs.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
