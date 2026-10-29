import { test } from 'node:test'
import assert from 'node:assert/strict'
import { topFields } from '../lib/engine/classifier.ts'
import { accumulate } from '../lib/engine/accumulate.ts'
import { score } from '../lib/engine/scoring.ts'
import { RIASEC_ITEMS, big5Means, scoreBig5, scoreRiasec, riasecCode } from '../lib/engine/questionnaire.ts'
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

/** Answers for items 1..n of every type, `level(type, item)` deciding each. */
const answersFor = (n: number, level: (k: string, i: number) => number) =>
  Object.fromEntries(['r', 'i', 'a', 's', 'e', 'c'].flatMap((k) => Array.from({ length: n }, (_, i) => [`${k}${i + 1}`, level(k, i)])))

test('questionnaire shifts the ranking when there is no footprint', () => {
  const base: Record<string, number> = { r: 1, i: 4, a: 2, s: 5, e: 2, c: 3 }
  const answers = {
    riasec: answersFor(6, (k, i) => Math.max(1, Math.min(5, base[k] + (i % 3 === 2 ? -1 : 0)))),
    subjects: { bio: { enjoy: 5 }, chem: { enjoy: 4 }, math: { enjoy: 2 }, art: { enjoy: 2 }, social: { enjoy: 4 } },
    values: { helping: 5, security: 5, salary: 3, creativity: 1 },
  }
  const r = score({ summaries: [], answers })
  const top8 = r.fields.slice(0, 8).map((f) => f.id)
  assert.ok(top8.some((id) => ['medicine', 'nursing', 'physiotherapy', 'pharmacy', 'veterinary-medicine'].includes(id)), top8.join())
  // Six of eight items per type: enough for a result, not for «high».
  assert.equal(r.confidence, 'medium')
  assert.equal(r.quality?.questionnaireLed, true)
  assert.equal(riasecCode(scoreRiasec(answers)!)[0], 'S')
})

test('questionnaire quality: no filling-in, flat profiles, careless answering, one gate', async () => {
  const q = await import('../lib/engine/questionnaire.ts')
  // A type with fewer than six answers isn't «neutral»: no profile yet.
  assert.equal(q.MIN_PER_TYPE, 6)
  assert.equal(q.scoreRiasec({ riasec: answersFor(5, () => 4) }), null)
  assert.ok(q.scoreRiasec({ riasec: answersFor(6, () => 4) }))
  assert.equal(q.resultsReady({ riasec: { r1: 5 } }, 0), false)
  assert.equal(q.resultsReady({}, 1), true)
  // All threes: flat, low confidence, said so; the run of identical answers is flagged as well.
  const flatAnswers = { riasec: Object.fromEntries(q.RIASEC_ITEMS.map((i) => [i.id, 3])) }
  const flat = score({ summaries: [], answers: flatAnswers })
  assert.equal(flat.quality?.flat, true)
  assert.equal(flat.confidence, 'low')
  assert.equal(flat.quality?.careless, true)
  const varied = Object.fromEntries(q.INTEREST_LIST.map((i, n) => [i.id, (n % 5) + 1]))
  for (const it of q.ATTENTION_ITEMS) varied[it.id] = it.answer
  assert.equal(q.careless({ riasec: varied }), false)
  assert.equal(q.careless({ riasec: { ...varied, chk: 5 } }), true)
  assert.equal(q.careless({ riasec: { ...varied, chk2: 2 } }), true)
  assert.deepEqual(q.responseFlags({ riasec: { ...varied, chk2: 2 } }), { attention: true, longstring: false })
  assert.equal(q.RIASEC_ITEMS.length, 48)
  assert.equal(q.INTEREST_LIST.filter((i) => i.key === 'check').length, 2)
  assert.equal(q.INTEREST_LIST[16].id, 'chk')
  assert.equal(q.INTEREST_LIST[33].id, 'chk2')
  for (const key of ['R', 'I', 'A', 'S', 'E', 'C']) {
    assert.equal(q.RIASEC_ITEMS.filter((i) => i.key === key).length, 8)
  }
  const run = (n: number) => ({ riasec: Object.fromEntries(q.INTEREST_LIST.slice(0, n).filter((i) => i.key !== 'check').map((i) => [i.id, 4])) })
  assert.equal(q.careless(run(q.LONGSTRING - 1)), false)
  assert.equal(q.careless(run(q.LONGSTRING)), true)
  const interrupted = run(q.LONGSTRING)
  delete interrupted.riasec[q.INTEREST_LIST[5].id]
  assert.equal(q.careless(interrupted), false)
})

