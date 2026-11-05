/**
 * Austria: every degree programme at universities, universities of applied
 * sciences (FH), universities of teacher education (PH), private universities
 * and arts universities, from the open dataset «Studiengänge» of the Federal
 * Ministry (BMFWF) on data.gv.at. studienwahl.at shows the same data. Licence
 * CC BY 4.0. One request for the whole list; each programme links to its
 * university's study page.
 */
import { join } from 'node:path'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { ADMISSION } from '../lib/institutions.ts'
import { atTuition, findAtInstitution } from '../lib/at-institutions.ts'
import type { AtType } from '../lib/at-institutions.ts'
import { OUT, fetchRetry, isMain, log, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'
import { germanFields } from './lib/de-titles.ts'
import { fetchSite } from './lib/site-fetch.ts'
import { AT_PERMITTED, readPermitted, type SiteProgramme } from './sites/at-permitted.ts'

export const DATA_URL = 'https://extapp.noc-science.at/apex/shibb/api/v1/studien'

const STATES: Record<string, string> = {
  B: 'Burgenland', K: 'Kärnten', NÖ: 'Niederösterreich', OÖ: 'Oberösterreich', S: 'Salzburg', ST: 'Steiermark', T: 'Tirol', V: 'Vorarlberg', W: 'Wien',
}

/** The fields of one record in the dataset that we use. */
export interface AtRecord {
  studium_id: number
  studium_de: string | null
  typ_de: string | null
  hochschule_de: string | null
  institution_de: string | null
  ort_de: string | null
  studieninfourl_de: string | null
  uniurl_de: string | null
}

export interface ListItem {
  id: string
  name: string
  institution: string
  kind: string
  place: string
  hochschule: string
  link: string
}

const isHttp = (u: string | null): u is string => !!u && /^https?:\/\//.test(u)

export function toListItem(r: AtRecord): ListItem {
  const name = r.studium_de ?? ''
  return {
    id: String(r.studium_id),
    name,
    institution: r.institution_de ?? '',
    kind: r.typ_de ?? '',
    place: r.ort_de ?? '',
    hochschule: r.hochschule_de ?? '',
    link: [r.studieninfourl_de, r.uniurl_de].find(isHttp) ?? `https://www.studienwahl.at/studien/?q=${encodeURIComponent(name)}`,
  }
}

export function atLevel(kind: string): Level | null {
  // Continuing education and the vocational «Bachelor Professional» are not degree programmes.
  if (/continuing|weiterbild|professional/i.test(kind)) return null
  if (/bachelor/i.test(kind)) return 'bachelor'
  if (/master|erasmus mundus/i.test(kind)) return 'master'
  if (/diplom|lehramt/i.test(kind)) return 'professional'
  return null
}

function typeOf(it: ListItem): AtType {
  const known = findAtInstitution(it.institution)
  if (known) return known.type
  const text = `${it.hochschule} ${it.institution}`
  if (/fachhochschule|\bfh\b|university of applied sciences/i.test(text)) return 'fh'
  if (/pädagogische hochschule|\bph\b/i.test(text)) return 'ph'
  if (/privat|private/i.test(text)) return 'priv'
  return 'uni'
}

export function parseItem(it: ListItem, fetchedAt: string): Programme | null {
  const level = atLevel(it.kind)
  if (!level) return null
  const { fields, confidence } = germanFields(it.name)
  if (!fields.length) return null
  const known = findAtInstitution(it.institution)
  const type = typeOf(it)
  const fee = atTuition(type)
  const city = it.place || known?.city
  const region = known ? STATES[known.state] : undefined
  const english = /^[A-Za-z0-9 ,.&()'’\-–:/+]+$/.test(it.name) && /\b(and|of|in|for|management|science|studies|engineering|design)\b/i.test(it.name)
  return {
    id: programmeId(['at', it.id]),
    name: it.name,
    institution: known?.name ?? it.institution,
    country: 'AT',
    city,
    region: region === city ? undefined : region,
    level,
    fields,
    fieldConfidence: confidence,
    languages: english ? ['en'] : (known?.languages ?? ['de']),
    tuition: { currency: 'EUR', domestic: fee.domestic, eu: fee.eu, international: fee.international, estimated: true, note: fee.note },
    url: it.link,
    institutionUrl: known?.url,
    public: type !== 'priv',
    admission: ADMISSION.AT[type]?.de,
    institutionType: type,
    source: 'at-studienwahl',
    updated: fetchedAt,
  }
}

const KIND: Record<string, string> = { bachelor: 'Bachelorstudium', master: 'Masterstudium', professional: 'Diplomstudium' }
// «Klassische Philologie (Latein/Griechisch)» and «Klassische Philologie» are one programme.
const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9äöüß]+/g, '')
const slugOf = (url?: string) => (url ?? '').replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() ?? ''

