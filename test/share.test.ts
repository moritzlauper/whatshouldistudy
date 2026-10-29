import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readTexts } from '../lib/sources/exports.ts'
import { INTEREST_ITEMS } from '../lib/engine/questionnaire.ts'
import { score } from '../lib/engine/scoring.ts'
import { decodeSnapshot, encodeSnapshot, sharedParam } from '../lib/share.ts'

test('a shared link carries the personal profile but excludes raw history and topics', async () => {
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
  const filtered = decodeSnapshot(encodeSnapshot(res, { level: 'bachelor', countries: ['CH'], institutionType: 'fh', maxTuitionEur: 0, origin: 'ch', englishOnly: false }))!
  assert.equal(filtered.prefs.institutionType, 'fh')
  const text = JSON.stringify(snap)
  assert.ok(!/Geheimes|Privater|bourdieu/i.test(text), 'raw history or topics leaked into the link')
  assert.equal(sharedParam(`#s=${code}`), code)
  assert.equal(decodeSnapshot('broken'), null)
})


test('shared results keep the basic interests and leave legacy personality means uninterpreted', () => {
  const answers = { interests: Object.fromEntries(INTEREST_ITEMS.map((i, n) => [i.id, n % 5 + 1])) }
  const result = score({ summaries: [], answers })
  const prefs = { level: 'bachelor' as const, countries: ['CH'], maxTuitionEur: 0, origin: 'ch' as const, englishOnly: false }
  const restored = decodeSnapshot(encodeSnapshot(result, prefs))!
  assert.deepEqual(restored.results.basic, result.basic)
  assert.equal(restored.results.big5, undefined)
  const legacy = { ...result, big5: { z: { O: 1, C: 0, E: 0, A: 0, N: 0 }, from: ['questionnaire'], confidence: .6 } }
  assert.equal(decodeSnapshot(encodeSnapshot(legacy, prefs))!.results.big5?.means, undefined)
})
