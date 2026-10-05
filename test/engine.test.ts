import { test } from 'node:test'
import assert from 'node:assert/strict'
import { topFields } from '../lib/engine/classifier.ts'
import { accumulate } from '../lib/engine/accumulate.ts'
import { score } from '../lib/engine/scoring.ts'
import { scoreBig5, scoreRiasec, riasecCode } from '../lib/engine/questionnaire.ts'
import { genresToProfile, musicBig5 } from '../lib/engine/music.ts'
import { FIELDS } from '../lib/taxonomy/fields.ts'
import { LEXICON } from '../lib/taxonomy/lexicon.ts'
import type { SignalItem } from '../lib/engine/types.ts'

const top = (text: string) => topFields(text, 1)[0]?.id

test('every field has lexicon terms and sane numbers', () => {
  for (const f of FIELDS) {
    assert.ok(LEXICON[f.id], `lexicon for ${f.id}`)
    assert.equal(f.riasec.length, 6)
    for (const x of f.riasec) assert.ok(x >= 0 && x <= 1, `${f.id} riasec`)
    assert.ok(f.popularity > 0)
  }
  assert.equal(new Set(FIELDS.map((f) => f.id)).size, FIELDS.length)
})

test('classifies content titles in several languages', () => {
  assert.equal(top('The Essence of Calculus, Chapter 1 - 3Blue1Brown'), 'mathematics')
  assert.equal(top('Quantenmechanik einfach erklärt'), 'physics')
  assert.equal(top('But what is a neural network? | Deep learning chapter 1'), 'artificial-intelligence')
  assert.equal(top('Why Cities Are Car Dependent | Not Just Bikes'), 'urban-planning')
  assert.equal(top('Le Réveilleur : le changement climatique expliqué'), 'environmental-science')
  assert.equal(top('I Built a Robot Arm with Arduino'), 'robotics-mechatronics')
  assert.equal(top('Wirtschaftsinformatik studieren - lohnt es sich?'), 'information-systems')
  assert.equal(top("Minecraft Let's Play #42 funny moments"), undefined)
  assert.equal(top('Ho dato ai miei amici'), undefined, 'Italian "ai" is not AI')
})

test('classifies programme names from the data sources', () => {
  assert.equal(top('Licence - Informatique'), 'computer-science')
  assert.equal(top("PASS - Parcours d'accès spécifique santé"), 'medicine')
  assert.equal(top('BSc (Hons) Mechanical Engineering'), 'mechanical-engineering')
  assert.equal(top('MEng Aerospace Engineering'), 'aerospace-engineering')
  assert.equal(top('B.Sc. Maschinenbau'), 'mechanical-engineering')
  assert.equal(top('BA (Hons) Graphic Design'), 'graphic-design')
  assert.equal(top('Licence - Psychologie'), 'psychology')
  assert.equal(top('BTS - Services - Tourisme'), 'hospitality-tourism')
})

function video(title: string, channel: string, time: number, extra: Partial<SignalItem> = {}): SignalItem {
  return { kind: 'watch', text: `${title} ${channel}`, label: channel, group: channel, weight: 0.3, time, ...extra }
}

const MONTH = 30.44 * 864e5
const T0 = Date.UTC(2023, 0, 15)

/** An engineering-and-space person who also watches a lot of gaming and music. */
function engineeringPerson(): SignalItem[] {
  const items: SignalItem[] = []
  for (let m = 0; m < 30; m++) {
    const t = T0 + m * MONTH
    items.push(video('How rocket engines work', 'Everyday Astronaut', t))
    items.push(video('Why the SR-71 was so fast: aerodynamics explained', 'Real Engineering', t + 864e5))
    items.push(video('Building a CNC machine from scratch', 'Stuff Made Here', t + 2 * 864e5))
    if (m % 3 === 0) items.push(video('Black holes and neutron stars', 'Dr Becky', t + 3 * 864e5))
    for (let k = 0; k < 12; k++) items.push(video(`Fortnite gameplay funny moments #${m * 12 + k}`, 'Some Streamer', t + k * 3600e3))
    for (let k = 0; k < 8; k++) items.push(video(`Official Music Video ${k}`, 'Pop Star', t + k * 7200e3, { isMusic: true }))
    items.push(video('Vlog: my week in Zurich', 'Vlogger', t + 5 * 864e5))
  }
  return items
}

