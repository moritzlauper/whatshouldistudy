import { occupationsForJob } from '../lib/work/occupations.ts'
import { isCurrentJob, jobUrl } from '../lib/work/types.ts'
import type { Job, JobSource, Sector } from '../lib/work/types.ts'
import { cleanJobText, concreteJob, entryFromTitle, swissCountry } from './lib/job-facts.ts'
import type { siteReader } from './lib/site-fetch.ts'

type Read = ReturnType<typeof siteReader>
type Row = Record<string, unknown>
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
const text = (value: unknown) => typeof value === 'string' ? cleanJobText(value) : ''
// The apprenticeship feed omits country, but supplies a canton. Match only
// explicit Swiss cantons; Liechtenstein and unknown regions stay excluded.
const SWISS_CANTONS = new Set('Zürich|Bern|Berne|Luzern|Uri|Schwyz|Obwalden|Nidwalden|Glarus|Zug|Freiburg|Fribourg|Solothurn|Basel-Stadt|Basel-Landschaft|Basel-Land|Basel Land|Schaffhausen|Appenzell Ausserrhoden|Appenzell Innerrhoden|St. Gallen|Graubünden|Aargau|Thurgau|Tessin|Ticino|Waadt|Vaud|Wallis|Valais|Neuenburg|Neuchâtel|Genf|Genève|Jura'.split('|'))
const date = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid job date')
  return new Date(value).toISOString()
}

/** Employer brands, not the occupation of the person being recruited. Unknown
 * brands remain unknown instead of inheriting retail from the entire group. */
export function coopSector(company: string): Sector | undefined {
  if (/^(?:Coop|coop.ch|Coop City|Coop Pronto|Coop Trading|Coop Bau\+Hobby|JUMBO|Interdiscount|CHRIST Uhren & Schmuck|Import Parfumerie|Livique|Lumimart|Fust|Saviva|Transgourmet Schweiz AG|Transgourmet\/Prodega|Prodega)$/i.test(company)) return 'retail'
  if (/^(?:HALBA|Sunray|Steinfels Swiss|Reismühle Nutrex|Pearlwater(?: Mineralquellen AG)?|Swissmill|Bell Schweiz AG|Panofina)$/i.test(company)) return 'industry'
  if (/^railcare(?: AG)?$/i.test(company)) return 'transport'
  if (/^(?:Coop Restaurant|Marché(?: Restaurants Schweiz(?: AG)?)?|Two Spice|BÂLE HOTELS GROUP|Hôtel du Léman|Tropenhaus Frutigen)$/i.test(company)) return 'hospitality'
  if (company === 'Coop Depositenkasse') return 'finance'
  return undefined
}

/** Select factual fields only. No descriptions, recruiter contacts or application
 * URLs are retained. A requisition ID merges translated/repeated publications. */
