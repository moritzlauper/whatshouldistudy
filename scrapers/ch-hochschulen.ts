/**
 * Switzerland: the degree programmes as the universities list them on their
 * own websites, one programme per entry instead of the BFS's one row per
 * field of study and institution. Only facts are taken: the programme's
 * name, level, teaching language, credits, duration and the names of its
 * specialisations, with the link to the programme's page. No descriptions or
 * other texts. Pages are read at most once a week, one request every 1.5
 * seconds, as robots.txt allows.
 *
 * Each university builds its pages differently, so each has its own reader.
 * Where a programme is found here, it replaces the BFS row for the same
 * institution, level and field (dedupeSwiss in build.ts).
 */
import { join } from 'node:path'
import { CH_ADMISSION, findChInstitution } from '../lib/ch-institutions.ts'
import type { ChInstitution } from '../lib/ch-institutions.ts'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, cleanTitle, fieldsForTitle, isMain, log, sleep, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const UA = 'Mozilla/5.0 (compatible; wasstudieren-bot/1.0; +https://wasstudieren.ch)'
const PAUSE = 1500

/** A programme as a list page names it, before its own page is read. */
export interface Listed {
  name: string
  level: Level
  url: string
  languages?: string[]
  /** Specialisations, majors or profiles, by name. */
  focus?: string[]
  ects?: number
  durationYears?: number
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&#8217;/g, '’')
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&auml;/g, 'ä')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&shy;|­/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))

/** Text of an HTML fragment. */
export const text = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

const absolute = (href: string, base: string) => new URL(decode(href), base).href

const LANG: Record<string, string> = { deutsch: 'de', german: 'de', englisch: 'en', english: 'en', anglais: 'en', französisch: 'fr', french: 'fr', français: 'fr', francais: 'fr', italienisch: 'it', italian: 'it', italiano: 'it' }

/** «Deutsch & Englisch», «deutsch, englisch», «English» → ['de', 'en']. */
export function languagesIn(s: string): string[] | undefined {
  const found = [...new Set(s.toLowerCase().split(/[^a-zäöüçéè]+/).map((w) => LANG[w]).filter(Boolean))]
  return found.length ? found : undefined
}

/** «A, B oder C» → ['A', 'B', 'C']. */
export function nameList(s: string): string[] {
  // «A, B und C»: «und» separates only the last item, «Banking and Finance» stays whole.
  const parts = s.split(/\s*,\s*/)
  if (parts.length >= 2 && !/\bsowie\b/.test(s)) parts.push(...parts.pop()!.split(/\s+(?:und|and|et)\s+/))
  return parts
    .join(';')
    .split(/\s*(?:,|;|\boder\b|\bsowie\b|\bor\b|\bou\b)\s*/)
    .map((x) => cleanTitle(x.replace(/^(?:die|der|das|the|la|le)\s+/i, '')))
    // Names of specialisations are short; navigation or sentences that slipped in are not.
    .filter((x) => x.length > 2 && x.length < 60 && x.split(/\s+/).length <= 6 && !/anmeldung|zulassung|kosten|infoveranstaltung|instagram|blog|studium/i.test(x))
}

// ETH Zürich: the bachelor list links every programme; the facts are the same for all.
export function ethBachelors(html: string, base: string): Listed[] {
  const out: Listed[] = []
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]*\/studium\/bachelor\/studienangebot\/[^"/]+\/[^"/]+\.html)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const name = text(m[2]).replace(/^Bachelor\s+/i, '')
    if (!name || /vergleich|quickcheck/i.test(name + m[1])) continue
    out.push({ name: `Bachelor ${name}`, level: 'bachelor', url: absolute(m[1], base), ects: 180, durationYears: 3, languages: ['de'] })
  }
  return dedupe(out)
}