/** Someone into psychology, cooking and true crime. */
function peoplePerson(): SignalItem[] {
  const items: SignalItem[] = []
  for (let m = 0; m < 24; m++) {
    const t = T0 + m * MONTH
    items.push(video('Signs of an anxious attachment style', 'Psych2Go', t))
    items.push(video('What narcissism really is: a psychologist explains', 'Dr Ramani', t + 864e5))
    items.push(video('The perfect sourdough recipe', 'Joshua Weissman', t + 2 * 864e5))
    items.push(video('The cold case that was finally solved', 'JCS Criminal Psychology', t + 3 * 864e5))
    for (let k = 0; k < 10; k++) items.push(video(`Reaction to TikToks #${m * 10 + k}`, 'Reactor', t + k * 3600e3))
  }
  return items
}

test('engineering footprint ranks engineering and space fields on top', () => {
  const summary = accumulate(engineeringPerson(), { source: 'takeout', label: 'YouTube history' })
  const r = score({ summaries: [summary] })
  const top5 = r.fields.slice(0, 5).map((f) => f.id)
  assert.ok(top5.includes('aerospace-engineering'), top5.join())
  assert.ok(top5.includes('mechanical-engineering'), top5.join())
  assert.ok(!top5.includes('game-design'), 'gaming entertainment should not make game design a top pick')
  assert.ok(r.fields[0].score >= 85 && r.fields[0].score <= 100)
  assert.ok(r.riasec.code.startsWith('R') || r.riasec.code.startsWith('I'), r.riasec.code)
  const aero = r.fields.find((f) => f.id === 'aerospace-engineering')!
  assert.ok(aero.evidence.some((e) => e.label === 'Everyday Astronaut'))
  assert.ok((aero.persistence ?? 0) > 0.8)
})

test('people footprint ranks psychology on top and keeps entertainment out', () => {
  const summary = accumulate(peoplePerson(), { source: 'takeout', label: 'YouTube history' })
  const r = score({ summaries: [summary] })
  assert.equal(r.fields[0].id, 'psychology', r.fields.slice(0, 5).map((f) => f.id).join())
  const top6 = r.fields.slice(0, 6).map((f) => f.id)
  assert.ok(top6.includes('criminology'), top6.join())
  assert.ok(top6.includes('culinary-arts'), top6.join())
})

test('questionnaire shifts the ranking when there is no footprint', () => {
  const answers = {
    riasec: { r1: 1, r2: 1, r3: 1, i1: 4, i2: 3, i3: 4, a1: 2, a2: 2, a3: 1, s1: 5, s2: 5, s3: 5, e1: 2, e2: 1, e3: 3, c1: 3, c2: 2, c3: 3 },
    subjects: { bio: { enjoy: 5, grade: 5 }, chem: { enjoy: 4, grade: 4 }, math: { enjoy: 2, grade: 3 }, art: { enjoy: 2, grade: 2 }, social: { enjoy: 4, grade: 4 } },
    values: { helping: 5, security: 5, salary: 3, creativity: 1 },
  }
  const r = score({ summaries: [], answers })
  const top8 = r.fields.slice(0, 8).map((f) => f.id)
  assert.ok(top8.some((id) => ['medicine', 'nursing', 'physiotherapy', 'pharmacy', 'veterinary-medicine'].includes(id)), top8.join())
  assert.equal(r.confidence, 'low')
  assert.equal(riasecCode(scoreRiasec(answers)!)[0], 'S')
})

test('Mini-IPIP scoring handles reverse-keyed items', () => {
  const all5 = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`b${i + 1}`, 5]))
  const all1 = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`b${i + 1}`, 1]))
  // Agreeing (or disagreeing) with everything cancels out within each two-plus/two-minus scale.
  const z5 = scoreBig5({ big5: all5 })!
  const z1 = scoreBig5({ big5: all1 })!
  for (const k of ['E', 'A', 'C', 'N'] as const) assert.ok(Math.abs(z5[k] - z1[k]) < 1e-9, k)
  const open = scoreBig5({ big5: { ...all5, b10: 1, b15: 1, b20: 1 } })!
  assert.ok(open.O > 1)
})

test('music taste gives small, bounded nudges', () => {
  const classical = genresToProfile(new Map([['classical', 10], ['jazz', 5], ['baroque', 3]]), 20)
  const nudge = musicBig5(classical)
  assert.ok((nudge.O ?? 0) > 0.2)
  for (const v of Object.values(nudge)) assert.ok(Math.abs(v!) <= 0.6)
})

test('summaries only keep aggregates, never the raw history', () => {
  const summary = accumulate(engineeringPerson(), { source: 'takeout', label: 'YouTube history' })
  const json = JSON.stringify(summary)
  assert.ok(!json.includes('Fortnite gameplay funny moments #1'))
  assert.ok(json.length < 60_000, `summary is ${json.length} bytes`)
})
