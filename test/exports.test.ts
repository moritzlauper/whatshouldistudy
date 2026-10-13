import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ObjectCutter, cutBeforeLastEntry, readExports, readTexts } from '../lib/sources/exports.ts'
import { resultsReady } from '../lib/engine/questionnaire.ts'
import { score } from '../lib/engine/scoring.ts'

const watch = [
  {
    header: 'YouTube',
    title: 'Watched How rocket engines work',
    titleUrl: 'https://www.youtube.com/watch?v=abc',
    subtitles: [{ name: 'Everyday Astronaut', url: 'https://www.youtube.com/channel/UC6uKrU_WqJ1R2HMTY3LIx5Q' }],
    time: '2024-03-01T20:11:05.123Z',
    products: ['YouTube'],
  },
  {
    header: 'YouTube',
    title: 'Watched Orbital mechanics explained',
    titleUrl: 'https://www.youtube.com/watch?v=def',
    subtitles: [{ name: 'Scott Manley', url: 'https://www.youtube.com/channel/UCxzC4EngIsMrPmbm6Nxvb-A' }],
    time: '2024-05-01T20:11:05.123Z',
    products: ['YouTube'],
  },
  {
    header: 'YouTube',
    title: 'Watched Some advert',
    titleUrl: 'https://www.youtube.com/watch?v=ad',
    details: [{ name: 'From Google Ads' }],
    time: '2024-05-01T20:11:05.123Z',
  },
  {
    header: 'YouTube',
    title: 'Searched for kerbal space program tutorial',
    titleUrl: 'https://www.youtube.com/results?search_query=kerbal+space+program+tutorial',
    time: '2024-05-02T10:00:00Z',
  },
  {
    header: 'YouTube Music',
    title: 'Watched Some Song',
    titleUrl: 'https://music.youtube.com/watch?v=xyz',
    subtitles: [{ name: 'Some Band - Topic' }],
    time: '2024-05-02T10:00:00Z',
  },
]

test('reads Takeout watch and search history, skipping ads and keeping music apart', async () => {
  const r = await readTexts([{ name: 'Takeout/YouTube/history/watch-history.json', text: JSON.stringify(watch) }])
  const s = r.summaries.find((x) => x.source === 'takeout')!
  assert.equal(s.stats.watchedVideos, 2)
  assert.equal(s.stats.youtubeSearches, 1)
  assert.equal(s.stats.musicPlays, 1)
  assert.ok(s.fields['aerospace-engineering'].score > 0)
  assert.deepEqual(r.topChannelIds.length, 2)
  assert.equal(r.recognised.length, 1)
})

test('successful activity and YouTube imports allow results without answers; empty imports do not', async () => {
  for (const file of [
    { name: 'Takeout/YouTube/history/watch-history.json', text: JSON.stringify(watch) },
    { name: 'Takeout/My Activity/Search/MyActivity.json', text: JSON.stringify([{ header: 'Search', title: 'Searched for physics', titleUrl: 'https://www.google.com/search?q=physics', time: '2026-01-01T12:00:00Z' }]) },
  ]) {
    const { summaries } = await readTexts([file])
    assert.equal(resultsReady({}, summaries.length), true, file.name)
    const result = score({ summaries, answers: {} })
    assert.ok(result.fields.length > 0)
    assert.equal(result.quality?.questionnaireLed, false)
  }
  for (const text of ['[]', '{invalid']) {
    const { summaries } = await readTexts([{ name: 'MyActivity.json', text }])
    assert.equal(resultsReady({}, summaries.length), false)
  }
  assert.equal(resultsReady({}, 0), false, 'removing all imports requires interest answers again')
})

test('unusable YouTube titles cannot contribute signals, channel context or block a later valid duplicate', async () => {
  const date = new Date().toISOString()
  const invalid = ['', 'https://www.youtube.com/watch?v=missing1234', 'http://youtu.be/missing1234', '[Deleted video]', '[Private video]', 'Video unavailable', 'Gelöschtes Video']
  const records = invalid.map((title, i) => ({ title: `Watched ${title}`, titleUrl: `https://www.youtube.com/watch?v=missing000${i}`, time: date, subtitles: [{ name: 'Physics lectures' }] }))
  const empty = await readTexts([{ name: 'MyActivity.json', text: JSON.stringify(records) }])
  assert.equal(empty.summaries.length, 0)
  assert.equal(empty.contentInput, undefined)
  assert.deepEqual(empty.topChannelIds, [])
  const result = await readTexts([{ name: 'MyActivity.json', text: JSON.stringify([...records, { ...records[0], title: 'Watched How quantum physics works' }]) }])
  assert.equal(result.summaries[0].stats.watchedVideos, 1)
  assert.equal(result.contentInput?.items.length, 1)
  assert.equal(result.contentAnalysis().items.length, 1)
})