// EPFL: bachelor and master lists; a master's page names its specialisations and teaching language.
export function epflList(html: string, base: string, level: Level): Listed[] {
  const path = level === 'bachelor' ? 'bachelor' : 'master'
  const out: Listed[] = []
  for (const m of html.matchAll(new RegExp(`<a\\b[^>]*href="(https://www\\.epfl\\.ch/education/${path}/programs/[a-z-]+/)"[^>]*>([\\s\\S]*?)</a>`, 'g'))) {
    const name = text(m[2])
    if (!name || name.length > 80) continue
    out.push({
      name: `${level === 'bachelor' ? 'Bachelor' : 'Master'} ${name}`,
      level,
      url: m[1],
      ects: level === 'bachelor' ? 180 : 120,
      durationYears: level === 'bachelor' ? 3 : 2,
      // Bachelor teaching at EPFL is in French, with English from the third year.
      languages: level === 'bachelor' ? ['fr', 'en'] : undefined,
    })
  }
  return dedupe(out)
}

export function epflDetail(html: string): Partial<Listed> {
  const out: Partial<Listed> = {}
  const spec = /specializations? in the following areas:?\s*<\/p>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(html)
  if (spec) out.focus = [...spec[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1])).filter((x) => x && x.length < 80)
  const lang = /<h3[^>]*>\s*Teaching language\s*<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i.exec(html)
  if (lang) out.languages = languagesIn(text(lang[1]).split('.')[0])
  return out
}

// UZH: the lists give type (Mono, Major, Minor), area and language; a minor alone is no degree.
export function uzhList(html: string, base: string, level: Level): Listed[] {
  const out: Listed[] = []
  for (const m of html.matchAll(/<article class="SubpageList--entry">([\s\S]*?)<\/article>/g)) {
    const a = /<a class="Link" href="([^"]+)">([\s\S]*?)<\/a>/.exec(m[1])
    const info = /SubpageList--entry--text">([\s\S]*?)<\/div>/.exec(m[1])
    if (!a || !info) continue
    const details = text(info[1])
    const type = /Typ:\s*([^/]+)/.exec(details)?.[1] ?? ''
    if (!/mono|major/i.test(type)) continue
    const lang = /Sprache:\s*([^/]+)/.exec(details)?.[1] ?? ''
    out.push({
      name: titled(level, text(a[2])),
      level,
      url: absolute(a[1], base),
      languages: languagesIn(lang),
      // Master credits differ by programme (90 or 120), so only the bachelor's are given.
      durationYears: level === 'bachelor' ? 3 : undefined,
      ects: level === 'bachelor' ? 180 : undefined,
    })
  }
  return dedupe(out)
}

// ZHAW: programme cards with an h3 title and a link; a programme's page names its specialisations in the text.
export function zhawList(html: string, base: string, level: Level): Listed[] {
  const out: Listed[] = []
  const kind = level === 'bachelor' ? 'bachelor' : 'master'
  for (const m of html.matchAll(/<a\b[^>]*href="(\/de\/[a-z-]+\/studium\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const href = m[1]
    if (!new RegExp(kind, 'i').test(href) || /anmeldung|aufnahme|infoveranstaltung|kosten|profil$|internationales-profil|entrepreneurial/i.test(href)) continue
    const h3 = /<h3[^>]*>([\s\S]*?)<\/h3>/.exec(m[2])
    const name = text(h3 ? h3[1] : m[2]).replace(/^Detailinformationen zu(?:m| den)\s+/i, '').replace(/^(Bachelor|Master)(?:studiengang|studiengängen|studium)(?:\s+in)?\s+/i, '$1 ')
    if (!name || name.length > 90 || /^(mehr|weiter|zum|zur|details)/i.test(name)) continue
    out.push({ name: titled(level, name), level, url: absolute(href, base).replace(/\/$/, ''), durationYears: level === 'bachelor' ? 3 : undefined, ects: level === 'bachelor' ? 180 : undefined })
  }
  // A profile of a programme («…/master-language-and-communication/master-profil-…») is one of its specialisations.
  const all = dedupe(out)
  const programmes = all.filter((x) => !all.some((p) => p !== x && x.url.startsWith(`${p.url}/`)))
  for (const p of programmes) {
    const profiles = all.filter((x) => x.url.startsWith(`${p.url}/`)).map((x) => x.name.replace(/^(Bachelor|Master)\s+(?:of Science in\s+)?/, ''))
    if (profiles.length) p.focus = profiles
  }
  return programmes
}

export function zhawDetail(html: string): Partial<Listed> {
  const body = text(html)
  const lists = [
    /Vertiefungen?\s*\(([^)]{5,200})\)/i.exec(body)?.[1],
    /mit (?:einer )?Vertiefung in ([^:.]{5,200}?)(?:\s+können|:|\.)/i.exec(body)?.[1],
  ].filter(Boolean) as string[]
  const focus = lists.length ? nameList(lists[0]) : undefined
  const out: Partial<Listed> = {}
  if (focus && focus.length >= 2 && focus.length <= 12) out.focus = focus
  if (/Unterrichtssprache ist Englisch|unterrichtet auf Englisch|in englischer Sprache/i.test(body)) out.languages = ['en']
  return out
}

