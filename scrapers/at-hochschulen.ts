/**
 * Austria: every degree programme at universities, universities of applied
 * sciences (FH), universities of teacher education (PH) and private
 * universities, from studienwahl.at, the study portal of the Federal Ministry
 * (BMFWF, run by OeAD). Its list pages show name, institution, kind of
 * programme and place; robots.txt allows crawling. We read the list slowly,
 * one page per second, and link every programme to its page there.
 */
import { join } from 'node:path'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { ADMISSION } from '../lib/institutions.ts'
import { atTuition, findAtInstitution } from '../lib/at-institutions.ts'
import type { AtType } from '../lib/at-institutions.ts'
import { OUT, fetchRetry, fieldsForTitle, isMain, log, sleep, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const SITE = 'https://www.studienwahl.at'

export interface ListItem {
  name: string
  institution: string
  kind: string
  place: string
  href: string
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&uuml;/g, 'ü')
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&szlig;/g, 'ß')
    .replace(/\s+/g, ' ')
    .trim()

/** The programmes on one list page. */
export function parseList(html: string): ListItem[] {
  const out: ListItem[] = []
  const re = /<div class="course[^"]*">\s*<h2>([\s\S]*?)<\/h2>\s*<p>([\s\S]*?)<\/p>\s*<b>([\s\S]*?)<\/b>[\s\S]*?href="(\/studien\/[^"]+\.html)"/g
  for (const m of html.matchAll(re)) {
    const [kind, place] = decode(m[3]).split('»').map((x) => x.trim())
    out.push({ name: decode(m[1]), institution: decode(m[2]), kind: kind ?? '', place: place ?? '', href: m[4] })
  }
  return out
}

export function atLevel(kind: string): Level | null {
  if (/bachelor/i.test(kind)) return 'bachelor'
  if (/master/i.test(kind)) return 'master'
  if (/diplom|lehramt/i.test(kind)) return 'professional'
  return null
}

function typeOf(institution: string): AtType {
  const known = findAtInstitution(institution)
  if (known) return known.type
  if (/fachhochschule|\bfh\b|university of applied sciences/i.test(institution)) return 'fh'
  if (/pädagogische hochschule|\bph\b/i.test(institution)) return 'ph'
  if (/privat|private/i.test(institution)) return 'priv'
  return 'uni'
}

export function parseItem(it: ListItem, fetchedAt: string): Programme | null {
  const level = atLevel(it.kind)
  if (!level) return null
  const { fields, confidence } = fieldsForTitle(it.name)
  if (!fields.length) return null
  const known = findAtInstitution(it.institution)
  const type = typeOf(it.institution)
  const fee = atTuition(type)
  const english = /^[A-Za-z0-9 ,.&()'’\-–:/+]+$/.test(it.name) && /\b(and|of|in|for|management|science|studies|engineering|design)\b/i.test(it.name)
  return {
    id: programmeId(['at', it.href]),
    name: it.name,
    institution: known?.name ?? it.institution,
    country: 'AT',
    city: it.place || known?.city,
    region: known?.state,
    level,
    fields,
    fieldConfidence: confidence,
    languages: english ? ['en'] : (known?.languages ?? ['de']),
    tuition: { currency: 'EUR', domestic: fee.domestic, eu: fee.eu, international: fee.international, estimated: true, note: fee.note },
    url: `${SITE}${encodeURI(decodeURI(it.href))}`,
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
  const programmes: Programme[] = []
  const seen = new Set<string>()
  const kinds = new Map<string, number>()
  const unclassified: string[] = []
  const unknown = new Set<string>()
  const fixture: ListItem[] = []
  let empty = 0
  for (let page = 1; page <= 1000 && empty < 2; page++) {
    let items: ListItem[] = []
    try {
      const html = await (await fetchRetry(`${SITE}/studien/?page=${page}&per-page=10`, {}, 3)).text()
      items = parseList(html)
    } catch (e) {
      log(`AT page ${page} failed: ${(e as Error).message}`)
    }
    const fresh = items.filter((it) => !seen.has(it.href))
    // Past the last page the portal repeats it.
    if (!fresh.length) {
      empty++
      continue
    }
    empty = 0
    for (const it of fresh) {
      seen.add(it.href)
      kinds.set(it.kind, (kinds.get(it.kind) ?? 0) + 1)
      if (!findAtInstitution(it.institution)) unknown.add(it.institution)
      const p = parseItem(it, fetchedAt)
      if (p) {
        programmes.push(p)
        if (fixture.length < 60 && /^(Universität Wien|Technische Universität Wien|FH Technikum Wien|FH JOANNEUM|Pädagogische Hochschule Wien|Universität Graz|MCI)/.test(it.institution)) fixture.push(it)
      } else if (atLevel(it.kind)) unclassified.push(it.name)
    }
    if (page % 25 === 0) log(`AT: page ${page}, ${seen.size} read, ${programmes.length} programmes`)
    await sleep(1000)
  }
  log(`AT: ${seen.size} read, ${programmes.length} programmes`)
  log(`AT kinds: ${JSON.stringify([...kinds])}`)
  log(`AT institutions not in our list (${unknown.size}): ${[...unknown].slice(0, 60).join(' || ')}`)
  log(`AT unclassified (${unclassified.length}): ${unclassified.slice(0, 60).join(' || ')}`)
  const byType = new Map<string, number>()
  for (const p of programmes) byType.set(p.institutionType!, (byType.get(p.institutionType!) ?? 0) + 1)
  log(`AT by type: ${JSON.stringify([...byType])}`)
  log(`AT fixture: ${JSON.stringify(fixture)}`)
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
