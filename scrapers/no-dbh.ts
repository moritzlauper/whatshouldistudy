/**
 * Norway: every degree programme at universities and university colleges,
 * from DBH, the Database for Statistics on Higher Education run by the
 * Directorate for Higher Education and Skills (HK-dir), table 347
 * «Studieprogrammer». Open under the Norwegian Licence for Open Government
 * Data (NLOD 2.0), credit «DBH».
 *
 * Each programme carries its NUS code (the Norwegian education
 * classification); Statistics Norway's KLASS API maps NUS to ISCED-F 2013,
 * which gives the field. Names are Norwegian, as the institutions register
 * them. Further-education courses, single-year units and courses below
 * degree level are left out.
 */
import { join } from 'node:path'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, cleanTitle, fetchRetry, fieldsForIsced, fieldsForTitle, getJson, isMain, log, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const DBH = 'https://dbh.hkdir.no/api/Tabeller/hentJSONTabellData'
const KLASS = 'https://data.ssb.no/api/klass/v1/classifications/36/corresponds?targetClassificationId=141&from='

export type DbhRow = Record<string, string | null>

/** DBH level code → our level; null for courses, single-year units and the like. */
export function noLevel(code: string): Level | null {
  if (code === 'B3' || code === 'B4') return 'bachelor'
  if (code === 'M2' || code === 'MX' || code === 'ME') return 'master'
  if (code === 'M5') return 'integrated'
  if (code === 'PR') return 'professional'
  if (code === 'FU') return 'doctorate'
  return null
}

const LANG: Record<string, string> = { NOR: 'no', NOB: 'no', NNO: 'no', ENG: 'en', SME: 'se' }

/** Main seat of the larger institutions (DBH has no place per programme). */
const CITY: Array<[RegExp, string]> = [
  [/universitetet i oslo|oslomet|bi\b|handelshøyskolen bi|kristiania|arkitektur- og designhøgskolen|kunsthøgskolen i oslo|norges musikkhøgskole|norges idrettshøgskole|mf vitenskapelig|politihøgskolen|lovisenberg|vid vitenskapelige|forsvarets høgskole|høyskolen for yrkesfag/i, 'Oslo'],
  [/universitetet i bergen|norges handelshøyskole|høgskulen på vestlandet|nla høgskolen/i, 'Bergen'],
  [/norges teknisk-naturvitenskapelige|ntnu|dronning mauds minne/i, 'Trondheim'],
  [/uit norges arktiske|universitetet i tromsø/i, 'Tromsø'],
  [/universitetet i stavanger/i, 'Stavanger'],
  [/universitetet i agder/i, 'Kristiansand'],
  [/nord universitet/i, 'Bodø'],
  [/norges miljø- og biovitenskapelige|nmbu/i, 'Ås'],
  [/universitetet i sørøst-norge/i, 'Notodden'],
  [/høgskolen i innlandet/i, 'Lillehammer'],
  [/høgskolen i østfold/i, 'Halden'],
  [/høgskolen i molde/i, 'Molde'],
  [/høgskulen i volda/i, 'Volda'],
  [/samisk høgskole/i, 'Kautokeino'],
]

const cityOf = (inst: string) => CITY.find(([re]) => re.test(inst))?.[1]

const typeOf = (inst: string) => (/universitet/i.test(inst) ? 'uni' : /kunst|musikk|arkitektur|design/i.test(inst) ? 'art' : 'fh')

/** «20262» (year and term: 1 spring, 3 autumn) or «99999» for open-ended. */
const termCode = (d: Date) => d.getUTCFullYear() * 10 + (d.getUTCMonth() >= 6 ? 3 : 1)

