import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { siteReader } from './lib/site-fetch.ts'
import { scrapeJobFeed } from './job-feeds.ts'
import { JOB_SOURCES } from '../lib/work/sources.ts'
import { occupationsForJob } from '../lib/work/occupations.ts'
import { isCurrentJob, jobUrl } from '../lib/work/types.ts'
import type { Job, JobsData, JobSource, SourceRun, Workplace } from '../lib/work/types.ts'

import { cleanJobText, entryFromTitle } from './lib/job-facts.ts'
export { cleanJobText, entryFromTitle } from './lib/job-facts.ts'

type Read = ReturnType<typeof siteReader>
type Listing = { title: string; city: string; url: string }


const attr = (tag: string, name: string) => new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1] ?? ''

/** Public HTML pagination; each group declares its complete number of adverts. */
export function parseJobList(html: string): Listing[] {
  const groups = [...html.matchAll(/<section\b([^>]*\bdata-qty=[^>]*)>([\s\S]*?)<\/section>/gi)]
  if (!groups.length) {
    if (/No job postings are currently available/i.test(html)) return []
    throw new Error('Unrecognised career list')
  }
  const jobs: Listing[] = []
  for (const [, attributes, body] of groups) {
    const heading = cleanJobText(/<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(body)?.[1] ?? '')
    const links = [...body.matchAll(/<a\b([^>]*\bhref=[^>]*)>([\s\S]*?)<\/a>/gi)].filter(([, a]) => /js-job-ad-link/.test(a))
    if (links.length !== Number(attr(attributes, 'data-qty'))) throw new Error('Incomplete job group')
    for (const [, a, b] of links) {
      const url = jobUrl(cleanJobText(attr(a, 'href')))
      const title = cleanJobText(/<h4[^>]*>([\s\S]*?)<\/h4>/i.exec(b)?.[1] ?? '')
      const detail = cleanJobText(/<span[^>]*margin--right--s[^>]*>([\s\S]*?)<\/span>/i.exec(b)?.[1] ?? '')
      const place = /,\s*(Switzerland|Schweiz|Suisse|Svizzera)$/i.test(heading) ? heading : detail
      if (!url || !title || !place) throw new Error('Invalid job in career list')
      // A Swiss headquarters is not enough: only the advertised work location counts.
      if (/,\s*(Switzerland|Schweiz|Suisse|Svizzera)$/i.test(place)) jobs.push({ url, title, city: place.replace(/,\s*[^,]+$/, '') })
    }
  }
  return jobs
}

/** Location/department groups have their own public "Show more jobs" pages. */
export async function completeJobGroups(html: string, source: JobSource, read: Read): Promise<string> {
  let completed = html
  for (const group of html.matchAll(/<section\b([^>]*\bdata-qty=[^>]*)>([\s\S]*?)<\/section>/gi)) {
    const expected = Number(attr(group[1], 'data-qty'))
    let body = group[2]
    const links = () => [...body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*js-job-ad-link[^"']*["']/gi)].map((m) => m[1])
    const more = /<a\b[^>]*data-more=[^>]*>/i.exec(body)?.[0]
    if (links().length < expected) {
      if (!more) throw new Error('Missing group pagination')
      const endpoint = new URL(attr(more, 'data-more'), source.url)
      const type = attr(more, 'data-type')
      if (endpoint.href !== `${source.url}api/more` || !['location', 'department'].includes(type)) throw new Error('Unexpected group pagination')
      for (let page = 1; links().length < expected && page < 100; page++) {
        endpoint.search = new URLSearchParams({ page: String(page), type, value: decodeURIComponent(attr(more, 'data-value')) }).toString()
        const next = await read(endpoint.href)
        if (next.status !== 200) throw new Error(`Group page HTTP ${next.status}`)
        const before = links().length
        body += next.text
        const after = links()
        if (after.length <= before || new Set(after).size !== after.length) throw new Error('Repeated or empty group page')
      }
    }
    if (links().length !== expected) throw new Error('Incomplete job group')
    completed = completed.replace(group[0], `<section ${group[1]}>${body}</section>`)
  }
  return completed
}


function fact(html: string, name: string): string {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attr(match[0], 'itemprop') === name) return cleanJobText(attr(match[0], 'content'))
  }
  return ''
}

