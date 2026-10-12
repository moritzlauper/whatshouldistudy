import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isGenericTopic, textTopics } from '../lib/engine/classifier.ts'
import { accumulate } from '../lib/engine/accumulate.ts'
import { userTopics } from '../lib/engine/topics.ts'
import { score } from '../lib/engine/scoring.ts'
import { validatedTopics } from '../lib/engine/programme-fit.ts'
import type { SignalItem } from '../lib/engine/types.ts'

const year = new Date().getFullYear()
const at = (y: number, m = 3) => Date.UTC(y, m, 2)
const watch = (title: string, channel: string, time: number): SignalItem => ({ kind: 'watch', text: `${title} \n ${channel}`, label: channel, weight: 0.3, time, group: channel })

test('society and Gesellschaft name the field, not a topic', () => {
  for (const word of ['society', 'Gesellschaft', 'sociedad', 'società', 'Société']) {
    const keys = textTopics(word)
    assert.ok(keys.length > 0, `${word} is matched`)
    assert.ok(keys.every((k) => isGenericTopic(k)), `${word} gives ${keys.join(', ')}`)
  }
  assert.ok(isGenericTopic('p:gesellschaftlich'))
  assert.equal(isGenericTopic('soziale ungleichheit'), false)
  assert.equal(isGenericTopic('gesellschaftskritik'), false)
})

test('generic words are no topic of yours, and no term shown for a field, but the field still counts them', () => {
  const s = accumulate(
    [
      ...Array.from({ length: 30 }, (_, i) => watch(`Ageing society ${i}`, 'Demo Kanal', at(year, i % 10))),
      ...Array.from({ length: 3 }, (_, i) => watch(`Soziale Ungleichheit in der Schweiz ${i}`, 'Demo Kanal', at(year, i))),
    ],
    { source: 'takeout', label: 'YouTube' },
  )
  assert.ok(s.topics?.society, 'the stored summary still records the word')
  const mine = userTopics([s]).map((t) => t.key)
  assert.ok(mine.includes('soziale ungleichheit'), `kept: ${mine.join(', ')}`)
  assert.equal(mine.some((k) => isGenericTopic(k)), false, `left: ${mine.join(', ')}`)
  const sociology = score({ summaries: [s] }).fields.find((f) => f.id === 'sociology')
  assert.ok(sociology, 'sociology is still found')
  assert.equal(sociology.terms.includes('society'), false)
})

test('a generic word sent by an older browser is dropped before it reaches the matching or the comparison', () => {
  assert.deepEqual(validatedTopics({ society: 1, 'soziale ungleichheit': 0.5 }), { 'soziale ungleichheit': 0.5 })
})
