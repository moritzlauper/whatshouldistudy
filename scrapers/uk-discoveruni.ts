/**
 * United Kingdom: the Discover Uni dataset (Office for Students / HESA, CC BY
 * 4.0). Every undergraduate course at UK providers, with course title, award
 * (BSc, BA (Hons), MEng ...), study mode, course URL and its subject (CAH).
 *
 * The download link changes with each release, so it is read from the HESA
 * page; UK_DISCOVERUNI_URL overrides it.
 */
import { join } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, cleanTitle, csvObjects, fetchRetry, fieldsForCah, fieldsForTitle, isMain, log, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const PAGE = 'https://www.hesa.ac.uk/support/tools-and-downloads/unistats'

/** Award → level, from the aim label ("BSc (Hons)", "MEng", "Foundation Degree"). */
export function ukLevel(aim: string, title: string): { level: Level; years?: number } {
  const a = `${aim} ${title}`.toLowerCase()
  if (/mbchb|mbbs|\bbm\b|bm bs|\bbds\b|\bbvsc\b|\bbvetmed\b|\bbvms\b|\bbvm/.test(a)) return { level: 'professional', years: 5 }
  if (/\bmeng\b|\bmsci\b|\bmphys\b|\bmchem\b|\bmmath\b|\bmbiol\b|\bmarch\b|\bmpharm\b|\bmgeol\b|\bmcomp\b|\bmes\b|integrated master/.test(a)) return { level: 'integrated', years: 4 }
  if (/foundation degree|\bfd[a-z]*\b|\bhnd\b|\bhnc\b|dip ?he|cert ?he|foundation year/.test(a)) return { level: 'short', years: 2 }
  // Discover Uni only covers undergraduate entry. A Scottish "MA (Hons)" is a
  // four-year first degree, not a master's.
  if (/\bma\b/.test(aim.toLowerCase())) return { level: 'bachelor', years: 4 }
  return { level: 'bachelor', years: 3 }
}

export interface UkTables {
  courses: Array<Record<string, string>>
  institutions: Array<Record<string, string>>
  subjects: Array<Record<string, string>>
  aims: Array<Record<string, string>>
  locations: Array<Record<string, string>>
  courseLocations: Array<Record<string, string>>
}