// Basel: the list links each programme; its page has «Eckdaten» with start, duration, credits and language.
export function unibasList(html: string, base: string, level: Level): Listed[] {
  const out: Listed[] = []
  for (const m of html.matchAll(/<a class="newsbox_listing_link[^"]*" href="([^"]+)">([\s\S]*?)<\/a>/g)) {
    const spans = [...m[2].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map((s) => text(s[1]))
    const name = spans[0]
    // A second subject of a combined degree is not a programme of its own.
    if (!name || /ausserfakultär|\(Studienfach\)/i.test(name)) continue
    out.push({ name: titled(level, name.replace(/\s*\(Studiengang\)/, '')), level, url: absolute(m[1].replace(/&amp;/g, '&').replace(/&(?:degree|view)=[^&]*/g, ''), base) })
  }
  return dedupe(out)
}

export function unibasDetail(html: string): Partial<Listed> {
  const facts = new Map([...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1]), text(m[2])]))
  const out: Partial<Listed> = {}
  const credits = Number(facts.get('Credits'))
  if (credits) out.ects = credits
  const semesters = Number(/(\d+)\s*Semester/.exec(facts.get('Regelstudienzeit') ?? '')?.[1])
  if (semesters) out.durationYears = semesters / 2
  const lang = languagesIn(facts.get('Sprache') ?? '')
  if (lang) out.languages = lang
  return out
}

/** «Bachelor X», without doubling a level the name already starts with. */
const titled = (level: Level, name: string) => (/^(bachelor|master)\b/i.test(name) ? name : `${level === 'bachelor' ? 'Bachelor' : 'Master'} ${name}`)

function dedupe(xs: Listed[]): Listed[] {
  const seen = new Set<string>()
  return xs.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)))
}

interface Source {
  institution: string
  lists: Array<{ url: string; level: Level; read: (html: string, base: string, level: Level) => Listed[] }>
  detail?: (html: string) => Partial<Listed>
  /** Only these levels get their own page read. */
  detailLevels?: Level[]
}

