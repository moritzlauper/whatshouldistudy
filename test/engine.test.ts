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
  return { kind: 'watch', text: `${title} \n ${channel}`, label: channel, group: channel, weight: 0.3, time, ...extra }
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
  assert.ok(aero.evidence.some((e) => e.label.endsWith('· Everyday Astronaut')))
  assert.ok((aero.persistence ?? 0) > 0.8)
  // A large history alone is a solid result, not a rough sketch; «high» needs the questionnaire.
  assert.equal(r.confidence, 'medium')
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
  // The questionnaire alone is the standard: half the interest items answered gives a medium-confidence result.
  assert.equal(r.confidence, 'medium')
  assert.equal(r.quality?.questionnaireLed, true)
  assert.equal(riasecCode(scoreRiasec(answers)!)[0], 'S')
})

test('questionnaire quality: no filling-in, flat profiles, careless answering, one gate', async () => {
  const q = await import('../lib/engine/questionnaire.ts')
  // A type with fewer than two answers isn't «neutral»: no profile yet.
  assert.equal(q.scoreRiasec({ riasec: { r1: 5, r2: 5, i1: 1, i2: 1, a1: 3, a2: 3, s1: 4, s2: 4, e1: 2, e2: 2, c1: 3 } }), null)
  assert.equal(q.resultsReady({ riasec: { r1: 5 } }, 0), false)
  assert.equal(q.resultsReady({}, 1), false)
  // All threes: flat, low confidence, said so; the first places are a tie.
  const flatAnswers = { riasec: Object.fromEntries(q.RIASEC_ITEMS.map((i) => [i.id, 3])) }
  const flat = score({ summaries: [], answers: flatAnswers })
  assert.equal(flat.quality?.flat, true)
  assert.equal(flat.confidence, 'low')
  // Ten identical answers in a row, or the attention item answered wrongly, mark the result.
  assert.equal(flat.quality?.careless, true)
  const varied = Object.fromEntries(q.RIASEC_ITEMS.map((i, n) => [i.id, (n % 5) + 1]))
  assert.equal(q.careless({ riasec: varied }), false)
  assert.equal(q.careless({ riasec: { ...varied, chk: 5 } }), true)
  assert.equal(q.careless({ riasec: { ...varied, chk: 2 } }), false)
  assert.equal(q.RIASEC_ITEMS.length, 24)
  assert.equal(q.INTEREST_LIST.filter((i) => i.key === 'check').length, 1)
  assert.equal(q.INTEREST_LIST[12].id, 'chk')
  for (const key of ['R', 'I', 'A', 'S', 'E', 'C']) {
    assert.equal(q.RIASEC_ITEMS.filter((i) => i.key === key).length, 4)
  }
  const run = (n: number) => ({ riasec: Object.fromEntries(q.INTEREST_LIST.slice(0, n).map((i) => [i.id, 4])) })
  assert.equal(q.careless(run(9)), false)
  assert.equal(q.careless(run(10)), true)
  const interrupted = run(10)
  delete interrupted.riasec.a1
  assert.equal(q.careless(interrupted), false)
})

test('short questionnaire keeps retained IDs and ignores retired answers in scores and progress', async () => {
  const q = await import('../lib/engine/questionnaire.ts')
  const current = Object.fromEntries(q.INTEREST_LIST.map((i, n) => [i.id, i.id === 'chk' ? 2 : n % 5 + 1]))
  const legacy = { ...current, r3: 5, r4: 5, i4: 5, i5: 5, a4: 5, a6: 5, s5: 5, s6: 5, e5: 5, e6: 5, c3: 5, c5: 5 }
  assert.equal(q.RIASEC_ITEMS.find((i) => i.id === 'r5')?.text, 'Grow plants or look after animals')
  assert.deepEqual(q.scoreRiasec({ riasec: legacy }), q.scoreRiasec({ riasec: current }))
  assert.equal(q.riasecCompleteness({ riasec: legacy }), 1)
  const big5 = Object.fromEntries(q.BIG5_ITEMS.map((i) => [i.id, 4]))
  const progress = q.questionnaireProgress({ riasec: legacy, big5 })
  assert.deepEqual(progress, { done: 45, total: 67 })
  assert.deepEqual(q.questionnaireProgress({ riasec: current, big5 }), progress)
  assert.deepEqual(q.questionnaireProgress({ riasec: current }), { done: 25, total: 67 })
  const minimal = Object.fromEntries(['r1', 'r2', 'i1', 'i2', 'a1', 'a2', 's1', 's2', 'e1', 'e2', 'c1', 'c2'].map((id, n) => [id, n % 5 + 1]))
  assert.equal(q.resultsReady({ riasec: minimal, big5 }, 0), true)
  delete minimal.c2
  assert.equal(q.resultsReady({ riasec: minimal, big5 }, 0), false)
})

