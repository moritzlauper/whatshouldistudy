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
