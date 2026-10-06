import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readTexts } from '../lib/sources/exports.ts'
import { score } from '../lib/engine/scoring.ts'
import { decodeSnapshot, encodeSnapshot, sharedParam } from '../lib/share.ts'

test('a shared link carries the result but nothing personal', async () => {
  const watch = Array.from({ length: 30 }, (_, i) => ({
    header: 'YouTube',
    title: `Watched Geheimes Video über Bourdieu und soziale Ungleichheit ${i}`,
    titleUrl: `https://www.youtube.com/watch?v=x${i}`,
    subtitles: [{ name: 'Privater Kanal' }],
    time: new Date(Date.UTC(2023, i % 12, 2)).toISOString(),
  }))
  const r = await readTexts([{ name: 'Takeout/YouTube/history/watch-history.json', text: JSON.stringify(watch) }])
  const res = score({ summaries: r.summaries })
  const code = encodeSnapshot(res, { level: 'master', countries: ['CH'], maxTuitionEur: 0, origin: 'ch', englishOnly: false })
  assert.match(code, /^[A-Za-z0-9_-]+$/)
  assert.ok(code.length < 4000, `link too long: ${code.length}`)
  const snap = decodeSnapshot(code)!
  assert.equal(snap.results.fields[0].id, res.fields[0].id)
  assert.deepEqual(snap.prefs, { countries: ['CH'], level: 'master' })
  const text = JSON.stringify(snap)
  assert.ok(!/Geheimes|Privater|bourdieu/i.test(text), 'personal data leaked into the link')
  assert.equal(sharedParam(`#s=${code}`), code)
  assert.equal(decodeSnapshot('broken'), null)
})
