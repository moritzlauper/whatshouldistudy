import { test } from 'node:test'
import assert from 'node:assert/strict'
import { textTopics } from '../lib/engine/classifier.ts'
import { combinedScore, localFit, orderByNumber, aiPersonalFit, shownScore, toPersonalFit, validatedTopics, type ProgrammeFacts } from '../lib/engine/programme-fit.ts'
import { exactBatch } from '../lib/ai-batch.ts'
import { pageText } from '../lib/official-facts.ts'
import { completeSentence, FACTS_VERSION, normaliseFact } from '../scrapers/lib/facts.ts'
import { bfhList, bfhOffers, studyFacts, toProgramme, unifrDetail, zhawList } from '../scrapers/ch-hochschulen.ts'
import { preserveInstitutions } from '../scrapers/lib/completeness.ts'
import { findChInstitution } from '../lib/ch-institutions.ts'
import { officialPageOf } from '../lib/official-pages.ts'
import { siteReader } from '../scrapers/lib/site-fetch.ts'

const computing: ProgrammeFacts = { id: 'cs', riasec: [3, 5, 1, 0, 1, 4], subjects: ['math', 'cs'], topics: ['computer-science'], check: '', enough: true }
const profile = { riasec: [.7, 1, .2, 0, .1, .8], enjoy: { math: 5, cs: 5 } }

test('real user lexical topics survive validation and improve the relevant programme', () => {
  const topics = Object.fromEntries(textTopics('Python algorithm programming').map((k) => [k, 1]))
  assert.ok(Object.keys(topics).length)
  assert.deepEqual(validatedTopics(topics), topics)
  assert.deepEqual(validatedTopics({ python: 2, astrology: 1, 'computer-science': .4, fake: NaN }), { python: 1, 'computer-science': .4 })
  const fit = localFit(computing, { ...profile, topics })
  assert.ok(fit.score > localFit(computing, profile).score)
  assert.ok(fit.reasons.some((r) => r.kind === 'topics' && r.keys.includes('python')))
  assert.equal(fit.score, localFit(computing, { ...profile, topics }).score)
})

test('a general programming topic does not claim a specific specialisation', () => {
  const fit = localFit({ ...computing, specialisations: [{ name: 'Web Engineering', topics: ['computer-science'] }] }, { ...profile, topics: { python: 1 } })
  assert.ok(!fit.reasons.some((r) => r.kind === 'specialisations'))
})

test('unread programmes get neutral content in mixed ranking and remain in the list', () => {
  const items = [{ id: 'unread', match: 95 }, { id: 'read', match: 95 }]
  assert.deepEqual(orderByNumber(items, (p) => shownScore(p.match, p.id === 'read' ? 65 : undefined, true)).map((p) => p.id), ['read', 'unread'])
  assert.equal(combinedScore(95, undefined, true), 86)
  assert.equal(combinedScore(95), 95)
  assert.deepEqual(orderByNumber(items, (p) => p.match), items)
})

test('the personal AI rating moves the computed score by at most 30 points and keeps at most three sentences', () => {
  const canonical = { id: 'cs', fit: 4, score: 72, reasons: ['Needs subjects you enjoy: Maths', 'Fits your topics: python'], thin: false }
  assert.equal(aiPersonalFit({ id: 'cs', score: 0, reasons: [] }, canonical).score, 42)
  assert.equal(aiPersonalFit({ id: 'cs', score: 99, reasons: [] }, canonical).score, 99)
  assert.deepEqual(aiPersonalFit({ id: 'cs', score: 80, reasons: ['Eins.', '  Zwei.  ', '', 'Drei.', 'Vier.'] }, canonical).reasons, ['Eins.', 'Zwei.', 'Drei.'])
  assert.deepEqual(aiPersonalFit({ id: 'cs', score: 80, reasons: [] }, canonical).reasons, canonical.reasons)
  assert.equal(aiPersonalFit({ id: 'cs', score: 99, reasons: ['x'] }, { ...canonical, score: 50, thin: true, reasons: [] }).score, 50)
  assert.throws(() => aiPersonalFit({ id: 'other', score: 50, reasons: [] }, canonical))
  assert.equal(toPersonalFit({ id: 'cs', score: 99, fit: 1, enough_info: true }, new Set(['cs']))?.fit, 5)
  assert.equal(toPersonalFit({ id: 'cs', score: 99 }, new Set(['cs'])), null)
})

