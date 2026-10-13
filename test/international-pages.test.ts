import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PROGRAMME_COUNTRIES, programmeCountry } from '../lib/programme-countries.ts'
import { FACTS_COUNTRIES } from '../lib/engine/programme-fit.ts'
import { coreName, verifiedProgrammeTitle, STUDY_PATH } from '../lib/page-match.ts'
import { discoverPages, emptyPageIndex, isProgrammeUrl, programmePage, registryPage, type PageRow } from '../scrapers/lib/programme-pages.ts'
import { programmePageText } from '../scrapers/lib/programme-page-text.ts'
import { parseDbh } from '../scrapers/no-dbh.ts'

test('all requested countries support stored readings, with UK normalized and DE/AT excluded', () => {
  assert.deepEqual(FACTS_COUNTRIES, ['CH', 'FR', 'GB', 'NL', 'NO', 'FI', 'AU', 'KR', 'US'])
  assert.equal(programmeCountry(' uk '), 'GB')
  for (const cc of ['DE', 'AT', 'ALL', 'XX']) assert.throws(() => programmeCountry(cc))
})

const row = (country = 'US'): PageRow => ({ id: 'abc123', name: "Bachelor's in Computer Science", country, level: 'bachelor', institutionUrl: 'https://example.edu/' })

test('homepages, language landing pages, other institutions and malformed addresses are not programme pages', () => {
  for (const url of ['https://example.edu/', 'https://example.edu/en/', 'https://example.edu/index.html', 'javascript:alert(1)', 'broken']) assert.equal(isProgrammeUrl(url), false)
  assert.equal(isProgrammeUrl('https://elsewhere.edu/course/computing', 'https://example.edu'), false)
  assert.equal(isProgrammeUrl('https://faculty.example.edu/degree/computing', 'https://example.edu'), true)
  assert.equal(programmePage({ ...row(), url: 'https://example.edu/' }), undefined)
})

test('national programme links work alongside institution websites, but only for the right source and path', () => {
  const records: PageRow[] = [
    { ...row('GB'), source: 'uk-discover-uni', url: 'https://discoveruni.gov.uk/course-details/123/G400/Full-time/' },
    { ...row('FR'), source: 'fr-parcoursup', url: 'https://dossierappel.parcoursup.fr/Candidats/public/fiches/afficherFicheFormation?g_ta_cod=123' },
    { ...row('FI'), source: 'fi-opintopolku', url: 'https://opintopolku.fi/konfo/en/koulutus/1.2.3' },
  ]
  for (const p of records) {
    assert.equal(programmePage(p), p.url)
    assert.equal(registryPage({ ...p, source: 'unknown' }), undefined)
    assert.equal(registryPage({ ...p, country: 'DE' }), undefined)
    assert.equal(registryPage({ ...p, url: `${new URL(p.url!).origin}/news/123` }), undefined)
  }
})

test('international names and paths preserve Korean text and require positive degree evidence', () => {
  assert.equal(coreName("Bachelor's in Computer Science"), 'computer science')
  assert.equal(coreName('Bachelor of Information Technology'), 'information technology')
  assert.equal(coreName('Bachelor i informatikk'), 'informatikk')
  for (const [name, title] of [
    ['Computer Science', 'Computer Science BSc'], ['Informatikk', 'Bachelor i informatikk'],
    ['Informatica', 'Informatica bachelor'], ['Informatique', 'Licence Informatique'],
    ['Tietojenkäsittelytiede', 'Tietojenkäsittelytiede kandidaatti'], ['컴퓨터공학과', '컴퓨터공학과 학사'],
  ]) assert.equal(verifiedProgrammeTitle({ name, level: 'bachelor' }, title, ''), true, title)
  assert.equal(verifiedProgrammeTitle(row(), 'Computer Science department', ''), false)
  assert.equal(verifiedProgrammeTitle(row(), 'Computer Science MSc', ''), false)
  assert.equal(verifiedProgrammeTitle(row(), 'Computer Science with Mathematics BSc', ''), false)
  assert.equal(verifiedProgrammeTitle(row(), 'Computer Science BS | Example University', ''), true)
  for (const path of ['/courses/computing', '/opleidingen/informatica', '/utdanning/informatikk', '/koulutus/fysiikka', '/학과/컴퓨터공학과']) assert.ok(STUDY_PATH.test(path))
})