export function parseJobDetail(html: string, listing: Listing, source: JobSource, checkedAt: string): Job {
  if (!/itemtype=["']https?:\/\/schema.org\/JobPosting["']/i.test(html)) throw new Error('Missing job facts')
  const country = fact(html, 'addressCountry')
  if (!/^(?:CH|Switzerland|Schweiz|Suisse|Svizzera)$/i.test(country)) throw new Error('Job location changed')
  const title = cleanJobText(/<h1[^>]*itemprop=["']title["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? '')
  if (!title) throw new Error('Missing job title')
  const location = /<spl-job-location\b[^>]*>/i.exec(html)?.[0] ?? ''
  const model = attr(location, 'workplaceType')
  const workplace: Workplace = model === 'on_site' ? 'onsite' : model === 'remote' ? 'remote' : model === 'hybrid' ? 'hybrid' : 'unknown'
  const employment = cleanJobText(/<li[^>]*itemprop=["']employmentType["'][^>]*>([\s\S]*?)<\/li>/i.exec(html)?.[1] ?? '')
  const organisation = /<div[^>]*itemprop=["']hiringOrganization["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? ''
  const date = (name: string) => { const value = fact(html, name); return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined }
  return {
    id: `${source.id}:${new URL(listing.url).pathname.split('/')[2].split('-')[0]}`,
    sourceId: source.id, title, company: fact(organisation, 'name') || source.name,
    city: fact(html, 'addressLocality') || listing.city, country: 'CH', url: listing.url,
    workplace, entry: entryFromTitle(title), ...(employment ? { employment } : {}),
    postedAt: date('datePosted'), validThrough: date('validThrough'), checkedAt,
    occupationIds: occupationsForJob(title),
  }
}

export async function scrapeJobSource(source: JobSource, read: Read, checkedAt: string): Promise<Job[]> {
  if (source.format) return scrapeJobFeed(source, read, checkedAt)
  const first = await read(source.url)
  if (first.status !== 200) throw new Error(`Career page HTTP ${first.status}`)
  const listings = parseJobList(await completeJobGroups(first.text, source, read))
  const pages = Number(/data-groups-pages=["'](\d+)["']/.exec(first.text)?.[1] ?? 1)
  if (pages < 1 || pages > 100) throw new Error('Invalid pagination')
  const signatures = new Set([listings.map((j) => j.url).join('|')])
  for (let page = 1; page < pages; page++) {
    const next = await read(`${source.url}api/groups?page=${page}`)
    if (next.status !== 200) throw new Error(`Career page ${page} HTTP ${next.status}`)
    const rows = parseJobList(await completeJobGroups(next.text, source, read))
    const signature = rows.map((j) => j.url).join('|')
    if (rows.length && signatures.has(signature)) throw new Error('Repeated career page')
    signatures.add(signature)
    listings.push(...rows)
  }
  const unique = [...new Map(listings.map((j) => [j.url, j])).values()]
  const jobs: Job[] = []
  for (const listing of unique) {
    const detail = await read(listing.url)
    if (detail.status === 404 || detail.status === 410) continue
    if (detail.status !== 200) throw new Error(`Job page HTTP ${detail.status}`)
    const job = parseJobDetail(detail.text, listing, source, checkedAt)
    if (isCurrentJob(job, Date.parse(checkedAt)) && !/spontan|unsolicited|talent pool|initiativbewerbung/i.test(job.title)) jobs.push(job)
  }
  return jobs
}

/** Failed reads retain the original check date. Successful complete reads remove closed jobs. */
export function mergeJobs(previous: JobsData | null, runs: Array<{ source: JobSource; jobs?: Job[]; error?: string }>, now: string, preserveOtherSources = false): JobsData {
  const jobs: Job[] = []
  const sources: SourceRun[] = []
  if (preserveOtherSources && previous) {
    const refreshed = new Set(runs.map((run) => run.source.id))
    const configured = new Set(JOB_SOURCES.map((source) => source.id))
    jobs.push(...previous.jobs.filter((job) => configured.has(job.sourceId) && !refreshed.has(job.sourceId) && isCurrentJob(job, Date.parse(now))))
    sources.push(...previous.sources.filter((source) => configured.has(source.id) && !refreshed.has(source.id)).map((source) => ({ ...source, count: jobs.filter((job) => job.sourceId === source.id).length })))
  }
  for (const run of runs) {
    const old = previous?.jobs.filter((j) => j.sourceId === run.source.id) ?? []
    const drop = old.length >= 10 && run.jobs !== undefined && run.jobs.length < old.length * 0.5
    const ok = run.jobs !== undefined && !drop
    const kept = (ok ? run.jobs! : old).filter((j) => isCurrentJob(j, Date.parse(now)))
    jobs.push(...kept)
    sources.push({ id: run.source.id, ok, checkedAt: now, count: kept.length, ...(!ok ? { error: drop ? 'Large unexpected drop; keeping previous check dates' : run.error || 'Read failed' } : {}) })
  }
  return { version: 1, generatedAt: now, jobs: [...new Map(jobs.map((j) => [j.id, j])).values()], sources }
}

async function main() {
  const args = process.argv.slice(2)
  const option = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
  const output = resolve(option('--out', 'data/jobs/current.json'))
  const prior = resolve(option('--previous', output))
  const selected = option('--sources', '').split(',').filter(Boolean)
  if (selected.some((id) => !JOB_SOURCES.some((source) => source.id === id))) throw new Error('Unknown job source')
  const targets = JOB_SOURCES.filter((source) => !selected.length || selected.includes(source.id))
  let previous: JobsData | null = null
  try { previous = JSON.parse(await readFile(prior, 'utf8')) as JobsData } catch { /* first run */ }
  const read = siteReader(1500)
  const now = new Date().toISOString()
  const runs: Array<{ source: JobSource; jobs?: Job[]; error?: string }> = []
  for (const source of targets) {
    try {
      const jobs = await scrapeJobSource(source, read, now)
      runs.push({ source, jobs })
      console.log(`${source.name}: ${jobs.length} Swiss vacancies`)
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Read failed'
      runs.push({ source, error })
      console.error(`${source.name}: ${error}`)
    }
  }
  const data = mergeJobs(previous, runs, now, selected.length > 0)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(`${output}.tmp`, `${JSON.stringify(data, null, 2)}\n`)
  await rename(`${output}.tmp`, output)
  const successes = data.sources.filter((source) => targets.some((target) => target.id === source.id) && source.ok).length
  console.log(`${data.jobs.length} vacancies; ${successes}/${targets.length} selected sources refreshed`)
  if (!successes) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
