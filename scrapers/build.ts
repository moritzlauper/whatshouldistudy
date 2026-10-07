/**
 * Merges the scraper outputs into the files the site serves:
 *
 *   programmes/<field>.json   every programme of a field, all countries
 *   research/<field>.json     strongest universities per country (OpenAlex)
 *   directory/<CC>.json       all universities of a country
 *   catalogue/<CC>.json       the free public catalogue of a country's programmes
 *   meta.json                 sources, counts per field and country, FX rates
 *   stats.json                per field: programme counts, US earnings, Swiss salaries
 *
 * `--previous <dir>` carries over when each programme was first seen, so new
 * programmes can be flagged. `--sample` builds the small demo dataset in
 * data/sample from scrapers/fixtures instead (no network).
 */
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { toCatalogueEntry } from '../lib/programmes.ts'
import { LINK_ONLY } from '../lib/catalogue.ts'
import type { CatalogueShard, DataMeta, FieldStat, Level, Programme, ProgrammeShard, ResearchInstitution, ResearchShard, SourceStatus } from '../lib/programmes.ts'
import { FIELDS } from '../lib/taxonomy/fields.ts'
import { FIXTURES, OUT, ROOT, fetchRetry, log, readJson, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'
import { parseSchools } from './us-scorecard.ts'
import type { RawSchool } from './us-scorecard.ts'
import { parseRecords } from './fr-parcoursup.ts'
import { parseCourses } from './uk-discoveruni.ts'
import type { UkCourse } from './uk-discoveruni.ts'
import { rankInstitutions } from './global-openalex.ts'
import type { RawInstitution } from './global-openalex.ts'
import { buildDirectory } from './global-directory.ts'
import { parseRows as parseChRows } from './ch-bfs.ts'
import { parseSpDetails } from './ch-studyprogrammes.ts'
import type { SpDetails } from './ch-studyprogrammes.ts'
import { parseAngebot } from './de-studiensuche.ts'
import type { RawAngebot } from './de-studiensuche.ts'
import { parseItem as parseAtItem } from './at-hochschulen.ts'
import type { ListItem as AtListItem } from './at-hochschulen.ts'
import { parseDepartments as parseKrDepartments, parseSchools as parseKrSchools } from './kr-academyinfo.ts'
import type { DirectoryEntry, RawUniversity } from './global-directory.ts'
import { chSalaryFor, chSalaryValue } from '../lib/ch-salary.ts'
import type { ChSalaryTable } from '../lib/ch-salary.ts'

const PROGRAMME_SOURCES = ['us-college-scorecard', 'uk-discover-uni', 'fr-parcoursup', 'ch-studyprogrammes', 'ch-bfs', 'de-studiensuche', 'at-studienwahl', 'kr-academyinfo', 'au-cricos', 'fi-opintopolku']

const SOURCES: Array<Omit<SourceStatus, 'ok' | 'count' | 'fetchedAt' | 'error'>> = [
  {
    id: 'us-college-scorecard',
    name: 'College Scorecard (U.S. Department of Education)',
    countries: ['US'],
    url: 'https://collegescorecard.ed.gov/data/',
    licence: 'Public domain',
  },
  {
    id: 'uk-discover-uni',
    name: 'Discover Uni (Office for Students)',
    countries: ['GB'],
    url: 'https://discoveruni.gov.uk/',
    licence: 'CC BY 4.0',
  },
  {
    id: 'fr-parcoursup',
    name: 'Parcoursup open data (Ministère de l’Enseignement supérieur)',
    countries: ['FR'],
    url: 'https://data.enseignementsup-recherche.gouv.fr/',
    licence: 'Licence Ouverte 2.0',
  },
  {
    id: 'ch-studyprogrammes',
    name: 'studyprogrammes.ch (swissuniversities)',
    countries: ['CH'],
    url: 'https://www.studyprogrammes.ch',
    licence: 'Public catalogue of swissuniversities; descriptions © the institutions',
  },
  {
    id: 'ch-bfs-salaries',
    name: 'Erwerbseinkommen ein Jahr nach Studienabschluss (Bundesamt für Statistik, EHA)',
    countries: ['CH'],
    url: 'https://www.bfs.admin.ch/bfs/de/home/statistiken/bildung-wissenschaft/uebertritte-verlaeufe-bildungsbereich/absolventen-hochschulen.html',
    licence: 'Open use, source must be credited (BFS)',
  },
  {
    id: 'ch-bfs',
    name: 'Studierende nach Hochschule und Fachrichtung (Bundesamt für Statistik)',
    countries: ['CH'],
    url: 'https://opendata.swiss/de/organization/bundesamt-fur-statistik-bfs',
    licence: 'Open use, Quelle: BFS',
  },
  {
    id: 'de-studiensuche',
    name: 'Studiensuche (Bundesagentur für Arbeit)',
    countries: ['DE'],
    url: 'https://studiensuche.arbeitsagentur.de/',
    licence: 'Öffentliche Schnittstelle der Bundesagentur für Arbeit',
  },
  {
    id: 'at-studienwahl',
    name: 'studienwahl.at (Bundesministerium für Frauen, Wissenschaft und Forschung, OeAD)',
    countries: ['AT'],
    url: 'https://www.studienwahl.at/',
    licence: 'Öffentliches Studienportal',
  },
  {
    id: 'kr-academyinfo',
    name: 'Korea Higher Education Information, 대학알리미 (Ministry of Education, KCUE)',
    countries: ['KR'],
    url: 'https://www.academyinfo.go.kr/',
    licence: 'Public disclosure data (공공데이터)',
  },
  {
    id: 'au-cricos',
    name: 'CRICOS (Australian Government Department of Education)',
    countries: ['AU'],
    url: 'https://data.gov.au/data/dataset/cricos',
    licence: 'CC BY 2.5 AU',
  },
  {
    id: 'fi-opintopolku',
    name: 'Opintopolku / Studyinfo.fi (Finnish National Agency for Education)',
    countries: ['FI'],
    url: 'https://opintopolku.fi/',
    licence: 'CC BY 4.0',
  },
  {
    id: 'global-openalex',
    name: 'OpenAlex institution research profiles',
    countries: ['*'],
    url: 'https://openalex.org/',
    licence: 'CC0',
  },
  {
    id: 'global-directory',
    name: 'University Domains List (Hipo)',
    countries: ['*'],
    url: 'https://github.com/Hipo/university-domains-list',
    licence: 'MIT',
  },
]

/** EUR per unit; fallback when the ECB feed can't be reached. */
const FX_FALLBACK: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.06, SEK: 0.087, DKK: 0.134, NOK: 0.086, PLN: 0.23, CZK: 0.04, HUF: 0.0025, CAD: 0.67, AUD: 0.6, JPY: 0.0061, KRW: 0.00064 }