export function parseTables(t: UkTables, fetchedAt: string): { programmes: Programme[]; unclassified: number } {
  const instName = new Map<string, string>()
  const instUrl = new Map<string, string>()
  for (const i of t.institutions) {
    const key = i.PUBUKPRN || i.UKPRN
    const name = i.FIRST_TRADING_NAME || i.LEGAL_NAME || i.PROVNAME || i.INSTNAME || ''
    if (key && name) instName.set(key, name)
    const url = i.PROVURL || i.INSTURL || ''
    if (key && url) instUrl.set(key, url)
  }
  const aimLabel = new Map<string, string>()
  for (const a of t.aims) aimLabel.set(a.KISAIMCODE, a.KISAIMLABEL || a.LABEL || '')
  const subjects = new Map<string, string[]>()
  for (const s of t.subjects) {
    const key = `${s.PUBUKPRN || s.UKPRN}|${s.KISCOURSEID}|${s.KISMODE}`
    const list = subjects.get(key) ?? []
    if (s.SBJ) list.push(s.SBJ)
    subjects.set(key, list)
  }
  const locName = new Map<string, string>()
  for (const l of t.locations) locName.set(`${l.UKPRN}|${l.LOCID}`, l.LOCNAME || l.LOCTOWN || '')
  const courseLoc = new Map<string, string>()
  for (const cl of t.courseLocations) {
    const key = `${cl.PUBUKPRN || cl.UKPRN}|${cl.KISCOURSEID}|${cl.KISMODE}`
    if (!courseLoc.has(key)) courseLoc.set(key, locName.get(`${cl.UKPRN}|${cl.LOCID}`) ?? '')
  }

  const programmes: Programme[] = []
  let unclassified = 0
  const seen = new Set<string>()
  for (const c of t.courses) {
    const prn = c.PUBUKPRN || c.UKPRN
    const title = cleanTitle(c.TITLE || c.TITLEW || '')
    if (!prn || !title) continue
    const key = `${prn}|${c.KISCOURSEID}|${c.KISMODE}`
    const aim = aimLabel.get(c.KISAIMCODE) ?? c.KISAIMLABEL ?? ''
    const level = ukLevel(aim, title)
    const cah = subjects.get(key) ?? []
    const candidates = [...new Set(cah.flatMap((code) => fieldsForCah(code)))]
    const { fields, confidence } = fieldsForTitle(title, candidates)
    const chosen = fields.length ? fields : candidates.slice(0, 1)
    if (!chosen.length) {
      unclassified++
      continue
    }
    const id = programmeId(['gb', prn, c.KISCOURSEID, c.KISMODE])
    if (seen.has(id)) continue
    seen.add(id)
    const mode = c.KISMODE === '1' ? 'full-time' : c.KISMODE === '2' ? 'part-time' : c.KISMODE === '3' ? 'both' : undefined
    programmes.push({
      id,
      name: aim ? `${aim} ${title}` : title,
      institution: instName.get(prn) ?? `UK provider ${prn}`,
      country: 'GB',
      city: courseLoc.get(key) || undefined,
      level: level.level,
      fields: chosen,
      fieldConfidence: fields.length ? confidence : 0.7,
      languages: c.WELSH === '1' ? ['en', 'cy'] : ['en'],
      tuition: {
        currency: 'GBP',
        domestic: 9535,
        estimated: true,
        note: 'Home fee cap (England, 2025/26). International fees are set by each university.',
      },
      durationYears: Number(c.NUMSTAGE) || level.years,
      mode: c.DISTANCE === '1' ? 'distance' : mode,
      url: c.CRSEURL || undefined,
      institutionUrl: instUrl.get(prn),
      source: 'uk-discover-uni',
      updated: fetchedAt,
    })
  }
  return { programmes, unclassified }
}

function findTable(files: Record<string, Uint8Array>, name: string): Array<Record<string, string>> {
  const entry = Object.entries(files).find(([k]) => k.toUpperCase().endsWith(`${name}.CSV`))
  return entry ? csvObjects(strFromU8(entry[1])) : []
}

async function main() {
  const fetchedAt = new Date().toISOString()
  let zipUrl = process.env.UK_DISCOVERUNI_URL
  if (!zipUrl) {
    const html = await (await fetchRetry(PAGE)).text()
    const links = [...html.matchAll(/href="([^"]+\.zip[^"]*)"/gi)].map((m) => new URL(m[1].replace(/&amp;/g, '&'), PAGE).toString())
    zipUrl = links.find((l) => /discover|unistats|kis/i.test(l)) ?? links[0]
    if (!zipUrl) throw new Error('No dataset link found on the HESA page')
  }
  log(`UK: downloading ${zipUrl}`)
  const buf = new Uint8Array(await (await fetchRetry(zipUrl)).arrayBuffer())
  const files = unzipSync(buf, { filter: (f) => /\.csv$/i.test(f.name) })
  log(`UK: ${Object.keys(files).length} CSV files: ${Object.keys(files).join(', ')}`)
  const tables: UkTables = {
    courses: findTable(files, 'KISCOURSE'),
    institutions: findTable(files, 'INSTITUTION'),
    subjects: findTable(files, 'SBJ'),
    aims: findTable(files, 'KISAIM'),
    locations: findTable(files, 'LOCATION'),
    courseLocations: findTable(files, 'COURSELOCATION'),
  }
  if (!tables.courses.length) throw new Error('KISCOURSE.csv missing or empty')
  log(`UK: KISCOURSE columns: ${Object.keys(tables.courses[0]).join(', ')}`)
  const { programmes, unclassified } = parseTables(tables, fetchedAt)
  log(`UK: ${programmes.length} programmes, ${unclassified} unclassified`)
  const out: ScrapeOutput = { source: 'uk-discover-uni', fetchedAt, programmes, notes: [`${unclassified} unclassified`, zipUrl] }
  writeJson(join(OUT, 'uk-discover-uni.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