test('Google News uses readable article titles and never treats a news link as a watched YouTube video', async () => {
  const records = [
    { title: 'Read How quantum physics works', titleUrl: 'https://example.org/article' },
    { title: 'Read How stars form', titleUrl: 'https://www.youtube.com/watch?v=news0000001' },
    { title: 'https://news.google.com/articles/opaque', titleUrl: 'https://news.google.com/articles/opaque' },
  ].map(x => ({ ...x, products: ['Google News'], time: new Date().toISOString() }))
  const result = await readTexts([{ name: 'MyActivity.json', text: JSON.stringify(records) }])
  assert.equal(result.summaries.length, 1)
  assert.equal(result.summaries[0].source, 'google-search')
  assert.equal(result.summaries[0].stats.articles, 2)
  assert.ok(result.summaries[0].fields.physics)
  assert.equal(result.contentAnalysis().items.length, 0, 'News never enters the first AI selection')
  assert.equal(result.contentInput?.google?.items.length, 2, 'News is retained locally for the explicit maximum run')
})

test('reads German Takeout file names by content', async () => {
  const csv = 'Kanal-ID,Kanal-URL,Kanaltitel\nUCYO_jab_esuFRV4b17AJtAw,http://www.youtube.com/channel/UCYO_jab_esuFRV4b17AJtAw,3Blue1Brown\n'
  const r = await readTexts([{ name: 'Abos.csv', text: csv }])
  const s = r.summaries[0]
  assert.equal(s.stats.subscriptions, 1)
  assert.ok(s.fields.mathematics)
})

test('reads YouTube comments with JSON-wrapped text', async () => {
  const csv =
    'Comment ID,Channel ID,Comment Create Timestamp,Price,Parent Comment ID,Post ID,Video ID,Comment Text\n' +
    'x1,UC1,2024-01-01T10:00:00Z,0,,,v1,"{""text"":""This explanation of quantum entanglement finally made it click""}"\n'
  const r = await readTexts([{ name: 'comments.csv', text: csv }])
  assert.equal(r.summaries[0].stats.comments, 1)
  assert.ok(r.summaries[0].fields.physics)
})

test('reads Spotify streaming history and keeps podcasts as topics', async () => {
  const plays = [
    { ts: '2024-01-01T10:00:00Z', ms_played: 1800000, episode_name: 'The economics of housing', episode_show_name: 'Freakonomics Radio', master_metadata_track_name: null },
    { ts: '2024-01-02T10:00:00Z', ms_played: 200000, master_metadata_track_name: 'Song', master_metadata_album_artist_name: 'Artist', episode_name: null },
  ]
  const r = await readTexts([{ name: 'Streaming_History_Audio_2024.json', text: JSON.stringify(plays) }])
  const s = r.summaries.find((x) => x.source === 'spotify-export')!
  assert.equal(s.stats.plays, 2)
  assert.equal(s.stats.podcastEpisodes, 1)
  assert.ok(s.fields.economics)
})

test('ignores unrelated files', async () => {
  const r = await readTexts([{ name: 'notes.html', text: '<html><body>Hello</body></html>' }])
  assert.equal(r.summaries.length, 0)
  assert.equal(r.skipped.length, 1)
})

test('reads Google searches from My Activity', async () => {
  const search = [
    { header: 'Suche', title: 'Gesucht nach: quantum physics lecture', titleUrl: 'https://www.google.com/search?q=quantum+physics+lecture', time: '2024-04-02T10:00:00.000Z', products: ['Suche'] },
    { header: 'Suche', title: 'Besucht: example.org', titleUrl: 'https://www.google.com/url?q=https://example.org', time: '2024-04-02T10:01:00.000Z', products: ['Suche'] },
  ]
  const r = await readTexts([{ name: 'Takeout/Meine Aktivitäten/Google Suche/MeineAktivitäten.json', text: JSON.stringify(search) }])
  const s = r.summaries.find((x) => x.source === 'google-search')!
  assert.equal(s.stats.googleSearches, 1)
  assert.ok(s.fields.physics.score > 0)
})

test('a Takeout archive without history says what it holds', async () => {
  const index = '<div>Products in Archive (1)</div><div id="service-tile-SEARCH_CREATORPROFILE" class="service_wrapper"><img src="x" alt="Search profile"></div>'
  const r = await readTexts([{ name: 'Takeout/archive_browser.html', text: index }])
  assert.equal(r.summaries.length, 0)
  assert.deepEqual(r.takeoutProducts, ["Search profile"])
})