/** Programmes from table 347; `isced` maps a NUS code to its ISCED-F 2013 code. */
export function parseDbh(rows: DbhRow[], isced: Map<string, string>, fetchedAt: string): { programmes: Programme[]; unclassified: number; examples: string[] } {
  const now = termCode(new Date(fetchedAt))
  const seen = new Set<string>()
  const programmes: Programme[] = []
  let unclassified = 0
  // A sample of what found no field, for the run log.
  const examples: string[] = []
  for (const r of rows) {
    const s = (k: string) => (r[k] ?? '').trim()
    const level = noLevel(s('Nivåkode'))
    if (!level || s('Videreutd.') === '1') continue
    const until = Number(s('Tilbys til')) || 99999
    if (until < now) continue
    const key = `${s('Institusjonskode')}|${s('Studieprogramkode')}`
    if (seen.has(key)) continue
    seen.add(key)
    const name = cleanTitle(s('Studieprogramnavn'))
    const institution = cleanTitle(s('Institusjonsnavn'))
    if (!name || !institution) continue
    const code = isced.get(s('NUS-kode'))
    const candidates = code ? fieldsForIsced(code) : []
    const byTitle = fieldsForTitle(name, candidates)
    const fields = byTitle.fields.length ? byTitle.fields : candidates.slice(0, 2)
    if (!fields.length) {
      unclassified++
      if (examples.length < 60) examples.push(name)
      continue
    }
    const confidence = candidates.includes(fields[0]) ? (byTitle.fields.length ? 1 : 0.8) : byTitle.confidence
    const ects = Number(s('Studiepoeng')) || undefined
    const share = Number(s('Andel av heltid')) || 1
    const lang = LANG[s('Underv.språk')]
    programmes.push({
      id: programmeId(['no', s('Institusjonskode'), s('Studieprogramkode')]),
      name,
      institution,
      country: 'NO',
      city: cityOf(institution),
      level,
      fields: fields.slice(0, 3),
      fieldConfidence: Math.round(confidence * 100) / 100,
      languages: lang ? [lang] : undefined,
      durationYears: ects ? Math.round((ects / 60 / Math.min(1, share)) * 2) / 2 : undefined,
      ects,
      mode: s('Organisering_kode') === '3' ? 'distance' : share < 1 ? 'part-time' : 'full-time',
      institutionType: typeOf(institution),
      department: s('Avdelingsnavn') && !/uspesifisert/i.test(s('Avdelingsnavn')) ? s('Avdelingsnavn') : undefined,
      source: 'no-dbh',
      updated: fetchedAt,
    })
  }
  return { programmes, unclassified, examples }
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const body = {
    tabell_id: 347,
    api_versjon: 1,
    statuslinje: 'N',
    kodetekst: 'J',
    desimal_separator: '.',
    variabler: ['*'],
    filter: [{ variabel: 'Årstall', selection: { filter: 'top', values: ['1'] } }],
  }
  const rows = (await (await fetchRetry(DBH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()) as DbhRow[]
  log(`DBH: ${rows.length} rows`)
  const corr = await getJson<{ correspondenceItems: Array<{ sourceCode: string; targetCode: string }> }>(`${KLASS}${fetchedAt.slice(0, 10)}`)
  const isced = new Map(corr.correspondenceItems.map((c) => [c.sourceCode, c.targetCode]))
  log(`KLASS: ${isced.size} NUS codes mapped to ISCED-F`)
  const { programmes, unclassified, examples } = parseDbh(rows, isced, fetchedAt)
  const byLevel: Record<string, number> = {}
  for (const p of programmes) byLevel[p.level] = (byLevel[p.level] ?? 0) + 1
  log(`DBH: ${programmes.length} programmes ${JSON.stringify(byLevel)}, ${unclassified} without a field`)
  if (examples.length) log(`  without a field, e.g.: ${examples.join(' · ')}`)
  if (programmes.length < 800) throw new Error(`only ${programmes.length} programmes, the table may have changed`)
  const out: ScrapeOutput = { source: 'no-dbh', fetchedAt, programmes }
  writeJson(join(OUT, 'no-dbh.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