export function parseFeedJob(value: unknown, source: JobSource, checkedAt: string): Job | null {
  const row = object(value)
  const attrs = object(row.attributes)
  const facts = object(row.szas)
  const attribute = (key: string) => Array.isArray(attrs[key]) ? (attrs[key] as unknown[]).map(text).filter(Boolean).join(' · ') : ''
  const fact = (key: string) => text(facts[key])
  const title = text(row.title)
  const url = jobUrl(text(object(row.links).directlink))
  if (!title || !url || !text(row.id)) throw new Error('Invalid feed job')
  const expectedHosts = source.id === 'Coop' ? ['jobs.coopjobs.ch', 'jobs.fust.ch', 'jobs.transgourmet.ch'] : source.id === 'Bund' ? ['jobs.admin.ch'] : ['jobs.sbb.ch']
  if (!expectedHosts.includes(new URL(url).hostname)) throw new Error('Unexpected advert host')
  if (!concreteJob(title)) return null

  let country = '', region = '', city = '', company = source.name, department = '', employment = ''
  let workplace: Job['workplace'] = 'unknown'
  let entry = entryFromTitle(title)
  let sector = source.sector
  let reference = text(row.id)
  if (source.id === 'Coop') {
    country = fact('sza_workplace.country')
    region = fact('sza_workplace.region') || fact('sza_location.region') || attribute('30')
    if (!country && SWISS_CANTONS.has(region)) country = 'CH'
    city = fact('sza_workplace.city') || fact('sza_location.city')
    company = attribute('70') || company
    department = attribute('20')
    employment = fact('sza_pensum')
    sector = coopSector(company)
    const code = fact('sza_reference_code')
    if (/^\d+$/.test(code)) reference = code
    // Schnupperlehren are visits, not vacancies. Ordinary apprenticeships count.
    if (/schnupper/i.test(title) || (attribute('360') && !/^(?:keine|non|no |pas)/i.test(attribute('360')))) return null
    if (attribute('350') && !/^keine Lehrstelle$/i.test(attribute('350'))) entry = 'training'
    else if (/Führungskräfte|Kader/i.test(attribute('50'))) entry = 'experienced'
  } else if (source.id === 'Bund') {
    country = fact('sza_location.country') || attribute('land')
    region = fact('sza_location.region') || attribute('region')
    city = attribute('arbeitsort') || fact('sza_location.city')
    // The most specific unit, rather than the parent federal department.
    const units = Object.keys(attrs).filter((key) => key.startsWith('verwaltungseinheit_'))
    company = (units.length ? attribute(units[units.length - 1]) : attribute('verwaltungseinheit')) || company
    department = attribute('taetigkeitsbereich')
    const min = fact('sza_pensum.min'), max = fact('sza_pensum.max')
    if (/^\d+$/.test(min) && /^\d+$/.test(max)) employment = min === max ? `${min}%` : `${min}–${max}%`
    if (attribute('125') === 'true') workplace = 'hybrid'
    if (/Lernende|Lehrstellen|Praktik/i.test(attribute('25'))) entry = 'training'
    // Public requisition identifier only; never store the application URL.
    try {
      const code = new URL(fact('sza_apply_link')).searchParams.get('career_job_req_id')
      if (code && /^\d+$/.test(code)) reference = code
    } catch { /* some organisations use a different application system */ }
  } else if (source.id === 'SBB') {
    country = attribute('65')
    region = attribute('110')
    city = attribute('100')
    department = attribute('20')
    employment = attribute('160') || attribute('50')
    if (/Hochschulabsolvent|Lehrabgänger/i.test(attribute('60'))) entry = 'junior'
    else if (/Fach- und Führungskader|Berufserfahrene/i.test(attribute('60'))) entry = 'experienced'
  } else throw new Error('Unknown feed source')

  // Some federal adverts incorrectly set country=Schweiz for foreign postings.
  // The source's explicit Ausland region takes precedence over that default.
  if (!swissCountry(country) || /Ausland|étranger|estero|abroad/i.test(region)) return null
  if (!city) throw new Error('Missing Swiss work location')
  const postedAt = date(row.start_date)
  if (postedAt && Date.parse(postedAt) > Date.parse(checkedAt)) return null
  const job: Job = {
    id: `${source.id}:${reference}`, sourceId: source.id, title, company,
    city: city.replace(/,\s*(?:Schweiz|Switzerland|Suisse|Svizzera)$/i, ''), country: 'CH', url,
    workplace, entry, ...(sector ? { sector } : {}), ...(employment ? { employment } : {}),
    ...(department ? { department } : {}), postedAt, validThrough: date(row.end_date), checkedAt,
    occupationIds: occupationsForJob(title, department),
  }
  return isCurrentJob(job, Date.parse(checkedAt)) ? job : null
}

export async function scrapeJobFeed(source: JobSource, read: Read, checkedAt: string): Promise<Job[]> {
  if (!source.feedUrl) throw new Error('Missing public feed')
  const jobs: Job[] = []
  const seen = new Set<string>()
  let offset = 0
  let total: number | undefined
  for (let page = 0; page < 500; page++) {
    const url = new URL(source.feedUrl)
    if (source.format === 'prospective') url.search = new URLSearchParams({ lang: 'de', offset: String(offset), limit: '96' }).toString()
    const response = await read(url.href)
    if (response.status !== 200) throw new Error(`Public job feed HTTP ${response.status}`)
    const data: unknown = JSON.parse(response.text)
    const payload = object(data)
    const rows = source.format === 'sbb' ? data : payload.jobs
    const count = source.format === 'sbb' && Array.isArray(rows) ? rows.length : payload.total
    if (!Array.isArray(rows) || !Number.isInteger(count) || (count as number) < 0 || (count as number) > 50_000) throw new Error('Invalid public job feed')
    if (source.format === 'prospective' && payload.offset !== offset) throw new Error('Wrong feed offset')
    if (total !== undefined && total !== count) throw new Error('Job feed changed during pagination; retry next run')
    total = count as number
    if (offset + rows.length > total || (!rows.length && offset < total)) throw new Error('Incomplete job feed')
    for (const row of rows) {
      const id = text(object(row).id)
      if (!id || seen.has(id)) throw new Error('Repeated job feed page')
      seen.add(id)
      const job = parseFeedJob(row, source, checkedAt)
      if (job) jobs.push(job)
    }
    offset += rows.length
    if (offset === total) return [...new Map(jobs.map((job) => [job.id, job])).values()]
  }
  throw new Error('Incomplete job feed')
}
