import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accumulate } from '../lib/engine/accumulate.ts'
import { contentPlan } from '../lib/engine/content-analysis.ts'
import { ageWeight, computeInterest, score, SOURCE_RELIABILITY } from '../lib/engine/scoring.ts'
import { userTopics } from '../lib/engine/topics.ts'
import type { SignalItem } from '../lib/engine/types.ts'

const year = new Date().getFullYear()
const watch = (title: string, ago: number): SignalItem => ({ kind: 'watch', text: `${title}\nExample channel`, label: 'Example channel', group: 'example', weight: 1, time: Date.UTC(year - ago, 0, 1) })

test('current content outweighs equally frequent older content in fields and programme topics', () => {
  const items = [watch('Quantum physics', 0), watch('Theatre acting', 4)]
  const s = accumulate(items, { source: 'takeout', label: 'Test' })
  const reversed = accumulate([watch('Quantum physics', 4), watch('Theatre acting', 0)], { source: 'takeout', label: 'Test' })
  assert.ok(computeInterest([s]).byField.get('physics')!.value > computeInterest([reversed]).byField.get('physics')!.value)
  const topics = userTopics([s])
  const reverseTopics = userTopics([reversed])
  const physics = topics.find(t => /physic/.test(t.key))!
  assert.ok(physics)
  assert.ok(physics.weight > reverseTopics.find(t => t.key === physics.key)!.weight)
  assert.ok(SOURCE_RELIABILITY.takeout > 5 * SOURCE_RELIABILITY['google-search'])
})

test('childhood activity remains historical and does not add confidence, current topics or AI context', () => {
  const old = watch('Quantum physics', 12)
  const s = accumulate([old], { source: 'takeout', label: 'Test' })
  assert.ok(s.timeline?.[year - 12]?.physics)
  assert.equal(computeInterest([s]).confidence, 0)
  assert.deepEqual(userTopics([s]), [])
  assert.equal(contentPlan([old]).items.length, 0)
  assert.ok(score({ summaries: [s] }).timeline.some(t => t.year === String(year - 12)))
  for (const source of ['takeout', 'google-search', 'youtube'] as const) {
    assert.equal(ageWeight(year - 6, source), 0)
    assert.equal(ageWeight(year - 4, source), 0.25)
    assert.equal(ageWeight(year - 2, source), 0.5)
  }
})

test('missing titles cannot acquire meaning from channel context, including stored AI inputs', () => {
  const missing = watch('https://www.youtube.com/watch?v=missing0001', 0)
  const old = watch('Old title', 12)
  const input = [watch('Quantum physics', 0), watch('Particle physics', 0), missing, old]
  const plan = contentPlan(input)
  assert.ok(plan.items.every(it => !it.title.includes('missing0001') && it.title !== 'Old title'))
  const interpreted = plan.apply(plan.items.map(it => ({ id: it.id, fields: { physics: 0.9 }, reason: 'Test subject' })))
  assert.equal(interpreted[2].contextMeaning, undefined)
  assert.equal(interpreted[3].contextMeaning, undefined)
  const s = accumulate([missing], { source: 'takeout', label: 'Test' })
  assert.equal(s.dataPoints, 0)
  assert.deepEqual(s.fields, {})
})