test('each person sees the items in an order of their own, and runs are counted in that order', async () => {
  const q = await import('../lib/engine/questionnaire.ts')
  const a = q.interestList(12345)
  assert.deepEqual(a.map((i) => i.id), q.interestList(12345).map((i) => i.id), 'the same seed gives the same order')
  assert.notDeepEqual(a.map((i) => i.id), q.interestList(54321).map((i) => i.id))
  assert.notDeepEqual(a.map((i) => i.id), q.INTEREST_LIST.map((i) => i.id))
  assert.deepEqual([...a.map((i) => i.id)].sort(), [...q.INTEREST_LIST.map((i) => i.id)].sort(), 'a permutation of the same items')
  assert.equal(a[16].id, 'chk')
  assert.equal(a[33].id, 'chk2')
  // Twelve identical answers in a row in this person's order, interleaved in the default order.
  const riasec = Object.fromEntries(a.filter((i) => i.key !== 'check').map((i, n) => [i.id, n < 12 ? 4 : (n % 5) + 1]))
  assert.equal(q.longestRun({ riasec, order: 12345 }) >= 12, true)
  assert.ok(q.longestRun({ riasec }) < 12)
})

test('retained IDs keep saved answers; progress counts the current items', async () => {
  const q = await import('../lib/engine/questionnaire.ts')
  assert.equal(q.RIASEC_ITEMS.find((i) => i.id === 'r5')?.text, 'Grow plants or look after animals')
  const current = Object.fromEntries(q.INTEREST_LIST.map((i, n) => [i.id, i.key === 'check' ? 2 : n % 5 + 1]))
  assert.equal(q.riasecCompleteness({ riasec: current }), 1)
  const big5 = Object.fromEntries(q.BIG5_ITEMS.map((i) => [i.id, 4]))
  assert.deepEqual(q.questionnaireProgress({ riasec: current, big5 }), { done: 70, total: 92 })
  assert.deepEqual(q.questionnaireProgress({ riasec: { ...current, retired: 3 } }), { done: 50, total: 92 })
  const minimal = answersFor(6, (_, i) => i % 5 + 1)
  assert.equal(q.resultsReady({ riasec: minimal, big5 }, 0), true)
  assert.equal(q.resultsReady({ riasec: minimal }, 0), true)
  delete minimal.c6
  assert.equal(q.resultsReady({ riasec: minimal, big5 }, 0), false)
})

test('results require sufficient interests or imported data; personality is optional', async () => {
  const q = await import('../lib/engine/questionnaire.ts')
  const riasec = Object.fromEntries(q.RIASEC_ITEMS.map((i, n) => [i.id, n % 5 + 1]))
  const big5 = Object.fromEntries(q.BIG5_ITEMS.map((i, n) => [i.id, n % 5 + 1]))
  assert.equal(q.resultsReady({ riasec }, 0), true)
  assert.equal(q.resultsReady({}, 0), false)
  assert.equal(q.resultsReady({}, 1), true, 'a successful import needs no questionnaire answers')
  assert.equal(q.resultsReady({ riasec: { r1: 5 } }, 1), true, 'partial interests do not block imported data')
  assert.equal(q.resultsReady({ riasec }, 3), true)
  assert.equal(q.resultsReady({ big5 }, 0), false, 'personality alone does not replace interests or data')
  assert.equal(q.resultsReady({ big5 }, 1), true)
  assert.equal(q.resultsReady({ riasec, big5 }, 0), true)
  for (const item of q.BIG5_ITEMS) {
    const partial = { ...big5 }
    delete partial[item.id]
    assert.equal(q.big5Answered({ big5: partial }), 19)
    assert.equal(q.resultsReady({ riasec, big5: partial }, 0), true)
    assert.equal(q.resultsReady({ big5: partial }, 3), true)
  }
  for (const invalid of [0, 6, 1.5, NaN, Infinity]) {
    const invalidAnswers = { big5: { ...big5, b1: invalid, retired: 3 } }
    assert.equal(q.big5Answered(invalidAnswers), 19)
    assert.equal(q.resultsReady(invalidAnswers, 1), true)
    assert.equal(q.resultsReady({ ...invalidAnswers, riasec }, 0), true)
    assert.deepEqual(q.questionnaireProgress(invalidAnswers), { done: 19, total: 92 })
  }
})