test('bounded discovery deduplicates programmes, follows nested sitemaps and reuses verified URLs', async () => {
  const p = row()
  const calls: string[] = []
  const pages: Record<string, string> = {
    'https://example.edu/robots.txt': 'Sitemap: https://example.edu/maps/index.xml',
    'https://example.edu/maps/index.xml': '<sitemapindex><loc>https://example.edu/maps/courses.xml</loc><loc>https://evil.test/maps.xml</loc></sitemapindex>',
    'https://example.edu/maps/courses.xml': '<urlset><loc>https://example.edu/courses/computing</loc><loc>https://evil.test/courses/computing</loc></urlset>',
    'https://example.edu/courses/computing': '<title>Computer Science BSc</title><h1>Computer Science</h1>',
  }
  const index = emptyPageIndex()
  const read = async (url: string) => { calls.push(url); return { status: pages[url] ? 200 : 404, text: pages[url] ?? '' } }
  assert.deepEqual(await discoverPages([p, p], index, { maxHosts: 1, maxPages: 2 }, read), { hosts: 1, found: 1 })
  assert.equal(programmePage(p, index), 'https://example.edu/courses/computing')
  assert.equal(calls.filter((u) => u.endsWith('/courses/computing')).length, 1)
  assert.ok(calls.every((u) => new URL(u).hostname === 'example.edu'))
  assert.deepEqual(await discoverPages([p], index, { maxHosts: 1, maxPages: 2 }, read), { hosts: 0, found: 0 })
  assert.equal(programmePage({ ...p, level: 'master' }, index), undefined)
})

test('discovery rotates institutions, continues bounded page scans and rejects ambiguous pages', async () => {
  const index = emptyPageIndex()
  const p = row()
  const read = async (url: string) => ({ status: 200, text: url.endsWith('/sitemap.xml') ? '<urlset><loc>https://example.edu/courses/1</loc><loc>https://example.edu/courses/2</loc><loc>https://example.edu/courses/3</loc></urlset>' : url.includes('/courses/') ? '<title>Computer Science BSc</title>' : '' })
  assert.equal((await discoverPages([p], index, { maxHosts: 1, maxPages: 2 }, read)).found, 0)
  assert.equal(index.hosts['example.edu'].offset, 2)
  index.hosts['example.edu'].at = '2026-10-13'
  const other = { ...row(), id: 'other', institutionUrl: 'https://other.edu/' }
  await discoverPages([p, other], index, { maxHosts: 1, maxPages: 1 }, async () => ({ status: 404, text: '' }))
  assert.ok(index.hosts['other.edu'])
  assert.equal(index.hosts['example.edu'].at, '2026-10-13')
})

test('Finnish details use the exact public record and never include unrelated recommendations', async () => {
  let requested = ''
  const read = async (url: string) => { requested = url; return { status: 200, text: JSON.stringify({ oid: '1.2.3', nimi: { en: 'Computer Science' }, metadata: { kuvaus: { en: '<p>Algorithms and programming.</p>' } }, recommendations: ['UNRELATED'] }) } }
  const res = await programmePageText('https://opintopolku.fi/konfo/en/koulutus/1.2.3', read)
  assert.equal(requested, 'https://opintopolku.fi/konfo-backend/koulutus/1.2.3')
  assert.match(res.text, /Algorithms and programming/)
  assert.doesNotMatch(res.text, /UNRELATED|<p>/)
  assert.equal((await programmePageText('https://opintopolku.fi/konfo/en/koulutus/1.2.4', read)).status, 422)
  assert.equal((await programmePageText('https://opintopolku.fi/konfo/en/koulutus/1.2.3', async () => ({ status: 403, text: '' }))).status, 403)
})

test('discovered pages are checked again, so a redirect to a generic department is refused', async () => {
  const res = await programmePageText('https://example.edu/courses/computing', async () => ({ status: 200, text: '<title>Computer Science department</title><p>General information</p>' }), row())
  assert.equal(res.status, 422)
  assert.equal(res.text, '')
})

test('Norwegian institution codes supply official websites despite translated directory names', () => {
  const result = parseDbh([{ Institusjonskode: '1110', Institusjonsnavn: 'Universitetet i Oslo', Studieprogramkode: 'IT', Studieprogramnavn: 'Computer Science', Nivåkode: 'B3', Studiepoeng: '180' }], new Map(), '2026-10-13')
  assert.equal(result.programmes[0].institutionUrl, 'https://www.uio.no/')
})

test('facts workflow covers the shared country list and persists per-country progress', () => {
  const workflow = readFileSync(new URL('../.github/workflows/wsis-fakten.yml', import.meta.url), 'utf8')
  assert.match(workflow, /PROGRAMME_COUNTRIES, programmeCountry/)
  assert.match(workflow, /matrix\.country/)
  assert.match(workflow, /--pages page-index\/pages\.json/)
  assert.match(workflow, /actions\/cache\/save/)
  const run = readFileSync(new URL('../scrapers/run-all.ts', import.meta.url), 'utf8')
  for (const name of ['us-scorecard', 'fr-parcoursup', 'uk-discoveruni', 'nl-duo', 'no-dbh', 'fi-opintopolku', 'au-cricos', 'kr-academyinfo']) assert.ok(run.includes(`'${name}'`))
  assert.equal(PROGRAMME_COUNTRIES.includes('CH'), true)
})
