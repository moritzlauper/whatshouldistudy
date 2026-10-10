/**
 * United Kingdom: Discover Uni (Office for Students, data CC BY 4.0). Every
 * undergraduate course at all UK providers (around 460, England, Scotland,
 * Wales and Northern Ireland), with award, length, mode, campus and subjects.
 *
 * HESA's dataset download sits behind a Cloudflare challenge, so this reads the
 * public search API behind discoveruni.gov.uk's course finder instead: one
 * empty search lists every course id, details come in batches of 1,000.
 * The API host is read from the course finder page, so a new deployment is
 * picked up on its own.
 */
import { join } from 'node:path'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { CAH_BY_NAME } from './lib/cah.ts'
import { OUT, cleanTitle, fetchRetry, fieldsForCah, fieldsForTitle, isMain, log, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const FINDER = 'https://discoveruni.gov.uk/course-finder/results/'
const API_FALLBACK = 'https://search-api-v2-prod-hxhpghhdg3dqdhft.uksouth-01.azurewebsites.net'
const BATCH = 1000

/** Award → level, from the award ("BSc", "MEng", "FdA", "HND"). */
export function ukLevel(aim: string, title: string): { level: Level; years?: number } {
  const a = `${aim} ${title}`.toLowerCase()
  if (/mbchb|mbbs|\bbm\b|bm bs|\bbds\b|\bbvsc\b|\bbvetmed\b|\bbvms\b|\bbvm/.test(a)) return { level: 'professional', years: 5 }
  if (/\bmeng\b|\bmsci\b|\bmphys\b|\bmchem\b|\bmmath\b|\bmbiol\b|\bmarch\b|\bmpharm\b|\bmgeol\b|\bmcomp\b|\bmes\b|integrated master/.test(a)) return { level: 'integrated', years: 4 }
  // Only the award decides this: "BSc Biology with Foundation Year" is a bachelor.
  if (/foundation degree|\bfd[a-z]*\b|\bhnd\b|\bhnc\b|dip ?he|cert ?he/.test(aim.toLowerCase())) return { level: 'short', years: 2 }
  // Discover Uni only covers undergraduate entry. A Scottish "MA (Hons)" is a
  // four-year first degree, not a master's.
  if (/\bma\b/.test(aim.toLowerCase())) return { level: 'bachelor', years: 4 }
  return { level: 'bachelor', years: 3 }
}

/** "Glasgow Campus" → "Glasgow"; "Main Campus", "Campus A" or the provider's own name say nothing. */
export function campusName(location: string, institution: string): string | undefined {
  const s = location.replace(/\s+campus$/i, '').trim()
  if (!s || s === institution || /main (campus|site)/i.test(location) || /^(main|city|campus( \w)?|\w)$/i.test(s)) return undefined
  return s
}

const SMALL = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'on'])

/**
 * About 80 providers come in capitals ("THE UNIVERSITY OF MANCHESTER",
 * "SHEFFIELD COLLEGE, THE"). Their legal names are often a different entity,
 * so the shown name is title-cased instead. Short acronyms (UCL, UA92) stay.
 */
export function providerName(name: string): string {
  const s = name.trim()
  if (/[a-z]/.test(s) || !/\s/.test(s)) return s
  return s
    .replace(/,\s*THE$|\s*\(THE\)$/, '')
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/(^|[-(])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())))
    .join(' ')
}

/** A course as /api/v2/search/courses/ returns it. */
export interface UkCourse {
  courseId: string
  name: string
  institutionId: number
  institution: string
  subjects?: Array<{ en: string }>
  length?: string
  mode?: { en: string }
  distanceLearning?: { en: string }
  location?: string[]
}