test('notices when only the table of contents of a Takeout download arrived', async () => {
  const index = '<div>Products in Archive (1)</div><div id="service-tile-MY_ACTIVITY" class="service_wrapper"><img src="x" alt="My Activity"><div>337 files exported successfully</div><div>HTML format • 336.3 MB •</div></div>'
  const r = await readTexts([{ name: 'Takeout/archive_browser.html', text: index }])
  assert.equal(r.summaries.length, 0)
  assert.deepEqual(r.takeoutExport, { files: 337, size: '336.3 MB' })
})

test('reads the rest of My Activity: pages, Maps, apps, without double-counting YouTube', async () => {
  const activity = [
    { header: 'Chrome', title: 'Visited Quantum mechanics - Wikipedia', titleUrl: 'https://en.wikipedia.org/wiki/Quantum_mechanics', time: '2024-04-02T10:00:00.000Z', products: ['Chrome'] },
    { header: 'Search', title: 'Visited Introduction to astrophysics', titleUrl: 'https://www.google.com/url?q=https://example.org/astro', time: '2024-04-02T10:01:00.000Z', products: ['Search'] },
    { header: 'Maps', title: 'Searched for ETH Zürich Physik', titleUrl: 'https://www.google.com/maps/search/ETH+Z%C3%BCrich+Physik', time: '2024-04-02T10:02:00.000Z', products: ['Maps'] },
    { header: 'Google Play Store', title: 'Used Star Walk 2', titleUrl: 'https://play.google.com/store/apps/details?id=x', time: '2024-04-02T10:03:00.000Z', products: ['Google Play Store'] },
    { header: 'Ads', title: 'Visited Buy shoes', titleUrl: 'https://www.googleadservices.com/x', time: '2024-04-02T10:04:00.000Z', details: [{ name: 'From Google Ads' }] },
  ]
  const watch = [{ header: 'YouTube', title: 'Watched How rocket engines work', titleUrl: 'https://www.youtube.com/watch?v=abc', time: '2024-03-01T20:11:05.123Z', subtitles: [{ name: 'Everyday Astronaut' }] }]
  const r = await readTexts([
    { name: 'Takeout/My Activity/Chrome/MyActivity.json', text: JSON.stringify(activity) },
    { name: 'Takeout/YouTube/history/watch-history.json', text: JSON.stringify(watch) },
    { name: 'Takeout/My Activity/YouTube/MyActivity.json', text: JSON.stringify(watch) },
  ])
  const g = r.summaries.find((x) => x.source === 'google-search')!
  assert.equal(g.stats.pagesVisited, 2)
  assert.equal(g.stats.mapsSearches, 1)
  assert.equal(g.stats.apps, 1)
  assert.ok(g.fields.physics.score > 0)
  const y = r.summaries.find((x) => x.source === 'takeout')!
  assert.equal(y.stats.watchedVideos, 1)
})

test('searches about studying itself are left out', async () => {
  const search = [
    { header: 'Search', title: 'Searched for soziologie uzh master anmeldefrist', titleUrl: 'https://www.google.com/search?q=soziologie+uzh+master+anmeldefrist', time: '2024-04-02T10:00:00.000Z' },
    { header: 'Search', title: 'Searched for soziale ungleichheit statistik', titleUrl: 'https://www.google.com/search?q=soziale+ungleichheit+statistik', time: '2024-04-02T10:01:00.000Z' },
  ]
  const r = await readTexts([{ name: 'Takeout/My Activity/Search/MyActivity.json', text: JSON.stringify(search) }])
  const g = r.summaries.find((x) => x.source === 'google-search')!
  // Read, noted as study info, and kept out of every field.
  assert.equal(g.studyInfo?.n, 1)
  assert.ok(g.studyInfo?.fields.sociology)
  assert.ok(!g.fields.sociology?.top.some((t) => /uzh/.test(t.label)))
})

