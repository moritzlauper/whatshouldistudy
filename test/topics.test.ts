import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify, textTopics, topFields } from '../lib/engine/classifier.ts'
import { accumulate } from '../lib/engine/accumulate.ts'
import { userTopics } from '../lib/engine/topics.ts'
import { score } from '../lib/engine/scoring.ts'
import type { SignalItem } from '../lib/engine/types.ts'
import { FIELDS } from '../lib/taxonomy/fields.ts'

const year = new Date().getFullYear()
const at = (y: number, m = 3) => Date.UTC(y, m, 2)
const watch = (title: string, channel: string, time: number): SignalItem => ({ kind: 'watch', text: `${title} \n ${channel}`, label: channel, weight: 0.3, time, group: channel })

test('topics keep the video title as an example, not just the channel', () => {
  const s = accumulate(
    [
      watch('Warum wir ins Theater gehen', 'Kulturplatz', at(year)),
      watch('Theater Basel: Hinter der Bühne', 'SRF Kultur', at(year)),
      watch('Improtheater für Anfänger', 'Impro Zürich', at(year)),
    ],
    { source: 'takeout', label: 'YouTube' },
  )
  const theater = Object.entries(s.topics ?? {}).find(([, t]) => t.w === 'theater')
  assert.ok(theater, 'theater is a topic')
  assert.equal(theater![1].n, 2)
  assert.match(theater![1].ex[0], /^Warum wir ins Theater gehen · Kulturplatz$/)
})

test('a programme description and your topics meet on the same keys', () => {
  const s = accumulate(
    [watch('Storytelling im Film: so baut Pixar Geschichten', 'Film Nerd', at(year)), watch('Drehbuch schreiben: die ersten 10 Seiten', 'Film Nerd', at(year)), watch('Kurzfilm drehen mit dem Handy', 'Film Nerd', at(year))],
    { source: 'takeout', label: 'YouTube' },
  )
  const mine = userTopics([s])
  const programme = textTopics('Master Film \n Drehbuch, Regie, Kamera \n Studierende entwickeln eigene Kurzfilme und Drehbücher.')
  const shared = mine.filter((t) => programme.includes(t.key))
  assert.ok(shared.length >= 2, `shared topics: ${shared.map((t) => t.word).join(', ')}`)
  assert.ok(shared[0].examples.length > 0)
})

test('a degree under way never makes its topics bigger than they were before', () => {
  const items = [
    ...Array.from({ length: 10 }, (_, i) => watch(`Soziologie der Stadt ${i}`, 'Stadt Kanal', at(year - 3, i))),
    ...Array.from({ length: 4 }, (_, i) => watch(`Psychologie im Alltag ${i}`, 'Psych Kanal', at(year - 3, i))),
    ...Array.from({ length: 40 }, (_, i) => watch(`Psychologie Vorlesung ${i}`, 'Uni Kanal', at(year, i % 10))),
    ...Array.from({ length: 8 }, (_, i) => watch(`Soziologie heute ${i}`, 'Stadt Kanal', at(year, i))),
  ]
  const s = accumulate(items, { source: 'takeout', label: 'YouTube' })
  const w = (list: ReturnType<typeof userTopics>, word: RegExp) => list.find((t) => word.test(t.word))?.weight ?? 0
  const before = userTopics([s])
  const after = userTopics([s], { field: 'psychology', since: year - 1 })
  assert.ok(w(before, /^psycholog/) > w(before, /^soziolog/))
  assert.ok(w(after, /^psycholog/) < w(after, /^soziolog/))
  // «Psychologie» is one topic, not two.
  assert.equal(before.filter((t) => /^psycholog/.test(t.word)).length, 1)
  // The field ranking follows the same rule.
  const ranked = (studying?: { field: string; since: number }) => score({ summaries: [s], studying }).fields.map((f) => f.id)
  const without = ranked()
  const withStudy = ranked({ field: 'psychology', since: year - 1 })
  assert.ok(without.indexOf('psychology') < without.indexOf('sociology'))
  assert.ok(withStudy.indexOf('sociology') < withStudy.indexOf('psychology'))
})

test('only telling words become topics', () => {
  const keys = textTopics('Food and media in the city')
  assert.equal(keys.length, 0)
  assert.ok(classify('Food and media').matched.length > 0)
})

test('film and TV stars are not theatre', () => {
  const pa = FIELDS.findIndex((f) => f.id === 'performing-arts')
  const strength = (text: string) => classify(text).raw[pa]
  // Weak hints at most, below what makes an item count as evidence.
  assert.ok(strength('Best acting moments: Leonardo DiCaprio and other actors') < 1)
  assert.ok(strength('Schauspielerin Margot Robbie im Interview') < 1)
  assert.equal(strength('Opera GX browser review'), 0)
  assert.equal(strength('Home theater setup 2025'), 0)
  assert.equal(topFields('Vorsprechen an der Schauspielschule: mein Monolog', 1)[0]?.id, 'performing-arts')
  assert.equal(topFields('Theater Basel: Inszenierung und Bühnenbild', 1)[0]?.id, 'performing-arts')
})

test('social media and Gen Z read as society, not media studies', () => {
  assert.equal(topFields('Gen Z is nihilistic??? social media made us lonely', 1)[0]?.id, 'sociology')
})