async function fetchFx(): Promise<Record<string, number>> {
  try {
    const xml = await (await fetchRetry('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', {}, 2)).text()
    const fx: Record<string, number> = { EUR: 1 }
    for (const m of xml.matchAll(/currency='([A-Z]{3})' rate='([\d.]+)'/g)) fx[m[1]] = Math.round((1 / Number(m[2])) * 1e6) / 1e6
    if (fx.USD) return fx
  } catch (e) {
    log(`FX: ECB unavailable (${(e as Error).message}), using fallback rates`)
  }
  return FX_FALLBACK
}

interface Inputs {
  outputs: ScrapeOutput[]
  chSalaries: ChSalaryTable | null
  carriedChSalaries?: Record<string, FieldStat['ch']>
  research: Record<string, Record<string, ResearchInstitution[]>> | null
  directory: Record<string, DirectoryEntry[]> | null
  status: Map<string, Partial<SourceStatus>>
}

function readOutputs(): Inputs {
  const status = new Map<string, Partial<SourceStatus>>()
  const outputs: ScrapeOutput[] = []
  for (const id of PROGRAMME_SOURCES) {
    const o = readJson<ScrapeOutput>(join(OUT, `${id}.json`))
    if (o) {
      outputs.push(o)
      status.set(id, { ok: o.programmes.length > 0, count: o.programmes.length, fetchedAt: o.fetchedAt })
    } else status.set(id, { ok: false, count: 0, error: 'scraper did not produce output' })
  }
  const r = readJson<{ fetchedAt: string; institutions: number; byField: Inputs['research'] }>(join(OUT, 'global-openalex.json'))
  status.set('global-openalex', r ? { ok: true, count: r.institutions, fetchedAt: r.fetchedAt } : { ok: false, count: 0, error: 'no output' })
  const d = readJson<{ fetchedAt: string; byCountry: Inputs['directory'] }>(join(OUT, 'global-directory.json'))
  status.set(
    'global-directory',
    d ? { ok: true, count: Object.values(d.byCountry ?? {}).reduce((s, l) => s + l.length, 0), fetchedAt: d.fetchedAt } : { ok: false, count: 0, error: 'no output' },
  )
  const chSalaries = readJson<ChSalaryTable>(join(OUT, 'ch-salaries.json'))
  status.set(
    'ch-bfs-salaries',
    chSalaries ? { ok: true, count: Object.keys(chSalaries.uh).length + Object.keys(chSalaries.fh).length, fetchedAt: chSalaries.fetchedAt } : { ok: false, count: 0, error: 'no output' },
  )
  return { outputs, chSalaries, research: r?.byField ?? null, directory: d?.byCountry ?? null, status }
}

