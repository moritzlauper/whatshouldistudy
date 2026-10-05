/**
 * Germany: every study programme from the Studiensuche of the Bundesagentur für
 * Arbeit, the database behind studiensuche.arbeitsagentur.de (documented at
 * studiensuche.api.bund.dev). The API needs a search word and returns 20
 * programmes per page; the degree words in programme titles (Bachelor, Master,
 * Staatsexamen …) reach nearly all of them, field words catch the rest.
 *
 * Fees follow the rules, not the programme: public universities charge no
 * tuition, only a semester contribution; Baden-Württemberg charges students
 * from outside the EU; private universities set their own prices.
 */
import { join } from 'node:path'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import type { InstType } from '../lib/institutions.ts'
import { ADMISSION } from '../lib/institutions.ts'
import { OUT, fetchRetry, isMain, log, sleep, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'
import { germanFields } from './lib/de-titles.ts'

const API = 'https://rest.arbeitsagentur.de/infosysbub/studisu/pc/v1/studienangebote'
const HEADERS = { 'X-API-Key': 'infosysbub-studisu', Accept: 'application/json' }

/** Degree words first (they reach ~19,000 programmes), then subjects whose titles may lack one. */
const QUERIES = [
  'Bachelor', 'Master', 'Staatsexamen', 'Lehramt', 'Diplom', 'Magister', 'Monobachelor', 'Kombinationsbachelor',
  'Medizin', 'Zahnmedizin', 'Tiermedizin', 'Pharmazie', 'Rechtswissenschaft', 'Jura', 'Psychologie', 'Theologie', 'Lebensmittelchemie',
  'Musik', 'Kunst', 'Design', 'Schauspiel', 'Architektur', 'Informatik', 'Wirtschaft',
]

export interface RawAngebot {
  id: string
  studiBezeichnung?: string
  abschlussgrad?: { id?: number; label?: string }
  hochschulart?: { id?: number; label?: string }
  region?: { Key?: string; label?: string }
  studienanbieter?: { banId?: number; name?: string }
  studienfaecher?: string[]
  studienform?: { label?: string }
  studienort?: { ort?: string; bundesland?: string }
  studientyp?: { label?: string }
  externalLinks?: Array<{ link?: string; name?: string }>
}

export function deLevel(label = ''): Level | null {
  if (/bachelor|bakkalaureus/i.test(label)) return 'bachelor'
  if (/master/i.test(label)) return 'master'
  if (/staatsexamen|kirchlich/i.test(label)) return 'professional'
  if (/diplom|magister/i.test(label)) return 'integrated'
  return null
}

export function deType(hochschulart = '', name = ''): InstType {
  if (PRIVATE.test(name)) return 'priv'
  if (/universität/i.test(hochschulart)) return /kunst|musik/i.test(name) ? 'art' : 'uni'
  if (/fachhochschule|angewandte/i.test(hochschulart)) return /verwaltung|polizei|finanz|rechtspflege|bundeswehr|öffentliche/i.test(name) ? 'admin' : 'fh'
  if (/duale|berufsakademie/i.test(hochschulart)) return 'dual'
  if (/kunst|musik/i.test(hochschulart)) return 'art'
  if (/pädagogisch/i.test(hochschulart)) return 'ph'
  if (/theolog|kirchlich/i.test(hochschulart)) return 'theo'
  if (/verwaltung/i.test(hochschulart)) return 'admin'
  return 'uni'
}

/** Private universities by name; their fees are their own. */
const PRIVATE =
  /\b(IU|SRH|FOM|EBS|WHU|CBS|ISM|BSP|HSBA|AKAD|HHL|ESMT|CODE|XU|SDI)\b|privat|internationale hochschule|fresenius|macromedia|euro-fh|diploma hochschule|steinbeis|bucerius|frankfurt school|hertie|constructor|jacobs university|witten\/herdecke|zeppelin|mediadesign|design akademie|hochschule für oekonomie|apollon|hamburger fern|wilhelm büchner|europäische fernhochschule|quadriga|touro|karlshochschule|allensbach|medical school|psychologische hochschule|alanus|cusanus|kühne logistics|nordakademie|bard college|berlin international|gisma|arden|munich business school|fh des mittelstands|hochschule fresenius|accadis|ffh|hdwm|mhmk|bits|dhgs|dhfpg/i

export function parseAngebot(a: RawAngebot, fetchedAt: string): Programme | null {
  const level = deLevel(a.abschlussgrad?.label)
  if (!level) return null
  if (/weiterbild/i.test(a.studientyp?.label ?? '')) return null
  const name = (a.studiBezeichnung ?? '').trim()
  const institution = (a.studienanbieter?.name ?? '').trim()
  if (!name || !institution) return null
  const subjects = (a.studienfaecher ?? []).map((s) => s.replace(/\s*\((grundständig|weiterführend|weiterbildend)\)\s*$/i, ''))
  const text = [name, ...subjects].join(' · ')
  const { fields, confidence } = germanFields(text)
  if (!fields.length) return null
  const type = deType(a.hochschulart?.label, institution)
  const region = a.region?.Key ?? ''
  const form = a.studienform?.label ?? ''
  const tuition: Programme['tuition'] =
    type === 'priv'
      ? { currency: 'EUR', estimated: true, note: 'Private Hochschule: Studiengebühren laut Hochschule' }
      : {
          currency: 'EUR',
          domestic: 0,
          eu: 0,
          // Baden-Württemberg: EUR 1,500 per semester for students from outside the EU.
          international: region === 'BW' ? 3000 : 0,
          estimated: true,
          note: 'Keine Studiengebühren, Semesterbeitrag ca. 100–400 €',
        }
  return {
    id: programmeId(['de', a.id]),
    name,
    institution,
    country: 'DE',
    city: a.studienort?.ort,
    region: a.region?.label ?? a.studienort?.bundesland,
    level,
    fields,
    fieldConfidence: confidence,
    languages: /englisch|english|international|\bM\.?Sc\b|\bMBA\b/i.test(name) ? ['de', 'en'] : ['de'],
    tuition,
    mode: /fern/i.test(form) ? 'distance' : /teilzeit|berufsbegleitend/i.test(form) ? 'part-time' : 'full-time',
    public: type !== 'priv',
    admission: ADMISSION.DE[type]?.de,
    institutionType: type,
    source: 'de-studiensuche',
    updated: fetchedAt,
  }
}

const PARALLEL = 4

const FIXTURE = /^(Universität Hamburg|Technische Universität München|Hochschule Osnabrück|Universität Bonn|Hochschule für angewandte Wissenschaften Hamburg|Duale Hochschule Baden-Württemberg Stuttgart)$/

async function page(sw: string, pg: number): Promise<{ items: RawAngebot[]; total: number }> {
  for (let tries = 1; ; tries++) {
    try {
      const res = await fetchRetry(`${API}?sw=${encodeURIComponent(sw)}&pg=${pg}`, { headers: HEADERS }, 3)
      const j = (await res.json()) as { items?: Array<{ studienangebot: RawAngebot }>; maxErgebnisse?: number }
      return { items: (j.items ?? []).map((i) => i.studienangebot), total: j.maxErgebnisse ?? 0 }
    } catch (e) {
      if (tries >= 3) throw e
      await sleep(10_000 * tries)
    }
  }
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const seen = new Set<string>()
  const programmes: Programme[] = []
  const unclassified = new Map<string, number>()
  const fixture: RawAngebot[] = []
  const kinds = new Map<string, number>()
  let raw = 0
  for (const sw of QUERIES) {
    const first = await page(sw, 1)
    const pages = Math.ceil(first.total / 20)
    let added = 0
    const take = (items: RawAngebot[]) => {
      for (const a of items) {
        if (!a?.id || seen.has(a.id)) continue
        seen.add(a.id)
        raw++
        kinds.set(a.hochschulart?.label ?? '-', (kinds.get(a.hochschulart?.label ?? '-') ?? 0) + 1)
        const p = parseAngebot(a, fetchedAt)
        if (p && fixture.length < 45 && FIXTURE.test(a.studienanbieter?.name ?? '')) fixture.push({ ...a, externalLinks: undefined })
        if (p) {
          programmes.push(p)
          added++
        } else if (deLevel(a.abschlussgrad?.label)) unclassified.set(a.studiBezeichnung ?? '', (unclassified.get(a.studiBezeichnung ?? '') ?? 0) + 1)
      }
    }
    take(first.items)
    // A few pages at a time: one by one, the 1,000 pages take most of an hour.
    for (let pg = 2; pg <= pages; pg += PARALLEL) {
      const batch = Array.from({ length: Math.min(PARALLEL, pages - pg + 1) }, (_, k) =>
        page(sw, pg + k).catch((e) => (log(`DE ${sw} page ${pg + k} failed: ${(e as Error).message}`), { items: [] as RawAngebot[], total: 0 })),
      )
      for (const { items } of await Promise.all(batch)) take(items)
      await sleep(200)
    }
    log(`DE «${sw}»: ${first.total} results, ${added} new programmes (total ${programmes.length})`)
  }
  log(`DE: ${raw} offers read, ${programmes.length} programmes`)
  log(`DE institution kinds: ${JSON.stringify([...kinds])}`)
  log(`DE unclassified (${unclassified.size}): ${[...unclassified.keys()].slice(0, 400).join(' || ')}`)
  const byType = new Map<string, number>()
  for (const p of programmes) byType.set(p.institutionType!, (byType.get(p.institutionType!) ?? 0) + 1)
  log(`DE by type: ${JSON.stringify([...byType])}`)
  // A small slice of real records for the demo dataset (scrapers/fixtures/de-studiensuche.json).
  log(`DE fixture: ${JSON.stringify(fixture)}`)
  if (programmes.length < 1000) throw new Error(`Only ${programmes.length} German programmes`)
  const out: ScrapeOutput = { source: 'de-studiensuche', fetchedAt, programmes }
  writeJson(join(OUT, 'de-studiensuche.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