/**
 * Programmes of the universities that agreed (scrapers/sites/at-permitted.ts)
 * as their own website lists them: a programme in the dataset gets the page,
 * language, ECTS, duration, degree and mode from the website and keeps its
 * id; one only on the website is added. Rows of the dataset the website does
 * not list stay as they are.
 */
export function mergeSite(programmes: Programme[], site: SiteProgramme[], fetchedAt: string): { matched: number; added: number } {
  const byName = new Map<string, Programme>()
  const bySlug = new Map<string, Programme>()
  for (const p of programmes) {
    byName.set(`${p.institution}|${p.level}|${norm(p.name)}`, p)
    if (p.url) bySlug.set(`${p.institution}|${p.level}|${slugOf(p.url)}`, p)
  }
  let matched = 0
  let added = 0
  for (const s of site) {
    let p = byName.get(`${s.institution}|${s.level}|${norm(s.name)}`) ?? bySlug.get(`${s.institution}|${s.level}|${slugOf(s.url)}`)
    if (!p) {
      // «Psychologie» on the website, «Psychologie Schwerpunkt Technologie und Wirtschaft» in the dataset: only when unambiguous.
      const n = norm(s.name)
      const near = programmes.filter((x) => x.institution === s.institution && x.level === s.level && n.length >= 8 && norm(x.name).length >= 8 && (norm(x.name).startsWith(n) || n.startsWith(norm(x.name))))
      if (near.length === 1) p = near[0]
    }
    if (p) matched++
    else {
      const key = AT_PERMITTED.find((x) => x.institution === s.institution)?.key ?? 'site'
      p = parseItem({ id: `${key}-${slugOf(s.url)}`, name: s.name, institution: s.institution, kind: KIND[s.level], place: s.cities?.[0] ?? '', hochschule: 'Universität', link: s.url }, fetchedAt) ?? undefined
      if (!p) continue
      programmes.push(p)
      added++
    }
    p.url = s.url
    if (s.languages) p.languages = s.languages
    if (s.otherLanguages) p.otherLanguages = s.otherLanguages
    if (s.ects) p.ects = s.ects
    if (s.durationYears) p.durationYears = s.durationYears
    if (s.degreeTitle) p.degreeTitle = s.degreeTitle
    if (s.mode) p.mode = s.mode
  }
  return { matched, added }
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const body = (await (await fetchRetry(DATA_URL, {}, 3)).json()) as { items?: AtRecord[] }
  if (!Array.isArray(body.items)) throw new Error('The Austrian dataset has no items')
  const programmes: Programme[] = []
  const seen = new Set<string>()
  const kinds = new Map<string, number>()
  const unclassified: string[] = []
  const unknown = new Set<string>()
  for (const it of body.items.map(toListItem)) {
    if (seen.has(it.id)) continue
    seen.add(it.id)
    kinds.set(it.kind, (kinds.get(it.kind) ?? 0) + 1)
    if (!findAtInstitution(it.institution)) unknown.add(it.institution)
    const p = parseItem(it, fetchedAt)
    if (p) programmes.push(p)
    else if (atLevel(it.kind)) unclassified.push(it.name)
  }
  log(`AT: ${body.items.length} records, ${programmes.length} programmes`)
  try {
    const site = await readPermitted(fetchSite, log)
    const { matched, added } = mergeSite(programmes, site, fetchedAt)
    log(`AT websites with permission: ${site.length} programmes, ${matched} matched in the dataset, ${added} added`)
  } catch (e) {
    // The dataset alone is still a complete list.
    log(`AT websites with permission failed: ${(e as Error).message}`)
  }
  log(`AT kinds: ${JSON.stringify([...kinds])}`)
  log(`AT institutions not in our list (${unknown.size}): ${[...unknown].slice(0, 60).join(' || ')}`)
  log(`AT unclassified (${unclassified.length}): ${unclassified.slice(0, 400).join(' || ')}`)
  const byType = new Map<string, number>()
  for (const p of programmes) byType.set(p.institutionType!, (byType.get(p.institutionType!) ?? 0) + 1)
  log(`AT by type: ${JSON.stringify([...byType])}`)
  if (programmes.length < 300) throw new Error(`Only ${programmes.length} Austrian programmes`)
  const out: ScrapeOutput = { source: 'at-studienwahl', fetchedAt, programmes }
  writeJson(join(OUT, 'at-studienwahl.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