function readFixtures(): Inputs {
  const at = '2026-01-01T00:00:00.000Z'
  const status = new Map<string, Partial<SourceStatus>>()
  const us = parseSchools(readJson<{ results: RawSchool[] }>(join(FIXTURES, 'us-scorecard.json'))!.results, at)
  const fr = parseRecords(readJson<Array<Record<string, unknown>>>(join(FIXTURES, 'fr-parcoursup.json'))!, at).programmes
  const ukFixture = readJson<{ websites: Record<string, string>; courses: UkCourse[] }>(join(FIXTURES, 'uk-discoveruni.json'))!
  const uk = parseCourses(ukFixture.courses, at, new Map(Object.entries(ukFixture.websites))).programmes
  const chTables = readJson<{ tables: Record<string, Array<Record<string, string>>> }>(join(FIXTURES, 'ch-bfs.json'))!.tables
  const seen = new Set<string>()
  const ch = Object.values(chTables)
    .flatMap((rows) => parseChRows(rows, at).programmes)
    .filter((p) => !seen.has(p.id) && seen.add(p.id))
  const de = readJson<RawAngebot[]>(join(FIXTURES, 'de-studiensuche.json'))!
    .map((a) => parseAngebot(a, at))
    .filter((p): p is Programme => !!p && !seen.has(p.id) && !!seen.add(p.id))
  const atItems = readJson<AtListItem[]>(join(FIXTURES, 'at-studienwahl.json'))!
    .map((it) => parseAtItem(it, at))
    .filter((p): p is Programme => !!p)
  const kr = readJson<{ list: string[][]; schools: string[][] }>(join(FIXTURES, 'kr-academyinfo.json'))!
  const krItems = parseKrDepartments(kr.list, parseKrSchools(kr.schools), at).programmes
  const outputs = [
    { source: 'us-college-scorecard', fetchedAt: at, programmes: us },
    { source: 'uk-discover-uni', fetchedAt: at, programmes: uk },
    { source: 'fr-parcoursup', fetchedAt: at, programmes: fr },
    {
      source: 'ch-studyprogrammes',
      fetchedAt: at,
      programmes: readJson<Array<{ level: Level; d: SpDetails }>>(join(FIXTURES, 'ch-studyprogrammes.json'))!
        .map((x) => parseSpDetails(x.d, x.level, at))
        .filter((p): p is Programme => !!p),
    },
    { source: 'ch-bfs', fetchedAt: at, programmes: ch },
    { source: 'de-studiensuche', fetchedAt: at, programmes: de },
    { source: 'at-studienwahl', fetchedAt: at, programmes: atItems },
    { source: 'kr-academyinfo', fetchedAt: at, programmes: krItems },
  ]
  for (const o of outputs) status.set(o.source, { ok: true, count: o.programmes.length, fetchedAt: at })
  const research = rankInstitutions(readJson<RawInstitution[]>(join(FIXTURES, 'openalex-institutions.json'))!)
  const directory = buildDirectory(readJson<RawUniversity[]>(join(FIXTURES, 'directory.json'))!)
  status.set('global-openalex', { ok: true, count: 12, fetchedAt: at })
  status.set('global-directory', { ok: true, count: Object.values(directory).reduce((s, l) => s + l.length, 0), fetchedAt: at })
  const chSalaries = readJson<ChSalaryTable>(join(FIXTURES, 'ch-salaries.json'))
  status.set('ch-bfs-salaries', { ok: true, count: 20, fetchedAt: at })
  return { outputs, chSalaries, research, directory, status }
}

