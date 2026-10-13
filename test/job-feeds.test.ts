import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeedJob, scrapeJobFeed } from '../scrapers/job-feeds.ts'
import { JOB_SOURCES } from '../lib/work/sources.ts'
import { jobUrl, DEFAULT_WORK_PREFERENCES } from '../lib/work/types.ts'
import { companyFit } from '../lib/work/matching.ts'
import { mergeJobs } from '../scrapers/jobs.ts'
import type { JobsData } from '../lib/work/types.ts'

const now = '2026-10-13T10:00:00Z'
const coop = JOB_SOURCES.find((source) => source.id === 'Coop')!
const bund = JOB_SOURCES.find((source) => source.id === 'Bund')!
const sbb = JOB_SOURCES.find((source) => source.id === 'SBB')!
const uuid = '12345678-1234-1234-1234-123456789abc'
const row = {
  id: '123', title: 'Detailhandelsfachfrau:mann EFZ',
  attributes: { '20': ['Verkauf Food'], '50': ['Lehrstellen'], '70': ['Coop'], '350': ['Detailhandelsfachfrau:mann EFZ'], '360': ['keine Schnupperlehre'] },
  szas: { sza_reference_code: '456', 'sza_location.city': 'Zürich', 'sza_location.region': 'Zürich', sza_pensum: '100%', sza_tasks: 'Never store this description', sza_contact: 'Never store this contact' },
  links: { directlink: `https://jobs.coopjobs.ch/offene-stellen/lehre/${uuid}` },
  start_date: '2026-10-01', end_date: '2026-12-31',
}

test('Coop apprenticeships use an explicit Swiss canton and preserve only job facts', () => {
  const job = parseFeedJob(row, coop, now)!
  assert.equal(job.id, 'Coop:456')
  assert.equal(job.entry, 'training')
  assert.equal(job.country, 'CH')
  assert.equal(job.sector, 'retail')
  assert.equal(job.workplace, 'unknown')
  assert.deepEqual(job.occupationIds, ['business'])
  assert.doesNotMatch(JSON.stringify(job), /Never store|sza_tasks|sza_contact/)
  for (const region of ['Fürstentum Liechtenstein', 'Unknown', '']) {
    assert.equal(parseFeedJob({ ...row, szas: { ...row.szas, 'sza_location.region': region } }, coop, now), null)
  }
  // A canton must never override an explicitly foreign country.
  assert.equal(parseFeedJob({ ...row, szas: { ...row.szas, 'sza_workplace.country': 'Liechtenstein' } }, coop, now), null)
  assert.equal(parseFeedJob({ ...row, attributes: { ...row.attributes, '360': ['Detailhandelsfachfrau:mann'] } }, coop, now), null)
  assert.equal(parseFeedJob({ ...row, end_date: '2026-10-12' }, coop, now), null)
  assert.equal(parseFeedJob({ ...row, start_date: '2026-11-01' }, coop, now), null)
  assert.throws(() => parseFeedJob({ ...row, end_date: 'broken' }, coop, now), /Invalid job date/)
})

test('a diversified group uses each employer’s sector and leaves unknown brands unknown', () => {
  const make = (company: string) => parseFeedJob({ ...row, attributes: { ...row.attributes, '70': [company] } }, coop, now)!
  assert.equal(make('HALBA').sector, 'industry')
  assert.equal(make('railCare').sector, 'transport')
  assert.equal(make('Coop Restaurant').sector, 'hospitality')
  assert.equal(make('New subsidiary').sector, undefined)
  assert.equal(companyFit(make('New subsidiary'), { ...DEFAULT_WORK_PREFERENCES, sector: 'retail' }).sector, 'unknown')
})