export function parseCourses(courses: UkCourse[], fetchedAt: string, sites = new Map<string, string>()): { programmes: Programme[]; unclassified: number; unknownSubjects: string[] } {
  const programmes: Programme[] = []
  const unknown = new Set<string>()
  let unclassified = 0
  const seen = new Set<string>()
  for (const c of courses) {
    const name = cleanTitle(c.name ?? '')
    const [prn, kisId, modeLabel] = c.courseId.split('/')
    if (!prn || !kisId || !name) continue
    // The name starts with the award: "BSc Geology", "MA(SocSci) Politics".
    const space = name.indexOf(' ')
    const aim = space > 0 ? name.slice(0, space) : ''
    const title = space > 0 ? name.slice(space + 1) : name
    const level = ukLevel(aim, title)
    const cah = (c.subjects ?? []).flatMap((s) => {
      const code = CAH_BY_NAME[s.en.replace(/’/g, "'")]
      if (!code) unknown.add(s.en)
      return code ? [code] : []
    })
    const candidates = [...new Set(cah.flatMap((code) => fieldsForCah(code)))]
    const { fields, confidence } = fieldsForTitle(title, candidates)
    const chosen = fields.length ? fields : candidates.slice(0, 1)
    if (!chosen.length) {
      unclassified++
      continue
    }
    // Same id as the HESA dataset gave (KISMODE 1 full-time, 2 part-time).
    const kisMode = modeLabel === 'Part-time' ? '2' : '1'
    const id = programmeId(['gb', prn, kisId, kisMode])
    if (seen.has(id)) continue
    seen.add(id)
    const years = Number(/(\d+)-year/.exec(c.length ?? '')?.[1])
    const campus = c.location?.map((l) => campusName(l, c.institution)).find(Boolean)
    programmes.push({
      id,
      name,
      institution: providerName(c.institution),
      country: 'GB',
      city: campus,
      level: level.level,
      fields: chosen,
      fieldConfidence: fields.length ? confidence : 0.7,
      languages: ['en'],
      tuition: {
        currency: 'GBP',
        domestic: 9535,
        estimated: true,
        note: 'Home fee cap (England, 2025/26). International fees are set by each university.',
      },
      durationYears: years || level.years,
      // Joint and combined honours: each subject the course is made of.
      focus: (c.subjects?.length ?? 0) > 1 ? c.subjects!.map((x) => x.en) : undefined,
      mode: /only available through distance/i.test(c.distanceLearning?.en ?? '') ? 'distance' : modeLabel === 'Part-time' ? 'part-time' : 'full-time',
      url: `https://discoveruni.gov.uk/course-details/${c.courseId.split('/').map(encodeURIComponent).join('/')}/`,
      institutionUrl: sites.get(prn),
      source: 'uk-discover-uni',
      updated: fetchedAt,
    })
  }
  return { programmes, unclassified, unknownSubjects: [...unknown] }
}

/**
 * The API has no websites; each provider's page on discoveruni.gov.uk links it
 * ("View uni website"). One page after the other, about 460 in all.
 */
async function websites(prns: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const prn of prns) {
    try {
      const html = await (await fetchRetry(`https://discoveruni.gov.uk/institution-details/${prn}/`, {}, 2)).text()
      const m = /href="(https?:\/\/[^"]+)"[^>]*>\s*View uni website/i.exec(html)
      if (m) out.set(prn, m[1])
    } catch (e) {
      log(`UK: provider page ${prn} not readable (${(e as Error).message.slice(0, 60)})`)
    }
  }
  return out
}

async function apiHost(): Promise<string> {
  try {
    const html = await (await fetchRetry(FINDER, {}, 2)).text()
    const m = /API_V2_SEARCH\s*=\s*["']([^"']+)["']/.exec(html)
    if (m) return m[1].replace(/\/$/, '')
    log('UK: API_V2_SEARCH not on the course finder page, using the known host')
  } catch (e) {
    log(`UK: course finder not readable (${(e as Error).message.slice(0, 80)}), using the known host`)
  }
  return API_FALLBACK
}

const post = async <T,>(url: string, body: unknown): Promise<T> =>
  (await fetchRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json() as Promise<T>

async function main() {
  const fetchedAt = new Date().toISOString()
  const host = await apiHost()
  const providers = (await (await fetchRetry(`${host}/api/v2/institutions`)).json()) as unknown[]
  log(`UK: ${providers.length} providers listed`)
  // The finder's own query with every filter off: all courses of all providers.
  const hits = await post<Array<{ courseId: string; institution: string }>>(`${host}/api/v2/search/`, {
    query: '',
    selectedInstitutions: [],
    modeFullTime: false,
    modePartTime: false,
    locOnCampus: false,
    locDistanceLearning: false,
    regionScotland: false,
    regionWales: false,
    regionNorthernIreland: false,
    regionEngland: false,
    postcodeQuery: null,
    cityQuery: null,
  })
  const ids = [...new Set(hits.map((h) => h.courseId))]
  log(`UK: ${ids.length} courses at ${new Set(hits.map((h) => h.institution)).size} providers`)
  if (!ids.length) throw new Error('Discover Uni search returned no courses')
  const courses: UkCourse[] = []
  for (let i = 0; i < ids.length; i += BATCH) {
    courses.push(...(await post<UkCourse[]>(`${host}/api/v2/search/courses/`, { courseIds: ids.slice(i, i + BATCH) })))
    if ((i / BATCH) % 10 === 0) log(`UK: details ${courses.length}/${ids.length}`)
  }
  const sites = await websites([...new Set(ids.map((id) => id.split('/')[0]))])
  log(`UK: websites for ${sites.size} providers`)
  const { programmes, unclassified, unknownSubjects } = parseCourses(courses, fetchedAt, sites)
  if (unknownSubjects.length) log(`UK: subjects without CAH code: ${unknownSubjects.join(', ')}`)
  log(`UK: ${programmes.length} programmes at ${new Set(programmes.map((p) => p.institution)).size} providers, ${unclassified} unclassified`)
  const out: ScrapeOutput = { source: 'uk-discover-uni', fetchedAt, programmes, notes: [`${unclassified} unclassified`, host] }
  writeJson(join(OUT, 'uk-discover-uni.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
