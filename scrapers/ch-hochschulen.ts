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
  /** The name is only a stand-in from the link; the programme's page has the real one. */
  provisional?: boolean
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
export const text = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).normalize('NFC').replace(/\s+/g, ' ').trim()

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

// ETH Zürich, master: the list is built in the browser from the site's navigation tree, which is public JSON.
export function ethMasters(json: string, base: string): Listed[] {
  interface Node { title?: string; path?: string; hidden?: boolean; children?: Node[] }
  const find = (n: Node): Node | undefined => (n.path === '/de/studium/master/studienangebot.html' ? n : n.children?.map(find).find(Boolean))
  const list = find(JSON.parse(json) as Node)
  const out: Listed[] = []
  for (const area of list?.children ?? []) {
    for (const p of area.children ?? []) {
      if (p.hidden || !p.title || !p.path) continue
      out.push({ name: `Master ${text(p.title)}`, level: 'master', url: absolute(p.path, base) })
    }
  }
  const names = new Set<string>()
  return dedupe(out).filter((x) => (names.has(x.name) ? false : (names.add(x.name), true)))
}

/** The sections of a page as heading → HTML up to the next heading of the same kind. */
function sections(html: string, tag: string): Map<string, string> {
  const parts = html.split(new RegExp(`<${tag}[^>]*>`, 'i')).slice(1)
  return new Map(parts.map((p) => {
    const end = p.search(new RegExp(`</${tag}>`, 'i'))
    return [text(p.slice(0, end)), p.slice(end)]
  }))
}

const listItems = (html: string) => [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1])).filter((x) => x && x.length < 80)

export function ethDetail(html: string): Partial<Listed> {
  const s = sections(html, 'h2')
  const out: Partial<Listed> = {}
  const focus = s.get('Vertiefungen') ?? s.get('Schwerpunkte') ?? s.get('Majors') ?? s.get('Vertiefungsrichtungen')
  if (focus) {
    const items = listItems(focus.split(/<h[1-3][\s>]/)[0])
    if (items.length >= 2 && items.length <= 15) out.focus = items
  }
  const lang = s.get('Unterrichtssprache')
  if (lang) out.languages = languagesIn(text(lang.split(/<h[1-3][\s>]/)[0]))
  const size = [...s].find(([k]) => /^Umfang/.test(k))?.[1]
  if (size) {
    const t = text(size.split(/<h[1-3][\s>]/)[0])
    const ects = Number(/(\d+)\s*ECTS/.exec(t)?.[1])
    if (ects) out.ects = ects
    const years = Number(/([\d.]+)\s*Jahre/.exec(t)?.[1]?.replace(',', '.'))
    if (years) out.durationYears = years
  }
  return out
}

/** «Bachelor of Science in X», «BSc X», «X BA», «Bachelorstudium X» → «Bachelor X». */
export function degreeName(level: Level, raw: string): string {
  const n = decode(raw)
    .replace(/﻿/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:Joint\s+)?(?:Bachelor|Master|BSc|MSc|BA|MA)(?:-Studiengang|-Studium|studium|studiengang)?\b(?:\s+of\s+(?:Science|Arts)\b)?(?:\s+FHNW)?(?:\s+in\b)?\s*[-–:/]?\s*(?=\S)/i, '')
    .replace(/\s*[-–−]\s*(?:Bachelor-Studiengang|Bachelor\/Master)\b/i, '')
    .replace(/\s+\((?:BA|MA)\)/, '')
    .replace(/\s+(?:BA|MA|Standard)$/, '')
    .replace(/\s*\(Studiengang [^)]+\)$/, '')
    .replace(/\s*[-–−]\s*Master\s+(?=\S)/, ' – ')
    .replace(/\s+-\s+/g, ' – ')
    .replace(/^Masterstudio\s+/, '')
    .replace(/^Sozialer Arbeit/, 'Soziale Arbeit')
    .replace(/^Strategischem/, 'Strategisches')
    .trim()
  const mse = /\bMSE\b/.test(n) ? /Profil\s+(.+)$/.exec(n)?.[1] ?? /MSE\s*[,–-]\s*(.+)$/.exec(n)?.[1] : undefined
  if (/\bMSE\b/.test(n)) return mse ? `Master Engineering, Profil ${mse.trim()}` : 'Master Engineering (MSE)'
  return titled(level, n)
}