test('federal postings exclude foreign regions even when country defaults to Switzerland', () => {
  const federal = {
    ...row, title: 'Hochschulpraktikant/-in Informatik',
    links: { directlink: `https://jobs.admin.ch/offene-stellen/praktikum/${uuid}` },
    attributes: { arbeitsort: ['Bern, Schweiz'], land: ['Schweiz'], region: ['Espace Mittelland (BE, FR, JU, NE, SO)'], verwaltungseinheit: ['Parent department'], verwaltungseinheit_1: ['Actual federal office'], '125': ['true'] },
    szas: { sza_apply_link: 'https://career74.sapsf.eu/career?career_job_req_id=999' },
  }
  const job = parseFeedJob(federal, bund, now)!
  assert.equal(job.id, 'Bund:999')
  assert.equal(job.company, 'Actual federal office')
  assert.equal(job.city, 'Bern')
  assert.equal(job.entry, 'training')
  assert.equal(job.workplace, 'hybrid')
  assert.deepEqual(job.occupationIds, ['software'])
  assert.equal(parseFeedJob({ ...federal, attributes: { ...federal.attributes, region: ['Ausland'], arbeitsort: ['Moskau'] } }, bund, now), null)
})

test('public feeds read every page, merge requisition duplicates and reject partial or repeated data', async () => {
  const offsets: number[] = []
  const read = async (url: string) => {
    const offset = Number(new URL(url).searchParams.get('offset')); offsets.push(offset)
    const jobs = offset === 0 ? [row, { ...row, id: '124' }] : [{ ...row, id: '125', szas: { ...row.szas, sza_reference_code: '457' } }]
    return { status: 200, text: JSON.stringify({ total: 3, offset, jobs }) }
  }
  const jobs = await scrapeJobFeed(coop, read, now)
  assert.deepEqual(offsets, [0, 2])
  assert.deepEqual(jobs.map((job) => job.id), ['Coop:456', 'Coop:457'])
  const broken = (total: number, rows: unknown[], offset: number) => async () => ({ status: 200, text: JSON.stringify({ total, offset, jobs: rows }) })
  await assert.rejects(scrapeJobFeed(coop, broken(10, [], 0), now), /Incomplete/)
  await assert.rejects(scrapeJobFeed(coop, broken(10, [row], 0), now), /offset/)
  await assert.rejects(scrapeJobFeed(coop, async (url) => ({ status: 200, text: JSON.stringify({ total: 2, offset: Number(new URL(url).searchParams.get('offset')), jobs: [row] }) }), now), /Repeated/)
  await assert.rejects(scrapeJobFeed(coop, async () => ({ status: 503, text: '' }), now), /HTTP 503/)
  const empty = await scrapeJobFeed(coop, broken(0, [], 0), now)
  assert.deepEqual(empty, [])
})

test('SBB full list filters work country and reads declared career levels', async () => {
  const rail = { ...row, title: 'Lokführer:in', links: { directlink: `https://jobs.sbb.ch/v2/offene-stellen/lokfuehrer/${uuid}` }, attributes: { '65': ['Schweiz'], '100': ['Olten'], '110': ['Bern Mittelland (BE/SO/AG)'], '60': ['Berufserfahrene'], '160': ['80–100%'] } }
  const jobs = await scrapeJobFeed(sbb, async () => ({ status: 200, text: JSON.stringify([rail, { ...rail, id: '124', attributes: { ...rail.attributes, '65': ['Deutschland'] } }]) }), now)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].entry, 'experienced')
  assert.deepEqual(jobs[0].occupationIds, ['logistics'])
})

test('targeted refresh preserves unrequested sources and their original verification dates', () => {
  const job = parseFeedJob(row, coop, now)!
  const previous: JobsData = { version: 1, generatedAt: now, jobs: [job], sources: [{ id: coop.id, ok: true, checkedAt: now, count: 1 }] }
  const merged = mergeJobs(previous, [{ source: bund, jobs: [] }], '2026-10-14T10:00:00Z', true)
  assert.equal(merged.jobs[0].checkedAt, now)
  assert.deepEqual(merged.sources.find((source) => source.id === coop.id), previous.sources[0])
})

test('employer advert links support French and Italian while rejecting lookalike hosts', () => {
  for (const [host, path] of [['jobs.fust.ch', 'postes-vacants'], ['jobs.coopjobs.ch', 'posti-vacanti'], ['jobs.transgourmet.ch', 'postes-vacantes']]) {
    const url = `https://${host}/${path}/job/${uuid}`
    assert.equal(jobUrl(url), url)
    assert.equal(jobUrl(url.replace(host, `${host}.evil.test`)), null)
  }
  assert.equal(jobUrl('https://jobs.admin.ch/api/private'), null)
})
