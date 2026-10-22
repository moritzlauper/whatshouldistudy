/**
 * Switzerland, continuing education: the MAS, DAS and CAS (executive MBAs
 * count as MAS) as the universities list them on their own websites. Kept
 * apart from the degree programmes in ch-hochschulen.ts: its own source and
 * its own levels, so the site lists them after the degree programmes and
 * ranks them only when someone asks for continuing education.
 *
 * Only facts from the lists are taken: name, type and link, and where the
 * list names them, ECTS, teaching language, place and the fee. No programme
 * pages and no descriptions. One request every 1.5 seconds, as robots.txt
 * allows. Institutions whose lists only load in the browser (ETH, UZH, HSG,
 * UNIL/EPFL, Freiburg, Bern, HSLU) are not read yet.
 */
import { join } from 'node:path'
import { CAMPUS_CANTON, CH_TITLES, bfhOffers, decode, languagesIn, text } from './ch-hochschulen.ts'
import { fetchSite } from './lib/site-fetch.ts'
import { findChInstitution } from '../lib/ch-institutions.ts'
import type { ChInstitution } from '../lib/ch-institutions.ts'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, cleanTitle, fieldsForTitle, isMain, log, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

export type ContinuingLevel = Extract<Level, 'mas' | 'das' | 'cas'>

/** An offer as a list names it. */
export interface Offer {
  name: string
  level: ContinuingLevel
  url: string
  /** Where the offer belongs to another institution than the list's (PH FHNW within FHNW). */
  institution?: string
  ects?: number
  languages?: string[]
  /** A campus town, where the list names one. */
  city?: string
  /** The fee for the whole programme in CHF, as the institution states it. */
  fee?: number
}

/** «CAS …», «Master of Advanced Studies …», «Executive MBA …» → its level; MiCAS, courses and seminars are none. */
export function levelOf(s: string): ContinuingLevel | undefined {
  const x = decode(s).trim()
  if (/^(?:MAS|Master of Advanced Studies|E?MBA|Executive MBA|Executive Master)\b/i.test(x)) return 'mas'
  if (/^(?:DAS|Diploma of Advanced Studies)\b/i.test(x)) return 'das'
  if (/^(?:CAS|Certificate of Advanced Studies)\b/i.test(x)) return 'cas'
  return undefined
}

/** The name as the institution writes it, with its type in front where the list shows the type apart. */
export function offerName(type: string, raw: string): string {
  const n = cleanTitle(decode(raw).normalize('NFC'))
  return levelOf(n) ? n : `${type} ${n}`
}

const TYPE_PREFIX = /^(?:(?:CAS|DAS|MAS|E?MBA|Executive MBA|Executive Master|(?:Certificate|Diploma|Master) of Advanced Studies)(?:\s*\/\s*|\s+))+(?:(?:FHNW|ZHAW|BFH|HSG)\s+)?(?:(?:in|en|of|in the|on|für|de|des|du)\s+)?[-–:]?\s*/i

/** A master's thesis or a closing module listed like an offer is no programme of its own. */
const NOT_AN_OFFER = /master-?thesis|masterarbeit|mastermodul|^(?:CAS|DAS|MAS)(?:-Abschluss)?$/i

/**
 * Words of continuing education the general classifier misses: counselling,
 * schools, care, building, public administration. Checked before CH_TITLES,
 * the first match decides, so the specific ones come first.
 */
