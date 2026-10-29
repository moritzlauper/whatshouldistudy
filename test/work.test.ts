import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { matchOccupations, companyFit, rankCompanies, rankJobs } from '../lib/work/matching.ts'
import { OCCUPATIONS, occupationsForJob } from '../lib/work/occupations.ts'
import { DEFAULT_WORK_PREFERENCES, isCurrentJob, jobUrl } from '../lib/work/types.ts'
import type { Job, JobsData } from '../lib/work/types.ts'
import { JOB_SOURCES } from '../lib/work/sources.ts'
import { INTEREST_ITEMS } from '../lib/engine/questionnaire.ts'
import { FIELD_BY_ID } from '../lib/taxonomy/fields.ts'
import { routes } from '../lib/site/config.ts'
import { switchHref } from '../lib/site/switch.ts'
import { dict } from '../lib/site/dict.ts'
import { cleanJobText, completeJobGroups, entryFromTitle, mergeJobs, parseJobDetail, parseJobList, scrapeJobSource } from '../scrapers/jobs.ts'

const now = '2026-10-13T10:00:00.000Z'
const job: Job = { id: 'Swissquote:123', sourceId: 'Swissquote', title: 'Junior Software Engineer', company: 'Example Bank', city: 'Zürich', country: 'CH', url: 'https://jobs.smartrecruiters.com/Swissquote/123-software', workplace: 'unknown', entry: 'junior', checkedAt: now, occupationIds: ['software'] }
const source = JOB_SOURCES[0]
const link = (id: number, title: string, place: string) => `<li><a href="https://jobs.smartrecruiters.com/Swissquote/${id}-job" class="details js-job-ad-link"><h4>${title}</h4><p><span class="margin--right--s">${place}</span></p></a></li>`
const group = (heading: string, jobs: string, count = 1) => `<section data-qty="${count}"><h3>${heading}</h3><ul>${jobs}</ul></section>`
const detail = `<main itemtype="http://schema.org/JobPosting"><h1 itemprop="title">Junior Software Engineer</h1><spl-job-location workplaceType="hybrid"></spl-job-location><meta itemprop="addressCountry" content="Switzerland"><meta itemprop="addressLocality" content="Zürich"><li itemprop="employmentType">Full-time</li><div itemprop="hiringOrganization"><meta itemprop="name" content="Example Bank"></div><meta itemprop="datePosted" content="2026-10-01"><meta itemprop="validThrough" content="2026-11-01"></main>`

test('Swiss job lists accept department and location groups and exclude jobs abroad', () => {
  const rows = parseJobList(group('IT', link(1, 'Software &amp; Data', 'Zürich, Switzerland') + link(2, 'Software', 'London, United Kingdom'), 2) + group('Lausanne, Switzerland', link(3, 'Nursing', 'Part-time')))
  assert.deepEqual(rows.map((j) => [j.title, j.city]), [['Software & Data', 'Zürich'], ['Nursing', 'Lausanne']])
  assert.throws(() => parseJobList(group('IT', link(1, 'Developer', 'Bern, Switzerland'), 2)), /Incomplete/)
  assert.throws(() => parseJobList('<html>Something went wrong</html>'), /Unrecognised/)
  assert.deepEqual(parseJobList('No job postings are currently available'), [])
})

test('nested public pagination completes a group and rejects repeated pages', async () => {
  const first = group('Zürich, Switzerland', link(1, 'Developer', 'Full-time') + '<a data-page="0" data-value="Z%C3%BCrich%2C%20CH" data-type="location" data-more="/Swissquote/api/more">More</a>', 2)
  const urls: string[] = []
  const completed = await completeJobGroups(first, source, async (url) => { urls.push(url); return { status: 200, text: link(2, 'Analyst', 'Part-time') } })
  assert.equal(parseJobList(completed).length, 2)
  assert.equal(new URL(urls[0]).searchParams.get('value'), 'Zürich, CH')
  assert.equal(new URL(urls[0]).searchParams.get('type'), 'location')
  await assert.rejects(completeJobGroups(first, source, async () => ({ status: 200, text: link(1, 'Developer', 'Full-time') })), /Repeated/)
  await assert.rejects(completeJobGroups(first.replace('/Swissquote/api/more', 'https://evil.example/'), source, async () => { throw new Error('Must not fetch') }), /Unexpected/)
})