function previousFirstSeen(dir: string | undefined): Map<string, string> {
  const seen = new Map<string, string>()
  if (!dir || !existsSync(join(dir, 'programmes'))) return seen
  for (const f of readdirSync(join(dir, 'programmes'))) {
    if (!f.endsWith('.json')) continue
    const shard = JSON.parse(readFileSync(join(dir, 'programmes', f), 'utf8')) as ProgrammeShard
    for (const p of shard.programmes) if (p.firstSeen && !seen.has(p.id)) seen.set(p.id, p.firstSeen)
  }
  log(`Previous data: ${seen.size} programmes with a first-seen date`)
  return seen
}

/**
 * A source that failed this run keeps last run's programmes (and research or
 * directory files), so one broken scraper never empties a country.
 */
function carryOver(inputs: Inputs, dir: string) {
  const prevMeta = readJson<DataMeta>(join(dir, 'meta.json'))
  for (const id of PROGRAMME_SOURCES) {
    const fresh = inputs.outputs.find((o) => o.source === id && o.programmes.length)
    const prevCount = prevMeta?.sources.find((s) => s.id === id)?.count ?? 0
    // A source that suddenly shrinks by half is more likely broken than real.
    if (fresh && fresh.programmes.length >= prevCount * 0.5) continue
    if (fresh) {
      log(`Shrink guard: ${id} has ${fresh.programmes.length} programmes, previously ${prevCount}; keeping the previous data`)
      inputs.outputs.splice(inputs.outputs.indexOf(fresh), 1)
      inputs.status.set(id, { ok: false, error: `only ${fresh.programmes.length} programmes this run` })
    }
    if (!existsSync(join(dir, 'programmes'))) continue
    const byId = new Map<string, Programme>()
    for (const f of readdirSync(join(dir, 'programmes'))) {
      const shard = JSON.parse(readFileSync(join(dir, 'programmes', f), 'utf8')) as ProgrammeShard
      for (const p of shard.programmes) if (p.source === id) byId.set(p.id, p)
    }
    if (!byId.size) continue
    const prev = prevMeta?.sources.find((s) => s.id === id)
    inputs.outputs.push({ source: id, fetchedAt: prev?.fetchedAt ?? '', programmes: [...byId.values()] })
    const st = inputs.status.get(id) ?? {}
    inputs.status.set(id, { ...st, ok: false, count: byId.size, fetchedAt: prev?.fetchedAt, error: `${st.error ?? 'failed'}; kept data from the previous run` })
    log(`Carry-over: ${id} ${byId.size} programmes from the previous run`)
  }
  if (!inputs.chSalaries) {
    const prevStats = readJson<Record<string, FieldStat>>(join(dir, 'stats.json'))
    if (prevStats && Object.values(prevStats).some((s) => s.ch)) {
      inputs.carriedChSalaries = Object.fromEntries(Object.entries(prevStats).map(([id, s]) => [id, s.ch]))
      inputs.status.set('ch-bfs-salaries', { ...prevMeta?.sources.find((x) => x.id === 'ch-bfs-salaries'), ok: false, error: 'failed; kept data from the previous run' })
      log('Carry-over: Swiss salaries from the previous run')
    }
  }
  if (!inputs.research && existsSync(join(dir, 'research'))) {
    const research: NonNullable<Inputs['research']> = {}
    for (const f of readdirSync(join(dir, 'research'))) {
      const shard = JSON.parse(readFileSync(join(dir, 'research', f), 'utf8')) as ResearchShard
      research[shard.field] = shard.byCountry
    }
    inputs.research = research
    inputs.status.set('global-openalex', { ...prevMeta?.sources.find((x) => x.id === 'global-openalex'), ok: false, error: 'failed; kept data from the previous run' })
    log('Carry-over: research profiles from the previous run')
  }
  if (!inputs.directory && existsSync(join(dir, 'directory'))) {
    const directory: NonNullable<Inputs['directory']> = {}
    for (const f of readdirSync(join(dir, 'directory'))) directory[f.replace('.json', '')] = JSON.parse(readFileSync(join(dir, 'directory', f), 'utf8'))
    inputs.directory = directory
    inputs.status.set('global-directory', { ...prevMeta?.sources.find((x) => x.id === 'global-directory'), ok: false, error: 'failed; kept data from the previous run' })
    log('Carry-over: university directory from the previous run')
  }
}