test('a batch must cover precisely its requested IDs, with no duplicates or omissions', () => {
  const ids = new Set(['a', 'b'])
  assert.equal(exactBatch([{ id: 'b' }, { id: 'a' }], ids).length, 2)
  for (const raw of [undefined, [{ id: 'a' }], [{ id: 'a' }, { id: 'a' }], [{ id: 'a' }, { id: 'other' }]]) assert.throws(() => exactBatch(raw, ids))
})

test('AI explanations keep complete paragraphs beyond the former 240 and 320 character cuts', () => {
  const explanation = 'Dein Thema passt zur Medienkommunikation. ' + 'Gesellschaft, Ökonomie und Politik werden im Studiengang gemeinsam untersucht. '.repeat(5) + 'Die Bewerbung verlangt eine wissenschaftliche Arbeitsprobe.'
  assert.ok(explanation.length > 320)
  const canonical = { id: 'cs', fit: 4, score: 72, reasons: [], thin: false }
  assert.deepEqual(aiPersonalFit({ id: 'cs', score: 80, reasons: ['  ' + explanation + '  '] }, canonical).reasons, [explanation])
  assert.deepEqual(toPersonalFit({ id: 'cs', fit: 4, enough_info: true, reasons: [explanation] }, new Set(['cs']))?.reasons, [explanation])
})

test('HSLU-style outer forms retain the programme text while hidden controls are discarded', () => {
  const html = '<form id="superform"><input value="state"><nav>Menu</nav><h1>Informatik</h1><div hidden><p>Hidden</p></div><div aria-hidden="true"><div>Also hidden</div></div><div style="display:none">Secret</div><p>180 ECTS</p></form>'
  assert.equal(pageText(html), 'Informatik\n180 ECTS')
  assert.equal(pageText('<script>const sample = "<div hidden>"</script><p>Visible programme</p>'), 'Visible programme')
})

test('AI facts require literal evidence for content, specialisations and distinctive facts', () => {
  const text = 'Studium mit zwei Vertiefungen: Data Analytics und Software Engineering. Ein Projekt gehört zum Studium.'
  const sent = new Map([['a', { url: 'https://x.ch/a', hash: 'h', text }]])
  const raw = { id: 'a', enough_info: true, content_quote: 'Studium mit zwei Vertiefungen', checks_quote: 'Ein Projekt gehört zum Studium.', riasec: { I: 5 }, subjects: ['cs'], topics: ['computer-science'], checks: { en: 'Check the project requirements.' },
    specialisations: [{ name: 'Data Analytics', topics: ['statistics-data-science'], quote: 'Vertiefungen: Data Analytics und Software Engineering.' }, { name: 'Quantum AI', topics: ['artificial-intelligence'], quote: 'Studium mit zwei Vertiefungen' }],
    distinctive: [{ statement: 'Das Studium enthält ein Projekt.', quote: 'Ein Projekt gehört zum Studium.' }, { statement: 'Ein Praktikum bei Google ist garantiert.', quote: 'Google offers internships' }] }
  const fact = normaliseFact(raw, sent, '2026-10-12')!
  assert.equal(fact.version, FACTS_VERSION)
  assert.deepEqual(normaliseFact({ ...raw, specialisations: [{ name: 'Software', topics: [], quote: 'Studium mit zwei Vertiefungen' }] }, sent, '2026-10-12')?.specialisations, [])
  assert.deepEqual(fact.specialisations.map((s) => s.name), ['Data Analytics'])
  assert.deepEqual(fact.distinctive, ['Das Studium enthält ein Projekt.'])
  assert.equal(normaliseFact({ ...raw, content_quote: 'Invented course description' }, sent, '2026-10-12')?.enough, false)
  assert.equal(normaliseFact({ ...raw, checks_quote: 'Invented admission requirement' }, sent, '2026-10-12')?.checks.en, '')
  assert.equal(completeSentence('Kurzer Satz. ' + 'x'.repeat(160), 160), 'Kurzer Satz.')
  assert.equal(completeSentence('x'.repeat(161), 160), '')
})

test('Fribourg credits sum within a variant, never across alternatives', () => {
  const read = (s: string) => unifrDetail(`<h4>Studienstruktur</h4><div>${s}</div>`)
  assert.equal(read('150 ECTS + 30 ECTS oder 120 ECTS + 60 ECTS, 6 Semester').ects, 180)
  assert.deepEqual(read('90 ECTS (3 Semester) oder 120 ECTS (4 Semester)'), { ects: 90, durationYears: 1.5 })
  assert.equal(read('180 ECTS (6 Semester), davon 30 ECTS Nebenfach').ects, 180)
})

