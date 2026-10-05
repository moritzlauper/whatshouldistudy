import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readTexts } from '../lib/sources/exports.ts'

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
  const r = await readTexts([{ name: 'archive_browser.html', text: '<html><body>Hello</body></html>' }])
  assert.equal(r.summaries.length, 0)
  assert.equal(r.skipped.length, 1)
})

test('reads Google searches from My Activity', async () => {
  const search = [
    { header: 'Suche', title: 'Gesucht nach: quantum physics lecture', titleUrl: 'https://www.google.com/search?q=quantum+physics+lecture', time: '2024-04-02T10:00:00.000Z', products: ['Suche'] },
    { header: 'Suche', title: 'Besucht: example.org', titleUrl: 'https://www.google.com/url?q=https://example.org', time: '2024-04-02T10:01:00.000Z', products: ['Suche'] },
  ]
  const r = await readTexts([{ name: 'Takeout/Meine Aktivitäten/Google Suche/MeineAktivitäten.json', text: JSON.stringify(search) }])
  const s = r.summaries.find((x) => x.source === 'takeout')!
  assert.equal(s.stats.googleSearches, 1)
  assert.ok(s.fields.physics.score > 0)
})