/**
 * Switzerland has two sources: the studyprogrammes.ch catalogue (real
 * programmes with their focus) and BFS enrolment (one entry per institution,
 * subject and level, with student numbers). Where the catalogue covers an
 * institution, level and field, the BFS entry goes; its student number moves
 * over when exactly one catalogue programme matches.
 */
function dedupeSwiss(all: Programme[]) {
  const key = (p: Programme) => `${p.institution}|${p.level}|${p.fields[0]}`
  const sp = new Map<string, Programme[]>()
  for (const p of all) if (p.source === 'ch-studyprogrammes') sp.set(key(p), [...(sp.get(key(p)) ?? []), p])
  if (!sp.size) return
  let dropped = 0
  for (let i = all.length - 1; i >= 0; i--) {
    const p = all[i]
    if (p.source !== 'ch-bfs') continue
    const match = sp.get(key(p))
    if (!match) continue
    if (match.length === 1 && p.capacity && !match[0].capacity) match[0].capacity = p.capacity
    all.splice(i, 1)
    dropped++
  }
  log(`Switzerland: ${dropped} BFS entries replaced by catalogue programmes`)
}

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const normName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Programmes without an institution website get it from the world directory, by name. */
function fillInstitutionUrls(all: Programme[], directory: Inputs['directory']) {
  if (!directory) return
  const index = new Map<string, string>()
  for (const [cc, list] of Object.entries(directory)) for (const u of list) if (u.url) index.set(`${cc}|${normName(u.name)}`, u.url)
  let filled = 0
  for (const p of all) {
    if (p.institutionUrl) continue
    const url = index.get(`${p.country}|${normName(p.institution)}`)
    if (url) {
      p.institutionUrl = url
      filled++
    }
  }
  log(`Institution websites from the directory: ${filled}`)
}