const WB_TITLES: Array<[RegExp, string[]]> = [
  [/pflege: mental health|mental health nurse|psychiatrische pflege/i, ['nursing', 'psychology']],
  [/seelsorge|spiritual care|glaubensfragen|katechese|religionsunterricht/i, ['religious-studies']],
  [/ethische reflexion|medizinethik/i, ['philosophy', 'medicine']],
  [/laufbahnberatung|berufswahl|von der schule zum beruf|gestion des carrières/i, ['psychology', 'education']],
  [/\binstrument\b|instrumental|orgel|chorleitung|blasorchester|blasmusik|dirigier|vocal|singstimme|bambusflöte/i, ['music']],
  [/sucht|abhängigkeit/i, ['social-work', 'psychology']],
  [/kommunikationspsychologie|marketingpsychologie|konsum/i, ['psychology', 'marketing']],
  [/psycholog|psychotherap|verhaltenstherap|thérapie comportementale|psychoonkologie|psychisch|psychosozial|mental(?:e)? health|mentale gesundheit|mindfulness|pleine conscience|motivational interviewing|essstörung|persönlichkeitsentwicklung|tiergestützt|imaginativ|développement de l.enfant/i, ['psychology']],
  [/kindesschutz|erwachsenenschutz|mandatsführung|sozialpädagog|jugendhilfe|jugendarbeit|teilhabe|opferhilfe|sozialberatung|soziale sicherheit|sozialhilfe|schulsozialarbeit|soziale(?:n)? arbeit|soziale diagnostik|altersarbeit|arbeitsintegration|eingliederung|migrationssensib|sozialmanagement|caring|home treatment|droits de l.enfant/i, ['social-work']],
  [/mediation|médiation|konflikt|conflict|peacebuilding|dealing with the past/i, ['political-science', 'psychology']],
  [/case management/i, ['social-work', 'business-management']],
  [/schulpraxis|lerncoaching|an schulen/i, ['education', 'psychology']],
  [/(?<!denkmal)pflege|nursing|soins|palliative|geriatrie|intensivstation|\bapn\b|perinatal|laktation|reproduktive gesundheit|demenz|notfallsituationen|primary care|clinical assessment|study nurse/i, ['nursing']],
  [/systemisch|coaching|coach\b|supervision|beratung|beraten|teamdynamik|counsel|mentoring|organisationsentwicklung|organisationsberatung|organisationsdynamik|prozessbegleitung|facilitator|resilienz/i, ['psychology', 'business-management']],
  [/médecine légale|justice et médecine/i, ['law', 'medicine']],
  [/sozialversicherungsrecht|sozialrecht|arbeitsrecht|umweltrecht|versicherungsrecht|arbitration|juristische|\bdroits?\b|justice|justicia|beschaffung/i, ['law']],
  [/öffentliches gemeinwesen|einwohnerdienste|gemeindeschreiber|gemeindeverwalter|bauverwalter|steuerfachleute|politiques sociales|alterspolitik|public affairs|lobbying/i, ['political-science', 'law']],
  [/polizei|policing/i, ['criminology']],
  [/schulleitung|schulentwicklung|schulpraxis|unterricht|lehrkräfte|hochschuldidaktik|hochschullehre|lerncoaching|lernbegleitung|förderdiagnostik|begab|bildungsmanagement|kompetenzmanagement|erwachsenenbildung|formation des adultes|formations? en ligne|formateur|ausbildungsmanagement|praxisausbildung|kulturelle bildung|kulturvermittlung|future learning|enseigner|apprentissages|scolaire|grundkompetenz|stark am start|zyklus 1|verhaltensauffälligkeit/i, ['education']],
  [/clinical research|clinical trial|recherche clinique|medicines development|regulatory affairs|offizinpharmazie|3rs/i, ['pharmacy', 'medicine']],
  [/versicherungsmedizin|sexologie|ernährungsmedizin/i, ['medicine']],
  [/ernährung|nutrition|nahrungsmittel|kostformen|\bfood\b/i, ['nutrition']],
  [/craniocervical|functional movement|bewegung und training/i, ['physiotherapy', 'sports-science']],
  [/neurophysiotherap|neurorehabilitation/i, ['physiotherapy', 'neuroscience']],
  [/gerontologie|altern\b|alter\(n\)|50\+/i, ['public-health', 'social-work']],
  [/holz|brandschutz/i, ['civil-engineering', 'architecture']],
  [/héritage culturel: musée|provenienz/i, ['history', 'fine-arts']],
  [/denkmalpflege|umnutzung|héritage culturel|bâti/i, ['architecture', 'history']],
  [/gebäude/i, ['energy-engineering', 'civil-engineering']],
  [/beton|\bbau|bauen\b|baukost|bauorganisation|bauqualität|bauprojekt|bauleitung|leitungsbau|infrastruktur|siedlungsentwässerung|naturgefahren|strassenverkehr|\bvdc\b|\bipd\b/i, ['civil-engineering']],
  [/bahn|railway/i, ['civil-engineering', 'logistics']],
  [/quartier|siedlung|urbaner? räume/i, ['urban-planning']],
  [/triebfahrzeuge|antriebe|power grids|mikroelektronik|sensor|akustik/i, ['electrical-engineering']],
  [/embedded/i, ['computer-engineering']],
  [/software/i, ['computer-science']],
  [/security incident|network & security|cybersecurity|it security/i, ['cybersecurity']],
  [/requirements engineering|information technology|it principles|spring application|blockchain|prozessdigitalisierung|data intelligence|data-driven|generative data|digital responsibility|digital industry|digitale organisation|digitale transformation/i, ['information-systems', 'computer-science']],
  [/data (?:product )?engineering/i, ['statistics-data-science', 'computer-science']],
  [/ui-engineering|web-experience/i, ['ux-design', 'computer-science']],
  [/\bki\b|künstliche intelligenz/i, ['artificial-intelligence', 'business-management']],
  [/\bhrm?\b|human resource|personalentwicklung|personal- und organisation|people governance|human centered organization|human factors/i, ['business-management', 'psychology']],
  [/controlling|unternehmensrechnung|ifrs/i, ['finance-accounting']],
  [/kommunikationsmanagement/i, ['media-communication']],
  [/agentic commerce/i, ['marketing', 'artificial-intelligence']],
  [/kulturmanagement|politiques et pratiques culturelles/i, ['fine-arts', 'business-management']],
  [/diversity|gleichstellung|harcèlement|analyse des populations/i, ['sociology']],
  [/dokumentarfilm/i, ['film-production']],
  [/design literacy|signaletik/i, ['graphic-design']],
  [/artistic literacy|art & peace|research in the arts/i, ['fine-arts']],
  [/bodenkartierung|waldmanagement|ökobilanz|clean production/i, ['environmental-science']],
  [/verwaltungsrat|corruption|korruption/i, ['business-management', 'law']],
]