const socialInvestigative = () => answersFor(8, (k, i) => (k === 's' ? 5 : k === 'i' ? 4 : 2) - (i % 4 === 3 ? 1 : 0))

test('with the questionnaire answered, data are evidence and do not move the ranking', () => {
  const riasec = socialInvestigative()
  const base = score({ summaries: [], answers: { riasec } })
  const summary = accumulate(engineeringPerson(), { source: 'takeout', label: 'YouTube history' })
  const both = score({ summaries: [summary], answers: { riasec } })
  assert.deepEqual(both.fields.map((m) => [m.id, m.match]), base.fields.map((m) => [m.id, m.match]))
  assert.ok(both.fields.find((m) => m.id === 'aerospace-engineering')!.evidence.length > 0, 'the data still show up as evidence')
  assert.equal(both.quality?.questionnaireLed, true)
})

test('interest fit is profile shape only: the same shape at another level ranks the same', () => {
  const shape: Record<string, number> = { r: 1, i: 4, a: 1, s: 2, e: 1, c: 2 }
  const low = score({ summaries: [], answers: { riasec: answersFor(8, (k) => shape[k]) } })
  const high = score({ summaries: [], answers: { riasec: answersFor(8, (k) => shape[k] + 1) } })
  const rounded = (r: typeof low) => r.fields.map((m) => [m.id, Math.round(m.match * 1e9)]).sort()
  assert.deepEqual(rounded(high), rounded(low))
})

test('values filter, grades inform: neither changes the fit', () => {
  const riasec = socialInvestigative()
  const plain = score({ summaries: [], answers: { riasec } })
  const more = score({ summaries: [], answers: { riasec, values: { salary: 5, creativity: 5, helping: 1 }, grades: { scale: 'ch', average: 4.2, math: 3.5 } } })
  assert.deepEqual(more.fields.map((m) => [m.id, m.match]), plain.fields.map((m) => [m.id, m.match]))
  assert.ok(plain.fields.every((m) => Array.isArray(m.offers)))
  assert.ok(plain.fields.some((m) => m.offers!.includes('helping')))
})

test('fields of similar fit form groups, and alternatives come from other areas', async () => {
  const { GROUP_WIDTH } = await import('../lib/engine/scoring.ts')
  const { FIELD_BY_ID } = await import('../lib/taxonomy/fields.ts')
  const r = score({ summaries: [], answers: { riasec: socialInvestigative(), subjects: { bio: { enjoy: 5 }, math: { enjoy: 2 }, lang: { enjoy: 4 }, art: { enjoy: 1 } } } })
  assert.equal(r.fields[0].tier, 1)
  let top = r.fields[0].score
  for (let i = 1; i < r.fields.length; i++) {
    const [prev, m] = [r.fields[i - 1], r.fields[i]]
    assert.ok(m.tier === prev.tier || m.tier === prev.tier! + 1)
    if (m.tier !== prev.tier) top = m.score
    assert.ok(top - m.score <= GROUP_WIDTH, `${m.id} in group ${m.tier}`)
  }
  const leadingGroups = new Set(r.fields.slice(0, 10).map((m) => FIELD_BY_ID[m.id].group))
  const altGroups = r.hidden.map((m) => FIELD_BY_ID[m.id].group)
  assert.ok(altGroups.every((g) => !leadingGroups.has(g)))
  assert.equal(new Set(altGroups).size, altGroups.length)
  assert.ok(r.hidden.every((m) => m.reasons[0].k === 'hidden' && m.score >= 50))
})

