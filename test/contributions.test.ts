import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readTexts } from '../lib/sources/exports.ts'
import { score } from '../lib/engine/scoring.ts'

const watch = Array.from({ length: 40 }, (_, i) => ({
  header: 'YouTube',
  title: `Watched ${['Soziale Ungleichheit erklärt', 'Bourdieu einfach erklärt', 'Klassismus an der Uni', 'Rassismus im Alltag'][i % 4]}`,
  titleUrl: `https://www.youtube.com/watch?v=s${i}`,
  subtitles: [{ name: `Kanal ${i % 5}` }],
  time: new Date(Date.UTC(2023, i % 12, 1 + (i % 27))).toISOString(),
}))
const searches = Array.from({ length: 20 }, (_, i) => ({
  header: 'Search',
  title: `Searched for ${['soziale ungleichheit schweiz', 'bourdieu kapitalsorten', 'klassismus beispiele', 'soziologie gesellschaft'][i % 4]} ${i}`,
  titleUrl: `https://www.google.com/search?q=${encodeURIComponent(['soziale ungleichheit schweiz', 'bourdieu kapitalsorten', 'klassismus beispiele', 'soziologie gesellschaft'][i % 4] + ' ' + i)}`,
  time: new Date(Date.UTC(2024, i % 12, 3)).toISOString(),
}))

test('splits each match into what every source and questionnaire part added', async () => {
  const r = await readTexts([
    { name: 'Takeout/YouTube/history/watch-history.json', text: JSON.stringify(watch) },
    { name: 'Takeout/My Activity/Search/MyActivity.json', text: JSON.stringify(searches) },
  ])
  const res = score({ summaries: r.summaries })
  const soc = res.fields.find((f) => f.id === 'sociology')!
  const c = soc.contributions ?? []
  assert.ok(Math.abs(c.reduce((s, x) => s + x.share, 0) - 1) < 1e-6)
  const keys = c.map((x) => x.key)
  assert.ok(keys.includes('takeout') && keys.includes('google-search'), keys.join(','))
  // Without a questionnaire the interest type comes from the data.
  assert.ok(!keys.includes('riasec'))
})