/** Broad words that decide only where neither the rules nor the classifier found a field. */
const WB_FALLBACK: Array<[RegExp, string[]]> = [
  [/santé|health|gesundheit/i, ['public-health']],
  [/nachhaltig|sustainab|durable|\besg\b|klima/i, ['environmental-science']],
  [/führung|leadership|leiten von teams|management|organisation|agil|change|transformation|operational excellence|strategi|selbstmanagement|geschäftsentwicklung|\bnpo\b|verwaltungsrat|projektdesign|\bE?MBA\b|executive master/i, ['business-management']],
]

/**
 * Fields the classifier takes from a single word that means something else
 * here: «AI Engineering», «Mastering Agile», «Opferhilfe (integral)»,
 * «Marketing Automation», «Coach & Catalyst». They count only with their own words.
 */
const SPURIOUS: Record<string, RegExp> = {
  'mechanical-engineering': /mechani|maschinen/i,
  'music-production': /musi|audio|sound/i,
  mathematics: /mathemati/i,
  'robotics-mechatronics': /robot|mechatron/i,
  chemistry: /chemi/i,
}

/** Fields from the name without its type: «CAS in Data Science» is about data science. */
export function offerFields(name: string): { fields: string[]; confidence: number } {
  const title = name.replace(TYPE_PREFIX, '')
  if (NOT_AN_OFFER.test(name.trim()) || NOT_AN_OFFER.test(title)) return { fields: [], confidence: 0 }
  const known = WB_TITLES.find(([re]) => re.test(title)) ?? CH_TITLES.find(([re]) => re.test(title))
  if (known) return { fields: known[1], confidence: 0.85 }
  const found = fieldsForTitle(title)
  const fields = found.fields.filter((f) => !SPURIOUS[f] || SPURIOUS[f].test(title))
  if (fields.length) return { fields, confidence: found.confidence }
  const broad = WB_FALLBACK.find(([re]) => re.test(name))
  return broad ? { fields: broad[1], confidence: 0.6 } : { fields: [], confidence: 0 }
}