const SOURCES: Source[] = [
  { institution: 'ETH Zürich', lists: [{ url: 'https://ethz.ch/de/studium/bachelor/studienangebot.html', level: 'bachelor', read: ethBachelors }] },
  {
    institution: 'EPFL',
    lists: [
      { url: 'https://www.epfl.ch/education/bachelor/programs/', level: 'bachelor', read: epflList },
      { url: 'https://www.epfl.ch/education/master/programs/', level: 'master', read: epflList },
    ],
    detail: epflDetail,
    detailLevels: ['master'],
  },
  {
    institution: 'Universität Zürich',
    lists: [
      { url: 'https://www.uzh.ch/de/studies/programs/bachelor.html', level: 'bachelor', read: uzhList },
      { url: 'https://www.uzh.ch/de/studies/programs/master.html', level: 'master', read: uzhList },
    ],
  },
  {
    institution: 'ZHAW',
    lists: [
      { url: 'https://www.zhaw.ch/de/studium/bachelorstudiengaenge', level: 'bachelor', read: zhawList },
      { url: 'https://www.zhaw.ch/de/studium/masterstudiengaenge', level: 'master', read: zhawList },
    ],
    detail: zhawDetail,
  },
  {
    institution: 'Universität Basel',
    lists: [
      { url: 'https://www.unibas.ch/de/Studium/Vor-dem-Studium/Studienangebot.html?degree=bachelor&view=list', level: 'bachelor', read: unibasList },
      { url: 'https://www.unibas.ch/de/Studium/Vor-dem-Studium/Studienangebot.html?degree=master&view=list', level: 'master', read: unibasList },
    ],
    detail: unibasDetail,
  },
]

/**
 * Swiss programme names the general classifier misses (it is tuned to video
 * and search titles, where single words like «Englisch» mean little).
 */
const CH_TITLES: Array<[RegExp, string[]]> = [
  [/philologie|anglistik|englisch|english|germanistik|deutsche philologie|französistik|romanistik|hispanistik|italianistik|iberoromanistik|slavistik|skandinavistik|nordistik|latein|griechisch/i, ['languages', 'literature']],
  [/indologie|sinologie|japanologie|islamwissenschaft|nahost|mitteloststudien|osteuropastudien|african studies|ägyptologie|aegyptologie|osteuropa|asien-orient|jüdische studien/i, ['languages', 'history']],
  [/altertumswissenschaft|alte geschichte|klassische archäologie/i, ['history', 'archaeology']],
  [/populäre kulturen|kulturanthropologie|europäische ethnologie|sozialanthropologie|kulturwissenschaft/i, ['anthropology']],
  [/european studies|europastudien|politikwissenschaft|staatswissenschaften/i, ['political-science']],
  [/maschineningenieur|maschinentechnik|mechanical/i, ['mechanical-engineering']],
  [/mikrotechnik|microengineering|mikrosystem/i, ['robotics-mechatronics', 'electrical-engineering']],
  [/rechnergestützte wissenschaften|computational science|computational sciences|scientific computing/i, ['computer-science', 'mathematics']],
  [/softwaresystem|software system|software engineering/i, ['computer-science']],
  [/erd- und klima|erdsystem|geowissenschaft|klimawissenschaft/i, ['earth-sciences', 'environmental-science']],
  [/umweltnaturwissenschaft|umwelt und natürliche ressourcen/i, ['environmental-science']],
  [/energy science|energie|integrierte bau- und energiesysteme/i, ['energy-engineering']],
  [/aviatik|aviation/i, ['aviation']],
  [/mobility science|mobilität/i, ['logistics', 'urban-planning']],
  [/labordiagnostik/i, ['biomedical-engineering', 'molecular-biology']],
  [/wirtschaftschemie/i, ['chemistry', 'business-management']],
  [/nanowissenschaft|nanoscience/i, ['physics', 'materials-science']],
  [/sprachliche integration|mehrsprachig/i, ['linguistics', 'languages']],
  [/unternehmensentwicklung/i, ['business-management']],
  [/gräzistik|latinistik|studi italiani|osteuropäische kulturen/i, ['languages', 'literature']],
  [/mediävistik|kulturanalyse|kulturtechniken/i, ['history', 'literature']],
  [/muslimische kulturen|interreligious|religionswissenschaft/i, ['religious-studies']],
  [/earth system/i, ['earth-sciences', 'environmental-science']],
  [/human-centered computing/i, ['ux-design', 'computer-science']],
  [/neural systems/i, ['neuroscience']],
  [/actuarial/i, ['finance-accounting', 'statistics-data-science']],
  [/changing societies/i, ['sociology']],
  [/urbanism/i, ['urban-planning']],
  [/drug sciences/i, ['pharmacy']],
  [/plant science/i, ['biology', 'agriculture']],
  [/sustainable development/i, ['environmental-science']],
  [/educational sciences|fachdidaktik|erziehungswissenschaft/i, ['education']],
  [/european global studies|comparative and international studies|international relations/i, ['political-science']],
]