test('videos and pages about choosing a degree are study info, not interest', async () => {
  const at = (m: number) => `2025-0${m}-02T10:00:00.000Z`
  const watch = [
    { header: 'YouTube', title: 'Watched Psychologie studieren: lohnt sich das?', titleUrl: 'https://www.youtube.com/watch?v=a1', subtitles: [{ name: 'Studi Tipps' }], time: at(1) },
    { header: 'YouTube', title: 'Watched Mein Psychologiestudium: ehrliche Erfahrungen', titleUrl: 'https://www.youtube.com/watch?v=a2', subtitles: [{ name: 'Lea' }], time: at(2) },
    { header: 'YouTube', title: 'Watched A day in the life of a psychology student', titleUrl: 'https://www.youtube.com/watch?v=a3', subtitles: [{ name: 'Sam' }], time: at(3) },
    { header: 'YouTube', title: 'Watched Das Milgram-Experiment: Gehorsam und Autorität erklärt', titleUrl: 'https://www.youtube.com/watch?v=a4', subtitles: [{ name: 'Psych Explained' }], time: at(4) },
  ]
  const visits = [
    { header: 'Chrome', title: 'Visited Psychologie – Universität Zürich', titleUrl: 'https://www.psychologie.uzh.ch/de/studium.html', time: at(5) },
  ]
  const r = await readTexts([
    { name: 'Takeout/My Activity/YouTube/MyActivity.json', text: JSON.stringify(watch) },
    { name: 'Takeout/My Activity/Chrome/MyActivity.json', text: JSON.stringify(visits) },
  ])
  const y = r.summaries.find((x) => x.source === 'takeout')!
  assert.equal(y.studyInfo?.n, 3)
  assert.ok((y.studyInfo?.fields.psychology ?? 0) >= 2)
  // The one real psychology video still counts.
  assert.ok(y.fields.psychology.score > 0)
  assert.equal(y.fields.psychology.items, 1)
  const g = r.summaries.find((x) => x.source === 'google-search')
  assert.equal(g?.fields.psychology, undefined)
})

test('a part of a large activity log is cut right before its last entry, never inside one', () => {
  const entry = (i: number) => `<div class="outer-cell mdl-grid"><div class="content-cell">Angesehen ${i}</div></div>`
  const text = `<html><body>${entry(1)}${entry(2)}${entry(3)}`
  const at = cutBeforeLastEntry(text)
  assert.ok(at > 0)
  assert.equal(text.slice(at), entry(3))
  assert.equal(cutBeforeLastEntry('<div class="outer-cell">first entry is not a cut</div>'), -1)
  assert.equal(cutBeforeLastEntry('no entries here'), -1)
})

test('the objects of a JSON array come out whole, however the text is split into parts', () => {
  const objects = [
    { title: 'Angesehen "Zitat } mit Klammer [x]"', n: 1 },
    { title: 'Zweites \\ Objekt', nested: { a: [1, { b: 'c}' }] } },
    { title: 'drittes' },
  ]
  const json = JSON.stringify(objects)
  for (const size of [1, 2, 3, 7, 50, json.length]) {
    const cutter = new ObjectCutter()
    const got: string[] = []
    for (let i = 0; i < json.length; i += size) got.push(...cutter.take(json.slice(i, i + size)))
    assert.deepEqual(got.map((o) => JSON.parse(o)), objects, `part size ${size}`)
  }
})

test('a large Takeout activity log is read part by part and counted like a small one', async () => {
  const n = 30_000
  const watch = Array.from({ length: n }, (_, i) => ({
    header: 'YouTube',
    title: `Angesehen Video über Psychologie und Gedächtnis, Teil ${i}`,
    titleUrl: `https://www.youtube.com/watch?v=v${String(i).padStart(10, '0')}`,
    subtitles: [{ name: `Kanal ${i % 50}`, url: `https://www.youtube.com/channel/UC${String(i % 50).padStart(22, '0')}` }],
    time: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
  }))
  const text = JSON.stringify(watch)
  assert.ok(text.length > 4 << 20, 'the file is bigger than one part')
  const result = await readExports([new File([text], 'Takeout/My Activity/YouTube/MyActivity.json')])
  assert.equal(result.summaries.find((s) => s.source === 'takeout')?.stats.watchedVideos, n)
  assert.ok(result.recognised.some((r) => r.includes(`${n.toLocaleString('en-US')} watched videos`)), result.recognised.join(' | '))
})

test('a large JSON file that is no activity log is still read as before', async () => {
  const n = 50_000
  const plays = Array.from({ length: n }, (_, i) => ({
    ts: `2026-01-01T00:${String(i % 60).padStart(2, '0')}:00Z`,
    ms_played: 60_000,
    master_metadata_track_name: `Track ${i}`,
    master_metadata_album_artist_name: `Artist ${i % 200}`,
  }))
  const text = JSON.stringify(plays)
  assert.ok(text.length > 4 << 20, 'the file is bigger than one part')
  const result = await readExports([new File([text], 'StreamingHistory_music_0.json')])
  assert.equal(result.summaries.find((s) => s.source === 'spotify-export')?.dataPoints, n)
})