const campus = (s: string | undefined) => {
  const town = s?.trim()
  return town && CAMPUS_CANTON[town] ? town : undefined
}

const fee = (n: unknown) => (typeof n === 'number' && n >= 500 && n <= 200_000 ? Math.round(n) : undefined)

/** A page, asked up to three times: a timeout or a server error is often gone a moment later. */
export async function patient(url: string, request = fetchSite, timeout = 60_000): Promise<{ status: number; text: string }> {
  let res = { status: 0, text: '' }
  for (let i = 0; i < 3; i++) {
    res = await request(url, timeout)
    if (res.status === 200 || (res.status >= 400 && res.status < 500)) return res
  }
  return res
}

const dedupe = (xs: Offer[]) => {
  const seen = new Set<string>()
  return xs.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true)))
}

// FHNW: its site search returns every offer with type, language, place and fee.
interface FhnwItem {
  '@id'?: string
  title?: string
  continuing_education_type?: { token?: string } | null
  languages_used?: Array<{ token?: string }> | null
  location?: Array<{ title?: string }> | null
  fee_int?: number | null
}
const FHNW_TYPES: Record<string, [ContinuingLevel, string]> = { cas: ['cas', 'CAS'], das: ['das', 'DAS'], mas: ['mas', 'MAS'], mba: ['mas', 'MBA'] }

