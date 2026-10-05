/**
 * Switzerland: the Federal Statistical Office (BFS) publishes on opendata.swiss
 * how many students are enrolled per institution, subject (Fachrichtung) and
 * level. A subject with Bachelor or Master students at an institution is a
 * programme on offer, with its real size. Institutions are matched to
 * lib/ch-institutions.ts for type, fees, languages and admission.
 *
 * Open use, source must be credited: «Quelle: BFS».
 *
 * The CKAN search finds the current datasets; the CSV columns are read by
 * name pattern because BFS releases differ in layout. Everything found is
 * logged, so a format change shows up in the run log.
 */
import { join } from 'node:path'
import { CH_ADMISSION, findChInstitution } from '../lib/ch-institutions.ts'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, csvObjects, fetchRetry, fieldsForTitle, getJson, isMain, log, writeJson } from './lib/common.ts'
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
  if (!col.institution || !col.field || !col.level) return { programmes: [], unmatched, unclassified }

  // Latest year only.
  const years = col.year ? rows.map((r) => r[col.year!]).filter(Boolean).sort() : []
  const latest = years[years.length - 1]

  const acc = new Map<string, { inst: string; field: string; level: Level; students: number }>()
  for (const r of rows) {
    if (latest && col.year && r[col.year] !== latest) continue
    const levelText = r[col.level!] ?? ''
    const level = LEVEL.find(([re]) => re.test(levelText))?.[1]
    if (!level) continue
    const inst = r[col.institution!]?.trim()
    const field = r[col.field!]?.trim()
    if (!inst || !field || /^total|^insgesamt|^alle|^ensemble/i.test(inst) || /^total|^insgesamt|^alle|^ensemble/i.test(field)) continue
    const n = col.value ? Number(String(r[col.value]).replace(/['’\s]/g, '')) : 1
    if (!Number.isFinite(n) || n <= 0) continue
    const key = `${inst}|${field}|${level}`
    const a = acc.get(key)
    if (a) a.students += n
    else acc.set(key, { inst, field, level, students: n })
  }

  const programmes: Programme[] = []
  for (const { inst, field, level, students } of acc.values()) {
    const institution = findChInstitution(inst)
    if (!institution) {
      unmatched.add(inst)
      continue
    }
    const fixed = BFS_FIELDS[field.toLowerCase()]
    const { fields, confidence } = fixed ? { fields: fixed, confidence: 0.8 } : fieldsForTitle(field)
    if (!fields.length) {
      unclassified.add(field)
      continue
    }
    const fee = institution.feeCh * 2
    programmes.push({
      id: programmeId(['ch', institution.id, field, level]),
      name: `${level === 'bachelor' ? 'Bachelor' : 'Master'} ${field}`,
      institution: institution.name,
      country: 'CH',
      city: institution.city,
      region: institution.canton,
      level,
      fields,
      fieldConfidence: confidence,
      languages: institution.languages,
      tuition: {
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
      capacity: students,
      public: institution.type !== 'fh' || !['ffhs', 'kalaidos'].includes(institution.id),
      admission: CH_ADMISSION[institution.type].de,
      institutionType: institution.type,
      source: 'ch-bfs',
      updated: fetchedAt,
    })
  }
  return { programmes, unmatched, unclassified }
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const found = new Map<string, Package>()
  for (const q of QUERIES) {
    const res = await getJson<{ result: { results: Package[] } }>(`${CKAN}/package_search?q=${encodeURIComponent(q)}&rows=40`)
    for (const p of res.result.results) found.set(p.name, p)
  }
  log(`CH: ${found.size} candidate datasets`)
  for (const p of found.values()) log(`CH dataset: ${p.name} | ${de(p.title)} | ${p.resources.map((r) => r.format).join(',')}`)

  // Datasets on enrolment by institution and subject; subject (Fachrichtung) beats subject group.
  const candidates = [...found.values()]
    .filter((p) => /studierende/i.test(de(p.title)) && /hochschul/i.test(de(p.title)) && /fach/i.test(de(p.title)))
    .sort((a, b) => Number(/fachrichtung/i.test(de(b.title))) - Number(/fachrichtung/i.test(de(a.title))))

  const programmes: Programme[] = []
  const seen = new Set<string>()
  const unmatched = new Set<string>()
  const unclassified = new Set<string>()
  for (const p of candidates.slice(0, 6)) {
    const csv = p.resources.find((r) => /csv/i.test(r.format ?? '') || /\.csv/i.test(r.url ?? ''))
    const url = csv?.download_url ?? csv?.url
    if (!url) {
      log(`CH: ${p.name} has no CSV (${p.resources.map((r) => `${r.format}:${r.url}`).join(' ')})`)
      continue
    }
    try {
      const raw = await (await fetchRetry(url)).arrayBuffer()
      // BFS files are UTF-8 or Latin-1, comma or semicolon separated.
      let text = new TextDecoder('utf-8').decode(raw)
      if (text.includes('�')) text = new TextDecoder('latin1').decode(raw)
      const firstLine = text.split(/\r?\n/, 1)[0]
      const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
      const rows = csvObjects(text, delimiter)
      log(`CH: ${p.name}: ${rows.length} rows; columns: ${Object.keys(rows[0] ?? {}).join(' | ')}`)
      for (const r of rows.slice(0, 3)) log(`CH sample: ${JSON.stringify(r).slice(0, 400)}`)
      log(`CH columns detected: ${JSON.stringify(detectColumns(Object.keys(rows[0] ?? {})))}`)
      const res = parseRows(rows, fetchedAt)
      res.unmatched.forEach((x) => unmatched.add(x))
      res.unclassified.forEach((x) => unclassified.add(x))
      for (const prog of res.programmes) {
        if (seen.has(prog.id)) continue
        seen.add(prog.id)
        programmes.push(prog)
      }
      log(`CH: ${p.name} → ${res.programmes.length} programmes`)
    } catch (e) {
      log(`CH: ${p.name} failed: ${(e as Error).message}`)
    }
  }
  if (unmatched.size) log(`CH institutions not matched: ${[...unmatched].slice(0, 40).join(' || ')}`)
  if (unclassified.size) log(`CH subjects not classified: ${[...unclassified].slice(0, 60).join(' || ')}`)
  log(`CH: ${programmes.length} programmes`)
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