/**
 * Entries that are one programme's specialisations («Musik | Komposition»,
 * «Business Administration, Major Marketing») become that programme, with
 * the specialisations as its focus. Its link is the programme's own page
 * where the list has one, else the common parent page, else the first.
 */
function groupFocus(xs: Listed[], split: (name: string) => [string, string] | null): Listed[] {
  const groups = new Map<string, Listed[]>()
  const rest: Listed[] = []
  for (const x of xs) {
    const s = split(x.name)
    if (!s) {
      rest.push({ ...x, name: degreeName(x.level, x.name) })
      continue
    }
    const base = degreeName(x.level, s[0])
    const g = groups.get(`${x.level}|${base}`) ?? []
    g.push({ ...x, name: base, focus: [cleanTitle(s[1])] })
    groups.set(`${x.level}|${base}`, g)
  }
  for (const g of groups.values()) {
    const focus = [...new Set(g.flatMap((x) => x.focus ?? []))]
    const own = rest.find((x) => x.level === g[0].level && x.name === g[0].name)
    if (own) {
      own.focus = [...new Set([...(own.focus ?? []), ...focus])]
      continue
    }
    const parents = new Set(g.map((x) => x.url.replace(/\/[^/]+\/?$/, '')))
    const parent = [...parents][0]
    const url = parents.size === 1 && g.length > 1 && !/\/(studiengaenge|bachelor|master|studium)$/.test(parent) ? parent : g[0].url
    rest.push({ ...g[0], url, focus: focus.length >= 2 ? focus : undefined, name: focus.length >= 2 ? g[0].name : `${g[0].name} – ${focus[0]}` })
  }
  return rest
}

/** «6-8 Semester», «3 Semester (Vollzeit)/6 …», «2 Jahre» → years, from the first number. */
function durationIn(s: string | undefined): number | undefined {
  const m = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|bis|oder)\s*[\d.,]+)?\s*(Semester|Jahre?)/i.exec(s ?? '')
  if (!m) return undefined
  const n = Number(m[1].replace(',', '.'))
  return /semester/i.test(m[2]) ? n / 2 : n
}

// FHNW: the list pages carry every programme as schema.org Course data.
export function fhnwList(html: string, base: string, level: Level): Listed[] {
  interface Course { '@type'?: string; name?: string; url?: string; programType?: string; hasCourseInstance?: Array<{ name?: string; timeToComplete?: string }> }
  const courses: Course[] = []
  const walk = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(walk)
    else if (x && typeof x === 'object') {
      if ((x as Course)['@type'] === 'Course') courses.push(x as Course)
      Object.values(x).forEach(walk)
    }
  }
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      walk(JSON.parse(m[1]))
    } catch {
      // A broken block is skipped; the others still count.
    }
  }
  const kind = level === 'bachelor' ? /^Bachelor/i : /^Master/i
  const ofLevel = courses.filter((c) => c.url && c.name && kind.test(c.programType ?? ''))
  // Several entries share a generic name («Master of Science in Engineering MSE»); their dates name the profile.
  const count = new Map<string, number>()
  for (const c of ofLevel) count.set(c.name!, (count.get(c.name!) ?? 0) + 1)
  const listed = ofLevel.map((c): Listed => {
    const first = c.hasCourseInstance?.[0]
    const name = (count.get(c.name!) ?? 0) > 1 && first?.name ? first.name : c.name!
    return { name: degreeName(level, name), level, url: absolute(c.url!, base), durationYears: durationIn(first?.timeToComplete), ects: level === 'bachelor' ? 180 : undefined }
  })
  // «…/energie-umwelttechnik-studienrichtungen/x» is a direction of the programme whose link has those words.
  const directions = listed.filter((x) => /-studienrichtungen\//.test(x.url))
  const programmes = groupFocus(listed.filter((x) => !directions.includes(x)), (n) => {
    const m = /^(.+?)\s*\|\s*(.+)$/.exec(n)
    return m ? [m[1], m[2]] : null
  })
  for (const d of directions) {
    const words = /\/([a-z-]+)-studienrichtungen\//.exec(d.url)![1].split('-')
    const parent = programmes.find((p) => words.every((w) => p.url.split('/').pop()!.includes(w)))
    if (parent) parent.focus = [...(parent.focus ?? []), d.name.replace(/^(Bachelor|Master)\s+/, '')]
    else programmes.push(d)
  }
  return dedupe(programmes)
}