export function fhnwOffers(json: string, _base: string, level: ContinuingLevel): Offer[] {
  const items = (JSON.parse(json) as { items?: FhnwItem[] }).items ?? []
  const out: Offer[] = []
  for (const x of items) {
    const url = x['@id']
    const type = FHNW_TYPES[x.continuing_education_type?.token ?? '']
    // The sandbox holds test pages; robots.txt keeps readers out of it.
    if (!url || !x.title || !type || type[0] !== level || !/^https:\/\/www\.fhnw\.ch\/de\//.test(url) || /\/sandkasten\//.test(url)) continue
    const languages = [...new Set((x.languages_used ?? []).map((l) => l.token).filter((l): l is string => !!l && /^[a-z]{2}$/.test(l)))]
    out.push({
      name: offerName(type[1], x.title),
      level,
      url,
      institution: /^https:\/\/www\.fhnw\.ch\/de\/ph\//.test(url) ? 'Pädagogische Hochschule FHNW' : undefined,
      languages: languages.length ? languages : undefined,
      city: (x.location ?? []).map((l) => campus(l.title)).find(Boolean),
      fee: fee(x.fee_int),
    })
  }
  return dedupe(out)
}

/** Every page of the FHNW search; null where the total does not add up. */
export async function fhnwLoad(url: string, request = fetchSite): Promise<string | null> {
  const items: unknown[] = []
  try {
    for (let start = 0; ; start = items.length) {
      const res = await patient(`${url}&b_start=${start}`, request, 120_000)
      if (res.status !== 200) return null
      const page = JSON.parse(res.text) as { items?: unknown[]; items_total?: number }
      if (!Array.isArray(page.items) || !Number.isInteger(page.items_total)) return null
      items.push(...page.items)
      if (items.length >= page.items_total!) break
      if (!page.items.length) return null
    }
  } catch {
    return null
  }
  return JSON.stringify({ items })
}

// BFH: the offer pages use the same search as the degree programmes; each card names its type and title.
export function bfhCards(html: string, _base: string, level: ContinuingLevel): Offer[] {
  const out: Offer[] = []
  for (const m of html.matchAll(/<a href="(https:\/\/www\.bfh\.ch\/de\/weiterbildung\/[a-z-]+\/[a-z0-9-]+\/)">\s*<div class="teaser-body">([\s\S]*?)<\/div>\s*<\/a>/g)) {
    const type = text(/<ul class="[^"]*title-categories[^"]*">([\s\S]*?)<\/ul>/.exec(m[2])?.[1] ?? '')
    const title = text(/<h2 class="teaser-title">([\s\S]*?)<\/h2>/.exec(m[2])?.[1] ?? '')
    if (!title || levelOf(type) !== level) continue
    out.push({ name: offerName(type.split(' ')[0], title), level, url: m[1] })
  }
  return dedupe(out)
}

// ZHAW: the offer finder, filtered by type, twelve cards per page.
const ZHAW_FINDER = 'https://www.zhaw.ch/de/weiterbildung/finden-sie-ihr-angebot'
const zhawPage = (type: string, page: number) => `${ZHAW_FINDER}?tx_solr%5Bfilter%5D%5B0%5D=graduation%3A${type}&tx_solr%5Bq%5D=%2A&tx_solr%5Bpage%5D=${page}`

export function zhawCards(html: string, base: string, level: ContinuingLevel): Offer[] {
  const out: Offer[] = []
  for (const m of html.matchAll(/<a href="(\/de\/[a-z-]+\/weiterbildung\/detail\/kurs\/[a-z0-9-]+)">\s*<div class="card\b([\s\S]*?)<\/a>/g)) {
    const title = text(/<p class="title[^"]*">([\s\S]*?)<\/p>/.exec(m[2])?.[1] ?? '')
    if (!title) continue
    const ects = Number(/\((\d{1,3})\s*ECTS\)/.exec(text(/<p class="graduation">([\s\S]*?)<\/p>/.exec(m[2])?.[1] ?? ''))?.[1])
    const venue = /venue-title[^>]*>[\s\S]*?<\/span>([\s\S]*?)<\/p>/.exec(m[2])?.[1]
    out.push({ name: offerName(level.toUpperCase(), title), level, url: new URL(m[1], base).href, ects: ects >= 5 && ects <= 120 ? ects : undefined, city: campus(text(venue ?? '')) })
  }
  return dedupe(out)
}

/**
 * Every page of one type; null where the pages end well before the stated
 * number of results. The count includes the odd offer listed twice, so a
 * few missing links are no gap.
 */
export async function zhawLoad(url: string, request = fetchSite): Promise<string | null> {
  const type = /graduation%3A([A-Z]+)/.exec(url)?.[1]
  if (!type) return null
  const pages: string[] = []
  const urls = new Set<string>()
  let total = Infinity
  for (let page = 1; page <= 80 && urls.size < total; page++) {
    const res = await patient(zhawPage(type, page), request)
    if (res.status !== 200) return null
    const found = [...res.text.matchAll(/href="(\/de\/[a-z-]+\/weiterbildung\/detail\/kurs\/[a-z0-9-]+)"/g)].map((m) => m[1])
    const fresh = found.filter((u) => !urls.has(u))
    if (page === 1) total = Number(/(\d[\d’']*)\s+Ergebnisse/.exec(res.text)?.[1].replace(/[’']/g, '') ?? NaN)
    if (!Number.isFinite(total) || !fresh.length) break
    fresh.forEach((u) => urls.add(u))
    pages.push(res.text)
  }
  if (urls.size < total * 0.97) {
    log(`ZHAW ${type}: ${urls.size} of ${total} offers read; previous data will be retained`)
    return null
  }
  return pages.join('\n')
}

// Universität Basel: Advanced Studies lists each type on a page of its own.
export function unibasCards(html: string, base: string, level: ContinuingLevel): Offer[] {
  const out: Offer[] = []
  for (const m of html.matchAll(/<a href="(\/studienangebot\/kurs\/[a-z0-9-]+)"[^>]*>\s*<h2>([\s\S]*?)<\/h2>/g)) {
    const name = text(m[2])
    if (levelOf(name) !== level) continue
    out.push({ name: offerName(level.toUpperCase(), name), level, url: new URL(m[1], base).href })
  }
  return dedupe(out)
}

// Université de Genève: one page holds every card, with its type and language as attributes.
const UNIGE_TYPES: Record<string, ContinuingLevel> = { CAS: 'cas', DAS: 'das', MAS: 'mas', MBA: 'mas' }

export function unigeCards(html: string, _base: string, level: ContinuingLevel): Offer[] {
  const out: Offer[] = []
  for (const m of html.matchAll(/<a href="(https:\/\/www\.unige\.ch\/formcont\/cours\/[^"]+)"\s+class="programme-card[^"]*"([^>]*)>/g)) {
    const attr = (k: string) => decode(new RegExp(`data-${k}="([^"]*)"`).exec(m[2])?.[1] ?? '').trim()
    // Past sessions stay listed; they take no one any more.
    if (UNIGE_TYPES[attr('type')] !== level || attr('past') !== '0' || !attr('title')) continue
    out.push({ name: offerName(attr('type') === 'MBA' ? 'Executive MBA' : attr('type'), attr('title')), level, url: m[1], languages: languagesIn(attr('lang')) })
  }
  return dedupe(out)
}

// Universität Luzern: the continuing education menu links every programme by faculty.
export function uniluCards(html: string, base: string, level: ContinuingLevel): Offer[] {
  const out: Offer[] = []
  for (const m of html.matchAll(/<a href="(\/weiterbildung\/[a-z]+\/[a-z0-9-]+\/)(?:ueberblick\/)?"[^>]*title="([^"]+)"/g)) {
    const name = decode(m[2]).replace(/\s+/g, ' ').trim()
    // «MAS / CAS in …» is a master that can also be taken in parts: it counts as the master.
    if (levelOf(name) !== level) continue
    out.push({ name: offerName(level.toUpperCase(), name), level, url: new URL(m[1], base).href })
  }
  return dedupe(out)
}