/** A listed programme as a catalogue entry; null where it fits no field. */
export function toProgramme(x: Listed, inst: ChInstitution, fetchedAt: string): Programme | null {
  const title = x.name.replace(/^(Bachelor|Master)\s+/, '')
  const known = CH_TITLES.find(([re]) => re.test(title))
  const { fields, confidence } = known ? { fields: known[1], confidence: 0.85 } : fieldsForTitle(`${title} ${(x.focus ?? []).join(' ')}`)
  if (!fields.length) return null
  return {
    id: programmeId(['ch', inst.id, x.url]),
    name: cleanTitle(x.name),
    institution: inst.name,
    country: 'CH',
    city: inst.city,
    region: inst.canton,
    level: x.level,
    fields: fields.slice(0, 3),
    fieldConfidence: Math.round(confidence * 100) / 100,
    languages: x.languages ?? inst.languages,
    durationYears: x.durationYears,
    ects: x.ects,
    focus: x.focus?.length ? x.focus : undefined,
    mode: 'full-time',
    url: x.url,
    institutionUrl: inst.url,
    institutionType: inst.type,
    public: true,
    admission: x.level === 'bachelor' ? CH_ADMISSION[inst.type].de : undefined,
    tuition: inst.feeCh
      ? { currency: 'CHF', domestic: inst.feeCh * 2, eu: (inst.feeForeign ?? inst.feeCh) * 2, international: (inst.feeForeign ?? inst.feeCh) * 2, estimated: true, note: 'Semestergebühren × 2, Stand 2025/26' }
      : undefined,
    source: 'ch-hochschulen',
    updated: fetchedAt,
  }
}

async function page(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de-CH,de;q=0.9,en;q=0.5' }, signal: AbortSignal.timeout(30_000) })
    if (!res.ok) {
      log(`  HTTP ${res.status} ${url}`)
      return null
    }
    return await res.text()
  } catch (e) {
    log(`  ${(e as Error).message} ${url}`)
    return null
  } finally {
    await sleep(PAUSE)
  }
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const programmes: Programme[] = []
  for (const src of SOURCES) {
    const inst = findChInstitution(src.institution)
    if (!inst) throw new Error(`unknown institution ${src.institution}`)
    const listed: Listed[] = []
    for (const l of src.lists) {
      const html = await page(l.url)
      const found = html ? l.read(html, l.url, l.level) : []
      log(`${inst.name}: ${found.length} ${l.level} programmes listed`)
      listed.push(...found)
    }
    if (src.detail) {
      const read = src.detail
      for (const [i, x] of listed.entries()) {
        if (src.detailLevels && !src.detailLevels.includes(x.level)) continue
        const html = await page(x.url)
        // What the list already knows (e.g. profiles) wins over what a page's text yields.
        if (html) listed[i] = { ...Object.fromEntries(Object.entries(read(html)).filter(([, v]) => v !== undefined)), ...Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) } as Listed
      }
    }
    let unclassified = 0
    for (const x of listed) {
      const p = toProgramme(x, inst, fetchedAt)
      if (p) programmes.push(p)
      else unclassified++
    }
    log(`${inst.name}: ${listed.filter((x) => x.focus?.length).length} with specialisations, ${unclassified} without a field`)
  }
  log(`Swiss universities: ${programmes.length} programmes`)
  if (programmes.length < 150) throw new Error(`only ${programmes.length} programmes, a site may have changed`)
  const out: ScrapeOutput = { source: 'ch-hochschulen', fetchedAt, programmes }
  writeJson(join(OUT, 'ch-hochschulen.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