test('grades give a feasibility note for maths-heavy fields only', async () => {
  const { feasibility, gradeBand, cleanGrades } = await import('../lib/engine/grades.ts')
  const { FIELD_BY_ID } = await import('../lib/taxonomy/fields.ts')
  assert.equal(gradeBand(5.5, 'ch'), 'strong')
  assert.equal(gradeBand(4.5, 'ch'), 'sufficient')
  assert.equal(gradeBand(3.5, 'ch'), 'weak')
  assert.equal(gradeBand(1.7, 'de'), 'strong')
  assert.equal(gradeBand(3.3, 'de'), 'sufficient')
  assert.equal(gradeBand(4.7, 'de'), 'weak')
  assert.equal(feasibility(FIELD_BY_ID.mathematics, { scale: 'ch', math: 3.5 }).math?.band, 'weak')
  assert.equal(feasibility(FIELD_BY_ID.psychology, { scale: 'ch', math: 3.5 }).math, undefined)
  assert.equal(cleanGrades({ scale: 'ch', average: 7, math: 5 })?.average, undefined)
  assert.equal(cleanGrades({ scale: 'xx', average: 5 }), null)
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

test('personality reports response means without an assumed norm or imputed missing traits', () => {
  const neutral = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`b${i + 1}`, 3]))
  assert.deepEqual(big5Means({ big5: neutral }), { O: 3, C: 3, E: 3, A: 3, N: 3 })
  assert.deepEqual(scoreBig5({ big5: neutral }), { O: 0, C: 0, E: 0, A: 0, N: 0 })
  const example = { ...neutral, b1: 5, b6: 1, b11: 4, b16: 2 }
  assert.equal(big5Means({ big5: example })?.E, 4.5)
  assert.equal(score({ summaries: [], answers: { big5: example } }).big5?.means?.E, 4.5)
  const partial = { ...neutral }
  delete partial.b20
  assert.equal(big5Means({ big5: partial }), null)
  assert.equal(scoreBig5({ big5: Object.fromEntries(Object.entries(neutral).slice(0, 10)) }), null)
  for (const invalid of [NaN, Infinity, -1, 0, 2.5, 6]) {
    assert.equal(big5Means({ big5: { ...neutral, b20: invalid } }), null)
  }
})

test('personality is descriptive only in questionnaire rankings, hidden suggestions and reasons', () => {
  const riasec = Object.fromEntries(RIASEC_ITEMS.map((i, n) => [i.id, (i.key === 'I' ? 5 : i.key === 'R' ? 4 : 2) - (n % 3 === 0 ? 1 : 0)]))
  const big5 = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`b${i + 1}`, i % 5 + 1]))
  const without = score({ summaries: [], answers: { riasec } })
  const withPersonality = score({ summaries: [], answers: { riasec, big5 } })
  assert.deepEqual(withPersonality.fields, without.fields)
  assert.deepEqual(withPersonality.hidden, without.hidden)
  assert.ok(withPersonality.big5?.means)
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
  assert.equal(ageWeight(2025, 'takeout', now), 2 ** -0.5)
  assert.equal(ageWeight(2024, 'takeout', now), 0.5)
  assert.equal(ageWeight(2022, 'takeout', now), 0.25)
  assert.equal(ageWeight(2020, 'takeout', now), 0)
  assert.ok(ageWeight(2021, 'takeout', now) < 0.5)
  assert.equal(ageWeight(2016, 'takeout', now), 0)
  assert.equal(ageWeight(1961, 'takeout', now), 0)
  assert.equal(ageWeight(2016, 'youtube', now), 0)

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

test('every field profile is derived from the O*NET profiles of its occupations', async () => {
  const { FIELD_ONET } = await import('../lib/taxonomy/field-onet.ts')
  const { ONET_INTERESTS } = await import('../lib/taxonomy/onet-interests.ts')
  const { FIELDS } = await import('../lib/taxonomy/fields.ts')
  assert.deepEqual(Object.keys(FIELD_ONET).sort(), FIELDS.map((f) => f.id).sort())
  for (const f of FIELDS) {
    const codes = FIELD_ONET[f.id]
    assert.ok(codes.length >= 2 && codes.every((c) => ONET_INTERESTS[c]?.length === 6), f.id)
    const expected = f.riasec.map((_, i) => Math.round(((codes.reduce((s, c) => s + ONET_INTERESTS[c][i], 0) / codes.length - 1) / 6) * 100) / 100)
    assert.deepEqual(f.riasec, expected, f.id)
  }
})