/** A listed offer as a catalogue entry; null where it fits no field. */
export function toProgramme(x: Offer, inst: ChInstitution, fetchedAt: string): Programme | null {
  const { fields, confidence } = offerFields(x.name)
  if (!fields.length) return null
  return {
    id: programmeId(['ch-wb', inst.id, x.url]),
    name: x.name,
    institution: inst.name,
    country: 'CH',
    city: x.city ?? inst.city,
    region: (x.city && CAMPUS_CANTON[x.city]) || inst.canton,
    level: x.level,
    fields: fields.slice(0, 3),
    fieldConfidence: Math.round(confidence * 100) / 100,
    languages: x.languages,
    ects: x.ects,
    url: x.url,
    institutionUrl: inst.url,
    institutionType: inst.type,
    public: true,
    tuition: x.fee ? { currency: 'CHF', domestic: x.fee, eu: x.fee, international: x.fee, total: true, note: 'Kosten des ganzen Programms laut Hochschule' } : undefined,
    source: 'ch-weiterbildung',
    updated: fetchedAt,
  }
}

type Reader = (body: string, base: string, level: ContinuingLevel) => Offer[]
const FHNW_SEARCH = 'https://www.fhnw.ch/++api++/de/@search?portal_type=ContinuingEducation&review_state=published&continuing_education_type=cas&continuing_education_type=das&continuing_education_type=mas&continuing_education_type=mba&b_size=500'
const UNIGE_LIST = 'https://www.unige.ch/formcont/formations-types/?cherche=&type=CAS'
const UNILU_LIST = 'https://www.unilu.ch/weiterbildung/'
const levels = (url: string, read: Reader, load?: (url: string) => Promise<string | null>) =>
  (['mas', 'das', 'cas'] as const).map((level) => ({ url, level, read, load }))