function countryTotals(all: Programme[]): NonNullable<DataMeta['byCountry']> {
  const out: NonNullable<DataMeta['byCountry']> = {}
  const inst = new Map<string, Set<string>>()
  for (const p of all) {
    const c = (out[p.country] ??= { programmes: 0, institutions: 0, byType: {} })
    c.programmes++
    if (p.institutionType) c.byType[p.institutionType] = (c.byType[p.institutionType] ?? 0) + 1
    if (!inst.has(p.country)) inst.set(p.country, new Set())
    inst.get(p.country)!.add(p.institution)
  }
  for (const [cc, set] of inst) out[cc].institutions = set.size
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const sample = args.includes('--sample')
  const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
  const outDir = sample ? join(ROOT, 'data', 'sample') : (arg('--out') ?? join(ROOT, 'scrapers', 'dist'))
  const prevDir = arg('--previous')
  const today = sample ? '2026-01-01' : new Date().toISOString().slice(0, 10)
  const updated = sample ? '2026-01-01T00:00:00.000Z' : new Date().toISOString()

  const inputs = sample ? readFixtures() : readOutputs()
  const firstSeen = previousFirstSeen(prevDir)
  const isFirstRun = firstSeen.size === 0
  if (!sample && prevDir) carryOver(inputs, prevDir)

  const all: Programme[] = []
  for (const o of inputs.outputs) {
    for (const p of o.programmes) {
      // On the very first run nothing is "new"; mark everything as seen long ago.
      // A major split out of a known programme isn't new.
      p.firstSeen = firstSeen.get(p.id) ?? (p.parent ? firstSeen.get(p.parent) : undefined) ?? (isFirstRun ? '2000-01-01' : today)
      all.push(p)
    }
  }
  dedupeSwiss(all)
  log(`Programmes: ${all.length}`)
  fillInstitutionUrls(all, inputs.directory)

  rmSync(outDir, { recursive: true, force: true })

  const counts: DataMeta['counts'] = {}
  const stats: Record<string, FieldStat> = {}
  for (const f of FIELDS) {
    const list = all.filter((p) => p.fields.includes(f.id))
    list.sort((a, b) => a.country.localeCompare(b.country) || a.institution.localeCompare(b.institution) || a.name.localeCompare(b.name))
    const shard: ProgrammeShard = { field: f.id, updated, count: list.length, programmes: list }
    writeJson(join(outDir, 'programmes', `${f.id}.json`), shard)
    const byCountry: Record<string, number> = {}
    for (const p of list) byCountry[p.country] = (byCountry[p.country] ?? 0) + 1
    counts[f.id] = byCountry
    const earnings = list.filter((p) => p.fields[0] === f.id && p.level === 'bachelor' && p.earnings?.currency === 'USD').map((p) => p.earnings!.median)
    stats[f.id] = { programmes: list.length, countries: Object.keys(byCountry).length, usMedianEarnings: earnings.length >= 3 ? median(earnings) : undefined }
    const ch = inputs.chSalaries ? chSalaryFor(f.id, inputs.chSalaries) : inputs.carriedChSalaries?.[f.id]
    if (ch) stats[f.id].ch = ch
  }
  const withChSalary = Object.entries(stats)
    .filter(([, s]) => chSalaryValue(s.ch))
    .sort((a, b) => chSalaryValue(a[1].ch)! - chSalaryValue(b[1].ch)!)
  withChSalary.forEach(([id], i) => (stats[id].chSalaryPercentile = withChSalary.length > 1 ? Math.round((i / (withChSalary.length - 1)) * 100) / 100 : 0.5))
  // Salary percentile among fields with US earnings data.
  const withEarnings = Object.entries(stats)
    .filter(([, s]) => s.usMedianEarnings)
    .sort((a, b) => a[1].usMedianEarnings! - b[1].usMedianEarnings!)
  withEarnings.forEach(([id], i) => (stats[id].salaryPercentile = withEarnings.length > 1 ? Math.round((i / (withEarnings.length - 1)) * 100) / 100 : 0.5))

  const catalogues = new Map<string, Programme[]>()
  for (const p of all) {
    if (!p.fields.length || LINK_ONLY[p.country]) continue
    if (!catalogues.has(p.country)) catalogues.set(p.country, [])
    catalogues.get(p.country)!.push(p)
  }
  for (const [cc, list] of catalogues) {
    list.sort((a, b) => a.institution.localeCompare(b.institution) || a.name.localeCompare(b.name))
    const shard: CatalogueShard = { country: cc, updated, count: list.length, programmes: list.map(toCatalogueEntry) }
    writeJson(join(outDir, 'catalogue', `${cc}.json`), shard)
  }

  if (inputs.research) {
    for (const f of FIELDS) {
      const shard: ResearchShard = { field: f.id, updated, byCountry: inputs.research[f.id] ?? {} }
      writeJson(join(outDir, 'research', `${f.id}.json`), shard)
    }
  }
  if (inputs.directory) {
    for (const [cc, list] of Object.entries(inputs.directory)) writeJson(join(outDir, 'directory', `${cc}.json`), list)
  }

  const cutoff = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)
  const meta: DataMeta = {
    updated,
    sources: SOURCES.map((s) => ({ ...s, ok: false, count: 0, ...inputs.status.get(s.id) })),
    fx: sample ? FX_FALLBACK : await fetchFx(),
    counts,
    totals: {
      programmes: all.length,
      countries: new Set(all.map((p) => p.country)).size,
      institutions: new Set(all.map((p) => `${p.country}|${p.institution}`)).size,
      newLast90Days: all.filter((p) => (p.firstSeen ?? '') >= cutoff && !isFirstRun).length,
    },
    unclassified: 0,
    byCountry: countryTotals(all),
  }
  writeJson(join(outDir, 'meta.json'), meta, true)
  writeJson(join(outDir, 'stats.json'), stats, true)
  log(`Wrote ${outDir}: ${all.length} programmes, ${meta.totals.institutions} institutions, ${meta.totals.countries} countries`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
