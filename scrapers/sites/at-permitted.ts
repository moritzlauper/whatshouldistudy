/**
 * Austrian universities that agreed in writing that we may take over the
 * programmes («Studien») from their own websites. Their programme pages add
 * what the open national dataset lacks: teaching language, ECTS, duration,
 * degree and study mode, and the facts run (programme-facts.ts) may read
 * those pages for «what makes the programme distinctive», as in Switzerland.
 *
 * Only universities listed here are read. Add one only with a written
 * agreement; the replies are kept in the private outreach repository.
 * Same rules as scrapers/ch-hochschulen.ts: facts only, no texts, robots.txt
 * respected, one request every 1.5 seconds (scrapers/lib/site-fetch.ts).
 */
import type { Level } from '../../lib/programmes.ts'
import { absolute, decode, durationIn, languagesIn, text } from '../ch-hochschulen.ts'

export interface AtPermission {
  /** Key in lib/at-institutions.ts. */
  key: string
  /** Name as in lib/at-institutions.ts. */
  institution: string
  /** Date of the written agreement. */
  granted: string
  lists: Array<{ url: string; level?: Level }>
}

export const AT_PERMITTED: AtPermission[] = [
  // Susanne Hametner, Universitätskommunikation, 5.11.2026: «unsere Studien von der Website … zu übernehmen».
  { key: 'jku', institution: 'Johannes Kepler Universität Linz', granted: '2026-11-05', lists: [{ url: 'https://www.jku.at/studium/studienarten/' }] },
  // Linde Tuscher, 5.11.2026: «gerne von der Website der Universität Graz Informationen übernehmen».
  {
    key: 'unigraz',
    institution: 'Universität Graz',
    granted: '2026-11-05',
    lists: [
      { url: 'https://www.uni-graz.at/de/studium/bachelorstudien/', level: 'bachelor' },
      { url: 'https://www.uni-graz.at/de/studium/masterstudien/', level: 'master' },
      { url: 'https://www.uni-graz.at/de/studium/diplomstudien/', level: 'professional' },
    ],
  },
]


export interface SiteListed {
  name: string
  level: Level
  url: string
}

export interface SiteFacts {
  degreeTitle?: string
  ects?: number
  durationYears?: number
  languages?: string[]
  otherLanguages?: string[]
  cities?: string[]
  mode?: 'full-time' | 'part-time' | 'both'
}

export interface SiteProgramme extends SiteListed, SiteFacts {
  institution: string
}

const JKU_LEVELS: Record<string, Level> = { Bachelor: 'bachelor', Master: 'master', Diplom: 'professional' }