test('all personality answers are required for questionnaire and imported-data results', async () => {
  const q = await import('../lib/engine/questionnaire.ts')
  const riasec = Object.fromEntries(q.RIASEC_ITEMS.map((i, n) => [i.id, n % 5 + 1]))
  const big5 = Object.fromEntries(q.BIG5_ITEMS.map((i, n) => [i.id, n % 5 + 1]))
  assert.equal(q.resultsReady({ riasec }, 0), false)
  assert.equal(q.resultsReady({ riasec }, 3), false)
  assert.equal(q.resultsReady({ big5 }, 0), false, 'personality alone does not replace interests or data')
  assert.equal(q.resultsReady({ big5 }, 1), true)
  assert.equal(q.resultsReady({ riasec, big5 }, 0), true)
  for (const item of q.BIG5_ITEMS) {
    const partial = { ...big5 }
    delete partial[item.id]
    assert.equal(q.big5Answered({ big5: partial }), 19)
    assert.equal(q.resultsReady({ riasec, big5: partial }, 0), false)
    assert.equal(q.resultsReady({ big5: partial }, 3), false)
  }
  for (const invalid of [0, 6, 1.5, NaN, Infinity]) {
    const invalidAnswers = { big5: { ...big5, b1: invalid, retired: 3 } }
    assert.equal(q.big5Answered(invalidAnswers), 19)
    assert.equal(q.resultsReady(invalidAnswers, 1), false)
    assert.deepEqual(q.questionnaireProgress(invalidAnswers), { done: 19, total: 67 })
  }
})

test('with the questionnaire answered, data move a field by at most a quarter', () => {
  const riasec = Object.fromEntries(['r', 'i', 'a', 's', 'e', 'c'].flatMap((k) => [1, 2, 3, 4, 5, 6].map((n) => [`${k}${n}`, k === 's' ? 5 : k === 'i' ? 4 : 2])))
  const base = score({ summaries: [], answers: { riasec } })
  const summary = accumulate(engineeringPerson(), { source: 'takeout', label: 'YouTube history' })
  const both = score({ summaries: [summary], answers: { riasec } })
  for (const m of both.fields) {
    const b = base.fields.find((x) => x.id === m.id)!
    assert.ok(Math.abs(m.match - b.match) <= 0.25 + 1e-9, `${m.id} ${b.match} → ${m.match}`)
  }
  assert.equal(both.quality?.questionnaireLed, true)
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

test('old activity fades and a degree under way stops counting as interest', async () => {
  const { ageWeight, score } = await import('../lib/engine/scoring.ts')
  const now = 2026
  assert.equal(ageWeight(2026, 'takeout', now), 1)
  assert.equal(ageWeight(2025, 'takeout', now), 1)
  assert.ok(ageWeight(2021, 'takeout', now) < 0.5)
  assert.equal(ageWeight(2016, 'takeout', now), 0)
  assert.equal(ageWeight(1961, 'takeout', now), 0)
  assert.ok(ageWeight(2016, 'youtube', now) > 0)

  const year = new Date().getFullYear()
  const fields = { psychology: { score: 50, items: 60, months: [`${year}-01`], top: [], terms: {} }, sociology: { score: 20, items: 25, months: [`${year - 2}-01`], top: [], terms: {} } }
  const summary: import('../lib/engine/types.ts').SourceSummary = {
    source: 'google-search', label: 'Google', collectedAt: '', dataPoints: 5000, totalWeight: 100, learningWeight: 20, stats: {},
    fields,
    timeline: { [String(year - 2)]: { psychology: 5, sociology: 20 } as Record<string, number>, [String(year)]: { psychology: 45 } as Record<string, number> },
  }
  const plain = score({ summaries: [summary] })
  const studying = score({ summaries: [summary], studying: { field: 'psychology', since: year } })
  const rank = (r: typeof plain, id: string) => r.fields.findIndex((f) => f.id === id)
  assert.ok(rank(studying, 'psychology') > rank(plain, 'psychology'), 'psychology should drop')
  assert.ok(rank(studying, 'sociology') < rank(plain, 'sociology'), 'sociology should rise')
  assert.ok(studying.fields.find((f) => f.id === 'psychology')!.reasons.some((r) => r.k === 'studying'))
  assert.ok(!studying.timeline.find((y) => y.year === String(year))?.fields.some((f) => f.id === 'psychology'))
})

test('false friends: singers, films, costumes and series lookups are not subject interest', () => {
  const ids = (t: string) => topFields(t, 3).map((f) => f.id)
  assert.ok(!ids('Frank Ocean - Pink + White').includes('marine-biology'))
  assert.ok(!ids("Ocean's Eleven ganzer Film").includes('marine-biology'))
  assert.ok(!ids('Pfarrer Kostüm Fasnacht').includes('religious-studies'))
  assert.ok(!ids('nurse outfit halloween').includes('nursing'))
  assert.ok(!ids('prison break staffel 2').includes('criminology'))
  assert.equal(ids('best true crime imdb').length, 0)
  // The real subject still counts.
  assert.ok(ids('ocean currents and marine ecosystems').includes('marine-biology'))
  assert.ok(ids('Kriminologie studieren an der Uni').includes('criminology'))
})

test('more false friends: ambient sounds, cat TV, TV judges and climate talk about the planet', () => {
  const ids = (t: string) => topFields(t, 3).map((f) => f.id)
  assert.ok(!ids('rain sounds for sleeping 3 hours').includes('zoology'))
  assert.ok(!ids('jungle sounds white noise').includes('zoology'))
  assert.ok(!ids('cat tv for cats 4k').includes('zoology'))
  assert.ok(!ids('Judge Rinder show episode').includes('law'))
  assert.ok(!ids('save the planet vegan recipes').includes('astronomy'))
  assert.ok(!ids('planet based diet').includes('astronomy'))
})