const SOURCES: Array<{ institution: string; lists: Array<{ url: string; level: ContinuingLevel; read: Reader; load?: (url: string) => Promise<string | null> }> }> = [
  {
    institution: 'ZHAW',
    lists: (['mas', 'das', 'cas'] as const).map((level) => ({ url: zhawPage(level.toUpperCase(), 1), level, read: zhawCards, load: zhawLoad })),
  },
  { institution: 'Fachhochschule Nordwestschweiz', lists: levels(FHNW_SEARCH, fhnwOffers, fhnwLoad) },
  {
    institution: 'Berner Fachhochschule',
    lists: [
      { url: 'https://www.bfh.ch/de/weiterbildung/emba-mas/main/searchFilter/', level: 'mas', read: bfhCards, load: bfhOffers },
      { url: 'https://www.bfh.ch/de/weiterbildung/das/main/searchFilter/', level: 'das', read: bfhCards, load: bfhOffers },
      { url: 'https://www.bfh.ch/de/weiterbildung/cas/main/searchFilter/', level: 'cas', read: bfhCards, load: bfhOffers },
    ],
  },
  {
    institution: 'Universität Basel',
    lists: [
      { url: 'https://advancedstudies.unibas.ch/studienangebot/kurse/master-of-advanced-studies-52/0', level: 'mas', read: unibasCards },
      { url: 'https://advancedstudies.unibas.ch/studienangebot/kurse/diploma-of-advanced-studies-53/0', level: 'das', read: unibasCards },
      { url: 'https://advancedstudies.unibas.ch/studienangebot/kurse/certificate-of-advanced-studies-54/0', level: 'cas', read: unibasCards },
    ],
  },
  { institution: 'Université de Genève', lists: levels(UNIGE_LIST, unigeCards) },
  { institution: 'Universität Luzern', lists: levels(UNILU_LIST, uniluCards) },
]

async function main() {
  const fetchedAt = new Date().toISOString()
  const programmes: Programme[] = []
  const notes: string[] = []
  for (const src of SOURCES) {
    const home = findChInstitution(src.institution)
    if (!home) throw new Error(`unknown institution ${src.institution}`)
    const fetched = new Map<string, string | null>()
    let unclassified = 0
    for (const l of src.lists) {
      if (!fetched.has(l.url)) fetched.set(l.url, l.load ? await l.load(l.url) : await patient(l.url).then((r) => (r.status === 200 ? r.text : null)))
      const body = fetched.get(l.url)
      const found = body ? l.read(body, l.url, l.level) : []
      if (!found.length) {
        const warning = `${home.name}: empty ${l.level} list; the build retains this group from the previous data`
        notes.push(warning)
        log(warning)
      }
      for (const x of found) {
        const inst = (x.institution && findChInstitution(x.institution)) || home
        const p = toProgramme(x, inst, fetchedAt)
        if (p) programmes.push(p)
        else unclassified++
      }
      log(`${home.name}: ${found.length} ${l.level.toUpperCase()} listed`)
    }
    log(`${home.name}: ${unclassified} without a field`)
  }
  log(`Swiss continuing education: ${programmes.length} programmes`)
  if (programmes.length < 300) throw new Error(`only ${programmes.length} programmes, a site may have changed`)
  const out: ScrapeOutput = { source: 'ch-weiterbildung', fetchedAt, programmes, ...(notes.length ? { notes } : {}) }
  writeJson(join(OUT, 'ch-weiterbildung.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