// HSLU: one list per level; majors and profiles are listed as entries of their own.
export function hsluList(html: string, base: string, level: Level): Listed[] {
  const out: Listed[] = []
  for (const m of html.matchAll(/<a\b[^>]*href="(\/de-ch\/[a-z-]+\/studium\/(bachelor|master)\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (m[2] !== level || /info-tage|infotag|anmeldung/.test(m[1])) continue
    let name = text(m[3]).replace(/^Fakten zu[mr]?\s+/i, '')
    if (!name || name.length > 140 || name.split(/\s+/).length > 16) continue
    const url = absolute(m[1].replace(/\/(?:fakten[^/]*|daten-und-fakten|studiendetails)(?=\/|$)/, '').replace(/\/$/, ''), base)
    let focus: string[] | undefined
    const dir = /\s+mit Vertiefungsrichtung(?:en)?\s+(.+)$/.exec(name)
    if (dir) {
      focus = nameList(dir[1])
      name = name.slice(0, dir.index)
    }
    out.push({ name, level, url, focus, durationYears: level === 'bachelor' ? 3 : undefined, ects: level === 'bachelor' ? 180 : undefined })
  }
  // A link that repeats with a teaser text keeps its short name.
  return groupFocus(dedupe(out.sort((a, b) => a.name.length - b.name.length)), (n) => {
    const reversed = /^Major\s+(.+?),\s*(.+)$/.exec(n)
    if (reversed) return [reversed[2], reversed[1]]
    const m =
      /^(.+?),\s*(?:Major|Schwerpunkt)\s+(.+)$/.exec(n) ??
      /^(.+?)\s+mit\s+(?:Major(?:\s+in)?|Vertiefung in)\s+(.+)$/.exec(n) ??
      /^(.+?\bin\s+\S+)\s*\/\s*(?:Profil\s+)?(.+)$/.exec(n)
    return m ? [m[1], m[2]] : null
  })
}

// Universität Luzern: «alle Studiengänge» per level links each programme under its faculty.
export function uniluList(html: string, base: string, level: Level): Listed[] {
  const out: Listed[] = []
  const names = new Set<string>()
  for (const m of html.matchAll(/<a\b[^>]*href="(\/studium\/studienangebot\/(bachelor|master)\/[^/"]+\/[^/"]+\/)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (m[2] !== level || /nebenf|alle-studiengaenge|francophones|italofoni|mit-auflage|standard-titel/.test(m[1])) continue
    const name = text(m[3]).replace(/^Online Master[’']s in\s+/i, '').replace(/^(?:Lucerne\s+)?Master in\s+/i, '')
    const key = name.replace(/\s*\([^)]*\)$/, '').toLowerCase()
    if (!name || /nebenfach/i.test(name) || names.has(key)) continue
    names.add(key)
    out.push({ name: titled(level, name), level, url: absolute(m[1], base) })
  }
  return dedupe(out)
}

export function uniluDetail(html: string): Partial<Listed> {
  const body = text(html)
  const out: Partial<Listed> = {}
  const credits = Number(/umfasst\s+(\d+)\s+Credits/i.exec(body)?.[1])
  if (credits) out.ects = credits
  const semesters = Number(/Regelstudienzeit beträgt\s+(\d+)\s+Semester/i.exec(body)?.[1])
  if (semesters) out.durationYears = semesters / 2
  return out
}

// HSG: programme cards end in «(Kürzel)»; assessment year, FAQ and add-ons are no programmes.
export function unisgList(html: string, base: string, level: Level): Listed[] {
  const out: Listed[] = []
  for (const m of html.matchAll(new RegExp(`<a\\b[^>]*href="(/de/studium/programme/${level}/[^"]+/)"[^>]*>([\\s\\S]*?)</a>`, 'g'))) {
    const name = text(m[2]).replace(/\s+east\b.*$/, '').replace(/^Major\s+/, '')
    if (!/\([A-Za-z/ .]+\)$/.test(name) || /assessment/i.test(name)) continue
    out.push({ name: titled(level, name.replace(/^Bachelor in\s+/, 'Bachelor ')), level, url: absolute(m[1], base), ects: level === 'bachelor' ? 180 : undefined, durationYears: level === 'bachelor' ? 3 : undefined })
  }
  return dedupe(out)
}

// Fribourg: one table for all levels; a row with a «B:» note is the part-time variant of another.
export function unifrList(html: string, base: string, level: Level): Listed[] {
  const root = /<base href="([^"]+)"/.exec(html)?.[1]
  const from = root ? absolute(root, base) : base
  const out: Listed[] = []
  for (const m of html.matchAll(new RegExp(`<td class="level_link ${level}">\\s*<a[^>]*href="([^"]+)"\\s*name="([^"]*)"\\s*data-sublevel="([^"]*)"`, 'g'))) {
    if (m[3]) continue
    out.push({ name: titled(level, decode(m[2]).trim()), level, url: absolute(m[1], from) })
  }
  return dedupe(out)
}

export function unifrDetail(html: string): Partial<Listed> {
  const facts = new Map([...html.matchAll(/<h4>([^<]+)<\/h4>\s*<div[^>]*>([\s\S]*?)<\/div>/g)].map((m) => [text(m[1]), text(m[2])]))
  const out: Partial<Listed> = {}
  const structure = facts.get('Studienstruktur') ?? ''
  const ects = [...structure.matchAll(/(\d+)\s*ECTS/g)].reduce((sum, m) => sum + Number(m[1]), 0)
  if (ects) out.ects = ects
  const semesters = Number(/(\d+)\s*Semester/.exec(structure)?.[1])
  if (semesters) out.durationYears = semesters / 2
  const lang = languagesIn(facts.get('Studiensprachen') ?? '')
  if (lang) out.languages = lang
  return out
}

// Geneva: the bachelor and master pages list their programmes from a public JSON feed.
export function unigeList(json: string, base: string, level: Level): Listed[] {
  const kind = level === 'bachelor' ? 'bachelors' : 'masters'
  const rows = JSON.parse(json) as Array<{ name?: string; path?: string }>
  return dedupe(
    rows
      .filter((r) => r.name && r.path && new RegExp(`/bachelor-master/${kind}/`).test(r.path))
      .map((r) => ({ name: titled(level, decode(r.name!).trim()), level, url: absolute(r.path!, base), languages: level === 'bachelor' ? ['fr'] : undefined, ects: level === 'bachelor' ? 180 : undefined, durationYears: level === 'bachelor' ? 3 : undefined })),
  )
}

// Lausanne: the «Étudier» pages link each bachelor and master.
export function unilList(html: string, base: string, level: Level): Listed[] {
  const kind = level === 'bachelor' ? 'bachelors' : 'masters'
  const out: Listed[] = []
  for (const m of html.matchAll(new RegExp(`<a\\b[^>]*href="(/unil/fr/home/menuinst/etudier/${kind}/[a-z0-9-]+\\.html)"[^>]*>([\\s\\S]*?)</a>`, 'g'))) {
    const name = text(m[2])
    if (!name || name.length > 90) continue
    out.push({ name: titled(level, name), level, url: absolute(m[1], base), languages: level === 'bachelor' ? ['fr'] : undefined, ects: level === 'bachelor' ? 180 : undefined, durationYears: level === 'bachelor' ? 3 : undefined })
  }
  return dedupe(out)
}

// Bern: the A–Z tab names each programme with its type; a minor alone is no degree.
export function unibeList(html: string, base: string, level: Level): Listed[] {
  const out: Listed[] = []
  for (const m of html.matchAll(new RegExp(`<a\\b[^>]*href="(https://www\\.[a-z]+\\.unibe\\.ch/studium/studienprogramme/${level}_[^"]+)"[^>]*>([\\s\\S]*?)</a>`, 'g'))) {
    const t = text(m[2])
    const type = /\(((?:Mono|Major)(?:,\s*(?:Mono|Major))?)\)\s*$/.exec(t)
    if (!type) continue
    out.push({
      name: titled(level, t.slice(0, type.index).trim()),
      level,
      url: m[1],
      ects: level === 'bachelor' ? 180 : undefined,
      durationYears: level === 'bachelor' ? 3 : undefined,
    })
  }
  return dedupe(out)
}

// BFH and its art school HKB: the sitemap lists every programme page; each page has a fact sheet («Steckbrief»).
export function bfhList(xml: string, _base: string, level: Level): Listed[] {
  const out: Listed[] = []
  for (const m of xml.matchAll(/<loc>(https:\/\/www\.(?:hkb\.)?bfh\.ch\/de\/studium\/(bachelor|master)\/([a-z0-9-]+)\/)<\/loc>/g)) {
    if (m[2] !== level) continue
    const slug = m[3].replace(/-/g, ' ')
    out.push({ name: titled(level, slug[0].toUpperCase() + slug.slice(1)), level, url: m[1], provisional: true })
  }
  return dedupe(out)
}

export function bfhDetail(html: string): Partial<Listed> {
  const facts = new Map([...html.matchAll(/<span class="infolist-title">([\s\S]*?)<\/span>([\s\S]*?)<\/li>/g)].map((m) => [text(m[1]), m[2]]))
  const out: Partial<Listed> = {}
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)
  if (h1 && text(h1[1])) out.name = text(h1[1])
  const lines = (k: string) => (facts.get(k) ?? '').split(/<br\s*\/?>/).map(text).filter(Boolean)
  const focus = lines('Vertiefungen').filter((x) => !/^keine$/i.test(x) && x.length < 80)
  if (focus.length >= 2) out.focus = focus
  const ects = Number(/(\d+)\s*ECTS/.exec(text(facts.get('Anzahl ECTS') ?? ''))?.[1])
  if (ects) out.ects = ects
  const semesters = Number(/(\d+)\s*Semester/.exec(lines('Studienform')[0] ?? '')?.[1])
  if (semesters) out.durationYears = semesters / 2
  const lang = languagesIn(lines('Unterrichtssprache')[0] ?? '')
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
  {
    institution: 'ETH Zürich',
    lists: [
      { url: 'https://ethz.ch/de/studium/bachelor/studienangebot.html', level: 'bachelor', read: ethBachelors },
      { url: 'https://ethz.ch/de/.navigation.json', level: 'master', read: ethMasters },
    ],
    detail: ethDetail,
    detailLevels: ['master'],
  },
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
  {
    institution: 'Universität Bern',
    lists: [
      { url: 'https://www.unibe.ch/studium/studienangebote/bachelor/studienprogramme/index_ger.html', level: 'bachelor', read: unibeList },
      { url: 'https://www.unibe.ch/studium/studienangebote/master/studienprogramme/index_ger.html', level: 'master', read: unibeList },
    ],
  },
  {
    institution: 'Universität Luzern',
    lists: [
      { url: 'https://www.unilu.ch/studium/studienangebot/bachelor/alle-studiengaenge/', level: 'bachelor', read: uniluList },
      { url: 'https://www.unilu.ch/studium/studienangebot/master/alle-studiengaenge/', level: 'master', read: uniluList },
    ],
    detail: uniluDetail,
  },
  {
    institution: 'Universität St. Gallen',
    lists: [
      { url: 'https://www.unisg.ch/de/studium/programme/bachelor/', level: 'bachelor', read: unisgList },
      { url: 'https://www.unisg.ch/de/studium/programme/master/', level: 'master', read: unisgList },
    ],
  },
  {
    institution: 'Universität Freiburg',
    lists: [
      { url: 'https://studies.unifr.ch/de/studienangebot/courses/?ba=1&ma=1&do=0', level: 'bachelor', read: unifrList },
      { url: 'https://studies.unifr.ch/de/studienangebot/courses/?ba=1&ma=1&do=0', level: 'master', read: unifrList },
    ],
    detail: unifrDetail,
  },
  {
    institution: 'Université de Genève',
    // One feed holds both levels.
    lists: [
      { url: 'https://www.unige.ch/bachelor-master/api/unige_filter_cards/get_page_categories/119/fr_FR/btUnigeFilterCards', level: 'bachelor', read: unigeList },
      { url: 'https://www.unige.ch/bachelor-master/api/unige_filter_cards/get_page_categories/119/fr_FR/btUnigeFilterCards', level: 'master', read: unigeList },
    ],
  },
  {
    institution: 'Université de Lausanne',
    lists: [
      { url: 'https://www.unil.ch/unil/fr/home/menuinst/etudier/bachelors.html', level: 'bachelor', read: unilList },
      { url: 'https://www.unil.ch/unil/fr/home/menuinst/etudier/masters.html', level: 'master', read: unilList },
    ],
  },
  {
    institution: 'Berner Fachhochschule',
    // One sitemap holds both levels.
    lists: [
      { url: 'https://www.bfh.ch/sitemaps/sitemap-de.xml', level: 'bachelor', read: bfhList },
      { url: 'https://www.bfh.ch/sitemaps/sitemap-de.xml', level: 'master', read: bfhList },
    ],
    detail: bfhDetail,
  },
  {
    institution: 'Fachhochschule Nordwestschweiz',
    lists: [
      { url: 'https://www.fhnw.ch/de/studium/angebot/studiengaenge?degree_program_type=ba&degree_program_type=bsc', level: 'bachelor', read: fhnwList },
      { url: 'https://www.fhnw.ch/de/studium/angebot/studiengaenge?degree_program_type=ma&degree_program_type=msc', level: 'master', read: fhnwList },
    ],
  },
  {
    institution: 'Hochschule Luzern',
    lists: [
      { url: 'https://www.hslu.ch/de-ch/hochschule-luzern/studium/bachelor/', level: 'bachelor', read: hsluList },
      { url: 'https://www.hslu.ch/de-ch/hochschule-luzern/studium/master/', level: 'master', read: hsluList },
    ],
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
  // Romandie and Fribourg: French and German names the classifier does not know.
  [/hirnforschung/i, ['neuroscience']],
  [/hochenergiephysik/i, ['physics']],
  [/interdisziplinäre naturwissenschaften/i, ['chemistry', 'physics']],
  [/umweltingenieur/i, ['environmental-science', 'civil-engineering']],
  [/nuclear engineering/i, ['energy-engineering', 'physics']],
  [/\bmlaw\b|\bllm\b/i, ['law']],
  [/humanités numériques|digital humanities/i, ['computer-science', 'literature']],
  [/soziolinguistik/i, ['linguistics']],
  [/wissenschaftsphilosophie/i, ['philosophy']],
  [/mittleren osten|muslimischen gesellschaften/i, ['languages', 'history']],
  [/identification physique/i, ['criminology']],
  [/études (chinoises|japonaises|russes|asiatiques|africaines|mésopotamiennes)|moyen-orient|europe centrale et orientale|egyptologie/i, ['languages', 'history']],
  [/études classiques|langue et littérature|langue, littérature/i, ['languages', 'literature']],
  [/français langue étrangère|als fremdsprache|als zweitsprache|fremdsprachendidaktik|zweisprachigkeit|^(?:französisch|italienisch|spanisch|deutsch)\b/i, ['languages', 'linguistics']],
  [/interprétation de conférence|traduction|übersetz|dolmetsch/i, ['languages', 'linguistics']],
  [/études européennes|études globales|global studies|international affairs|droits de l'enfant/i, ['political-science']],
  [/études genre|gender/i, ['sociology']],
  [/sciences biomédicales|biomedizinische forschung|experimentelle biomedizin|biologie médicale/i, ['medicine', 'molecular-biology']],
  [/sciences informatiques|sciences computationnelles|systèmes et services numériques|investigation numérique|systèmes d'information/i, ['computer-science', 'information-systems']],
  [/sciences de la santé|santé globale/i, ['public-health']],
  [/sciences du mouvement|sport/i, ['sports-science']],
  [/sciences actuarielles/i, ['finance-accounting', 'statistics-data-science']],
  [/négoce des matières premières/i, ['finance-accounting', 'economics']],
  [/socioéconomie|sociétés durables|changement social|soziale probleme|sozialpolitik/i, ['sociology']],
  [/développement territorial|raumentwicklung/i, ['urban-planning']],
  [/ethnomusicologie|musik und bewegung|musik und szene/i, ['music']],
  [/apprentissage et de la formation|sciences et pratiques de l'éducation|kindergarten|primarstufe|\bsek i\b|sekundarstufe|doppeldiplom|religionslehre|religionspädagogik/i, ['education']],
  [/taphonomie|analyse criminelle|traçologie|criminalistique|professions judiciaires/i, ['criminology', 'law']],
  [/biogéosciences|glaziologie|geomorphologie/i, ['earth-sciences']],
  [/umweltbiologie/i, ['biology', 'environmental-science']],
  [/umweltgeisteswissenschaft|nachhaltigkeitsforschung/i, ['environmental-science', 'philosophy']],
  [/zeitgeschichte|schweizergeschichte/i, ['history']],
  [/theologische studien|interreligiöse studien|jüdisch-christlich/i, ['religious-studies']],
  [/familien-, kinder- und jugend/i, ['education', 'sociology']],
  [/kommunikations-?wissenschaft/i, ['media-communication', 'sociology']],
  [/computational social sciences/i, ['sociology', 'statistics-data-science']],
  [/zweisprachiger master \(mlaw/i, ['law']],
  [/integrated building systems|gebäudetechnik/i, ['civil-engineering', 'energy-engineering']],
  [/space systems/i, ['aerospace-engineering']],
  [/mikro- und nanosysteme/i, ['electrical-engineering', 'materials-science']],
  [/personalpsychologie|wirtschaftspsychologie|business psychology/i, ['psychology', 'business-management']],
  [/mode-design/i, ['fashion-design']],
  [/scenography|szenografie|spatial design|transversal design|eco-social design|service design|creative transformation|prozessgestaltung|^design$/i, ['industrial-design', 'graphic-design']],
  [/camera arts|\bvideo\b|\bfilm\b/i, ['film-production']],
  [/data design \+ art|digital ideation|immersive technologies/i, ['ux-design', 'computer-science']],
  [/real estate|immobilien/i, ['finance-accounting', 'business-management']],
  [/bi-disciplinaire en sciences/i, ['biology', 'chemistry']],
  [/musik|music|komposition|dirigieren/i, ['music']],
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
    const fetched = new Map<string, string | null>()
    for (const l of src.lists) {
      if (!fetched.has(l.url)) fetched.set(l.url, await page(l.url))
      const html = fetched.get(l.url)
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
        if (!html) continue
        const found = read(html)
        const merged = { ...Object.fromEntries(Object.entries(found).filter(([, v]) => v !== undefined)), ...Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) } as Listed
        if (x.provisional && found.name) merged.name = degreeName(x.level, found.name)
        delete merged.provisional
        listed[i] = merged
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
  if (programmes.length < 600) throw new Error(`only ${programmes.length} programmes, a site may have changed`)
  const out: ScrapeOutput = { source: 'ch-hochschulen', fetchedAt, programmes }
  writeJson(join(OUT, 'ch-hochschulen.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