test('scraper reads all pages and a disappearing advert is omitted', async () => {
  const urls: string[] = []
  const read = async (url: string) => {
    urls.push(url)
    if (url === source.url) return { status: 200, text: `<div data-groups-pages="2">${group('IT', link(1, 'Software', 'Bern, Switzerland'))}</div>` }
    if (url.includes('/api/groups')) return { status: 200, text: group('IT', link(2, 'Software', 'Bern, Switzerland')) }
    if (url.includes('/1-job')) return { status: 200, text: detail }
    return { status: 410, text: '' }
  }
  const jobs = await scrapeJobSource(source, read, now)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].workplace, 'hybrid')
  assert.equal(urls.length, 4)
})

test('job facts come from structured fields, with unknowns preserved', () => {
  const listing = { title: 'ignored', city: 'Bern', url: job.url }
  const parsed = parseJobDetail(detail, listing, source, now)
  assert.equal(parsed.company, 'Example Bank')
  assert.equal(parsed.city, 'Zürich')
  assert.equal(parsed.entry, 'junior')
  assert.deepEqual(parsed.occupationIds, ['software'])
  assert.equal(parseJobDetail(detail.replace('workplaceType="hybrid"', ''), listing, source, now).workplace, 'unknown')
  assert.throws(() => parseJobDetail(detail.replace('content="Switzerland"', 'content="Germany"'), listing, source, now), /location changed/)
})

test('job links exclude scripts, spoofed hosts, credentials and arbitrary paths', () => {
  for (const url of ['javascript:alert(1)', 'http://jobs.smartrecruiters.com/A/1', 'https://jobs.smartrecruiters.com.evil.test/A/1', 'https://user:pass@jobs.smartrecruiters.com/A/1', 'https://jobs.smartrecruiters.com/api/private']) assert.equal(jobUrl(url), null)
  assert.equal(jobUrl(`${job.url}?tracking=foo#anchor`), job.url)
  assert.equal(cleanJobText('Sant&#233; &amp; soins &#x1f9ea;'), 'Santé & soins 🧪')
})

test('expiry, stale checks and invalid dates cannot appear as current', () => {
  const at = Date.parse(now)
  assert.equal(isCurrentJob(job, at), true)
  assert.equal(isCurrentJob(job, at + 7 * 86400_000), false)
  assert.equal(isCurrentJob({ ...job, checkedAt: 'bad' }, at), false)
  assert.equal(isCurrentJob({ ...job, validThrough: '2026-10-12' }, at), false)
  assert.equal(isCurrentJob({ ...job, validThrough: 'bad' }, at), false)
  assert.equal(isCurrentJob({ ...job, checkedAt: '2030-01-01' }, at), false)
})

test('failed sources retain old timestamps, full refreshes remove closed jobs, old jobs expire', () => {
  const previous: JobsData = { version: 1, generatedAt: now, jobs: [job], sources: [] }
  const failure = mergeJobs(previous, [{ source, error: 'timeout' }], '2026-10-14T10:00:00.000Z')
  assert.equal(failure.jobs[0].checkedAt, now)
  assert.equal(failure.sources[0].ok, false)
  assert.equal(mergeJobs(previous, [{ source, jobs: [] }], now).jobs.length, 0)
  assert.equal(mergeJobs(previous, [{ source, error: 'timeout' }], '2026-10-21T10:00:00Z').jobs.length, 0)
  const many = { ...previous, jobs: Array.from({ length: 12 }, (_, n) => ({ ...job, id: `old-${n}` })) }
  assert.equal(mergeJobs(many, [{ source, jobs: [job] }], now).jobs.length, 12)
})