/** JKU: the study finder carries every programme as JSON (`studyFinder = {…}`). */
export function jkuList(html: string, base: string): SiteListed[] {
  const at = html.indexOf('studyFinder = {')
  if (at < 0) return []
  let finder: { courses?: Record<string, { title: string }>; studies?: Array<{ title: string; link: string; course: string }> }
  try {
    finder = JSON.parse(extractObject(html, at + 'studyFinder = '.length)) as typeof finder
  } catch {
    return []
  }
  const out: SiteListed[] = []
  for (const s of finder.studies ?? []) {
    const level = JKU_LEVELS[finder.courses?.[s.course]?.title ?? '']
    // Doctorates, courses and extension studies are not degree programmes here; some link off the study pages.
    if (!level || !/^\/studium\/studienarten\/(bachelordiplom|master)\/[^/#]+\/$/.test(s.link)) continue
    out.push({ name: decode(s.title).trim(), level, url: absolute(s.link, base) })
  }
  return out
}

/** The balanced `{…}` starting at `from`, without parsing the page's script. */
function extractObject(s: string, from: number): string {
  let depth = 0
  let quote = ''
  for (let i = from; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return s.slice(from, i + 1)
  }
  throw new Error('unbalanced')
}

/** Uni Graz: the list page has a plain list of links next to the filter app. */
export function grazList(html: string, base: string, level: Level): SiteListed[] {
  const out: SiteListed[] = []
  const seen = new Set<string>()
  // The page also links other kinds of studies; only those under the list's own path count.
  const path = new URL(base).pathname.replace(/\/?$/, '/')
  for (const m of html.matchAll(/<a class="nav-link" href="([^"#?]+)">([\s\S]*?)<\/a>/g)) {
    if (!m[1].startsWith(path) || m[1].length <= path.length) continue
    const name = /<span class="title">([\s\S]*?)<\/span>/.exec(m[2])
    const url = absolute(m[1], base)
    if (!name || seen.has(url)) continue
    seen.add(url)
    out.push({ name: text(name[1]), level, url })
  }
  return out
}

/** Label → value pairs of a programme page: JKU «Key Facts», Graz info boxes. */
export function factPairs(html: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  // JKU: <p><strong>ECTS</strong></p> <p>120 Punkte</p>
  for (const m of html.matchAll(/<div class="info_element">\s*<p><strong>([\s\S]*?)<\/strong><\/p>\s*<p>([\s\S]*?)<\/p>/g)) pairs.push([text(m[1]), text(m[2].replace(/<br\s*\/?>/g, ' · '))])
  // Graz: <div class="info-item"> <h3>ECTS</h3> <p>120</p>
  for (const m of html.matchAll(/<div class="info-item">\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)) pairs.push([text(m[1]), text(m[2])])
  return pairs
}

export function siteFacts(html: string): SiteFacts {
  const facts: SiteFacts = {}
  const cities: string[] = []
  for (const [label, value] of factPairs(html)) {
    if (/^(abschluss|akademischer grad)$/i.test(label)) facts.degreeTitle ??= value.replace(/[„“”"·]/g, '').replace(/\s+/g, ' ').trim()
    else if (/^ects$/i.test(label)) {
      const n = Number(/\d+/.exec(value)?.[0])
      if (n >= 30 && n <= 400) facts.ects ??= n
    } else if (/^studiendauer$/i.test(label)) facts.durationYears ??= durationIn(value)
    else if (/^(unterrichts)?sprache$/i.test(label)) {
      // «Deutsch (Level B2) · · (Einige Lehrveranstaltungen werden auf Englisch angeboten)»
      const [main, ...rest] = value.split(/\(einige|\(some|·\s*·/i)
      facts.languages ??= languagesIn(main.replace(/\(level [^)]*\)/gi, ''))
      const other = languagesIn(rest.join(' '))?.filter((l) => !facts.languages?.includes(l))
      if (other?.length) facts.otherLanguages = other
    } else if (/^studienort\b/i.test(label)) {
      const city = label.replace(/^studienort\s*/i, '').trim() || value.split('·')[0].trim()
      for (const c of city.split(/\s+und\s+|\s*,\s*/)) if (c && c.length < 40) cities.push(c)
    } else if (/^(studienform|typ)$/i.test(label)) {
      const full = /vollzeit|full/i.test(value)
      const part = /berufsbegleitend|teilzeit|part/i.test(value)
      facts.mode ??= full && part ? 'both' : part ? 'part-time' : full ? 'full-time' : undefined
    }
  }
  if (cities.length) facts.cities = cities
  return facts
}

type Reader = (url: string, timeout?: number) => Promise<{ status: number; text: string }>

/** Every programme of the universities in AT_PERMITTED, with the facts from its page. */
export async function readPermitted(read: Reader, log: (s: string) => void = () => {}): Promise<SiteProgramme[]> {
  const out: SiteProgramme[] = []
  for (const site of AT_PERMITTED) {
    const listed: SiteListed[] = []
    for (const list of site.lists) {
      const res = await read(list.url)
      if (res.status !== 200) {
        log(`AT ${site.key}: list ${list.url} HTTP ${res.status}`)
        continue
      }
      listed.push(...(site.key === 'jku' ? jkuList(res.text, list.url) : grazList(res.text, list.url, list.level!)))
    }
    let withFacts = 0
    for (const l of listed) {
      const res = await read(l.url)
      const facts = res.status === 200 ? siteFacts(res.text) : {}
      if (facts.ects || facts.languages) withFacts++
      out.push({ ...l, ...facts, institution: site.institution })
    }
    log(`AT ${site.key}: ${listed.length} programmes on the website, ${withFacts} with facts`)
  }
  return out
}