test('programme metadata stays unknown unless supplied by its own source', () => {
  const p = toProgramme({ name: 'Bachelor Informatik', level: 'bachelor', url: 'https://www.zhaw.ch/a' }, findChInstitution('ZHAW')!, '2026-10-12')!
  assert.equal(p.mode, undefined)
  assert.equal(p.languages, undefined)
  assert.equal(p.durationYears, undefined)
  assert.deepEqual(studyFacts('<nav>Teilzeit Informatik</nav><h2>Studienform</h2><p>Vollzeit und Teilzeit</p><h2>Unterrichtssprache</h2><p>Deutsch und Englisch</p><p>180 ECTS</p>'), { mode: 'both', languages: ['de', 'en'], ects: 180 })
  const social = zhawList('<a href="/de/sozialearbeit/studium/bachelor-in-sozialer-arbeit"><h3>Bachelor Soziale Arbeit</h3></a>', 'https://www.zhaw.ch', 'bachelor')[0]
  assert.equal(toProgramme(social, findChInstitution('ZHAW')!, '2026-10-12')?.city, 'Zürich')
})

test('the full Composition and Theory programme uses its overview rather than one major', () => {
  assert.equal(officialPageOf({ institutionUrl: 'https://www.zhdk.ch', name: 'Master Composition and Theory', level: 'master' }), 'https://www.zhdk.ch/studium/musik/11773/komposition-theorie-11762')
})

test('Netflix technical explanations still count as educational topics', () => {
  assert.ok(textTopics('How Netflix recommendation algorithms work: machine learning tutorial').includes('machine learning'))
  assert.ok(textTopics('Netflix cinematography and film editing analysis').length)
  assert.deepEqual(textTopics('best true crime imdb'), [])
})

test('the shared crawler checks robots before pages and redirected targets', async () => {
  const calls: string[] = []
  const request = (async (url: string | URL | Request) => {
    const path = new URL(String(url)).pathname
    calls.push(path)
    if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /private\n')
    if (path === '/start') return new Response(null, { status: 302, headers: { location: '/private' } })
    return new Response('public')
  }) as typeof fetch
  const read = siteReader(0, request)
  assert.equal((await read('https://x.ch/private')).status, 403)
  assert.equal((await read('https://x.ch/start')).status, 403)
  assert.equal((await read('https://x.ch/public')).text, 'public')
  assert.deepEqual(calls, ['/robots.txt', '/start', '/public'])
})

test('robots outages stop crawling, while an absent robots file allows a public page', async () => {
  for (const status of [503, 404]) {
    const calls: string[] = []
    const request = (async (url: string | URL | Request) => {
      const path = new URL(String(url)).pathname; calls.push(path)
      return path === '/robots.txt' ? new Response('', { status }) : new Response('page')
    }) as typeof fetch
    assert.equal((await siteReader(0, request)('https://x.ch/page')).status, status === 503 ? 403 : 200)
    assert.deepEqual(calls, status === 503 ? ['/robots.txt'] : ['/robots.txt', '/page'])
  }
})

test('BFH offer search follows every page and refuses repeated or incomplete pages', async () => {
  const offsets: number[] = []
  const request = async (_url: string, _timeout?: number, init?: RequestInit) => {
    const offset = JSON.parse(String(init?.body)).offset; offsets.push(offset)
    return { status: 200, text: JSON.stringify({ count: 2, totalCount: 3, resultsGridHtml: `<a href="https://www.bfh.ch/de/studium/bachelor/course-${offset}/">Course</a>` }) }
  }
  const html = await bfhOffers('https://www.bfh.ch/search', request)
  assert.ok(html)
  assert.deepEqual(offsets, [0, 2])
  assert.equal(bfhList(html, '', 'bachelor').length, 2)
  const repeated = async () => ({ status: 200, text: JSON.stringify({ count: 1, totalCount: 2, resultsGridHtml: 'same' }) })
  assert.equal(await bfhOffers('https://www.bfh.ch/search', repeated), null)
})

test('a failed or shrinking university cannot disappear while other universities refresh', () => {
  const previous = [...Array.from({ length: 4 }, (_, i) => ({ id: `a${i}`, institution: 'A', level: 'bachelor' })), { id: 'am', institution: 'A', level: 'master' }, { id: 'b-old', institution: 'B', level: 'bachelor' }]
  const fresh = [{ id: 'a-new', institution: 'A', level: 'bachelor' }, { id: 'b-new', institution: 'B', level: 'bachelor' }]
  const kept = preserveInstitutions(fresh, previous)
  assert.deepEqual(kept.programmes.map((p) => p.id).sort(), ['a0', 'a1', 'a2', 'a3', 'am', 'b-new'])
  assert.deepEqual(kept.kept.sort(), ['A (bachelor)', 'A (master)'])
})