test('company fit never invents work arrangements or mixes conditions from different jobs', () => {
  const prefs = { ...DEFAULT_WORK_PREFERENCES, city: 'zurich', workplace: 'remote' as const, sector: 'finance' as const }
  const unknown = companyFit(job, prefs)
  assert.deepEqual(unknown, { city: 'match', workplace: 'unknown', sector: 'match', matched: 2, requested: 3 })
  const a = { ...job, workplace: 'onsite' as const }
  const b = { ...job, id: 'second', city: 'Gland', workplace: 'remote' as const }
  const companies = rankCompanies(rankJobs([a, b], [], prefs))
  assert.equal(companies.length, 1)
  assert.equal(companies[0].best.fit.matched, 2)
  assert.equal(companyFit(job, DEFAULT_WORK_PREFERENCES).requested, 0)
})

test('job families follow job titles, not employer industry; ambiguous entry stays unknown', () => {
  assert.deepEqual(occupationsForJob('Software Engineer'), ['software'])
  assert.deepEqual(occupationsForJob('Infirmière diplômée'), ['care'])
  assert.deepEqual(occupationsForJob('Secrétaire médical·e bilingue'), ['administration'])
  assert.deepEqual(occupationsForJob('Medizintechnik Ingenieur'), ['engineering'])
  assert.deepEqual(occupationsForJob('Dipl. Fachperson Operationstechnik'), ['care'])
  assert.deepEqual(occupationsForJob('Random unclassified job'), [])
  assert.equal(entryFromTitle('Software Engineer'), 'unknown')
  assert.equal(entryFromTitle('Senior Software Engineer'), 'experienced')
  assert.equal(entryFromTitle('Apprenti employé de commerce'), 'training')
})

test('career matching needs interests, handles invalid answers and uses the existing questionnaire', () => {
  assert.deepEqual(matchOccupations({}, []), [])
  const answers = { interests: Object.fromEntries(INTEREST_ITEMS.map((i) => [i.id, ['computing', 'math', 'physicalScience'].includes(i.key) ? 5 : 1])) }
  const matches = matchOccupations(answers, [])
  assert.ok(matches.slice(0, 6).some((m) => m.id === 'software' || m.id === 'data'))
  assert.ok(matches.find((m) => m.id === 'software')!.score > matches.find((m) => m.id === 'hospitality')!.score)
  assert.deepEqual(matchOccupations({ interests: Object.fromEntries(INTEREST_ITEMS.map((i) => [i.id, 100])) }, []), [])
  for (const occupation of OCCUPATIONS) for (const id of occupation.fields) assert.ok(FIELD_BY_ID[id])
})

test('wasarbeiten keeps the same site storage and route in each language', async () => {
  assert.equal(routes('ch', '/schweiz').work, '/schweiz/wasarbeiten')
  assert.equal(routes('ch').work, '/wasarbeiten')
  assert.equal(routes('ch', '', 'fr-CH').work, '/fr/wasarbeiten')
  assert.equal(switchHref({ site: 'ch', locale: 'de-CH', base: '' }, { site: 'ch', locale: 'it-CH' }, '/wasarbeiten', []), '/it/wasarbeiten')
  for (const locale of ['en', 'de-CH', 'fr-CH', 'it-CH'] as const) {
    const w = dict(locale).work
    for (const occupation of OCCUPATIONS) assert.ok(w.roles[occupation.id])
  }
  const page = await readFile(new URL('../app/views/work.tsx', import.meta.url), 'utf8')
  assert.ok(page.includes('useAppState()'))
  assert.ok(page.includes('effectiveSummaries(state)'))
  assert.doesNotMatch(page, /\/api\/(programmes|research|personal-fit|content-analysis)|unlockToken|state\.unlock/)
})
