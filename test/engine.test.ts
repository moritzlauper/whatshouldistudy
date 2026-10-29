import { test } from 'node:test'
import assert from 'node:assert/strict'
import { topFields } from '../lib/engine/classifier.ts'
import { accumulate } from '../lib/engine/accumulate.ts'
import { score } from '../lib/engine/scoring.ts'
import { scoreRiasec, riasecCode } from '../lib/engine/questionnaire.ts'
import { BASIC_INTERESTS, BASIC_KEYS } from '../lib/taxonomy/basic-interests.ts'
import { genresToProfile, musicBig5 } from '../lib/engine/music.ts'
import { FIELDS, SUBJECT_KEYS } from '../lib/taxonomy/fields.ts'
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

/** Answers for the three items of every activity scale, `level(key, item)` deciding each. */
const answersFor = (level: (key: string, i: number) => number, n = 3) =>
  Object.fromEntries(BASIC_KEYS.flatMap((k) => Array.from({ length: n }, (_, i) => [`${k}${i + 1}`, level(k, i)])))
/** Every subject rated, `level(subject)` deciding each. */
const subjectsFor = (level: (key: string) => number) => Object.fromEntries(SUBJECT_KEYS.map((k) => [k, { enjoy: level(k) }]))
/** Likes the activity scales and subjects in `liked`, dislikes the rest, with a little variation. */
const profile = (liked: string[]) => ({
  interests: answersFor((k, i) => (liked.includes(k) ? 5 - (i === 2 ? 1 : 0) : 1 + (i === 1 ? 1 : 0))),
  subjects: subjectsFor((k) => (liked.includes(k) ? 5 : k.length % 2 ? 2 : 1)),
})

test('the questionnaire ranks fields by fit with subjects and activities', () => {
  const care = score({ summaries: [], answers: profile(['counseling', 'medicalScience', 'socialScience', 'teaching', 'bio', 'social']) })
  const top8 = care.fields.slice(0, 8).map((f) => f.id)
  assert.ok(top8.some((id) => ['psychology', 'nursing', 'social-work', 'medicine'].includes(id)), top8.join())
  const tech = score({ summaries: [], answers: profile(['cs', 'math', 'engineering']) })
  assert.ok(tech.fields.slice(0, 5).some((f) => f.id === 'computer-science'), tech.fields.slice(0, 5).map((f) => f.id).join())
  const arts = score({ summaries: [], answers: profile(['hist', 'lang', 'social']) })
  assert.ok(arts.fields.slice(0, 5).some((f) => ['history', 'literature', 'philosophy'].includes(f.id)), arts.fields.slice(0, 5).map((f) => f.id).join())
  const langs = score({ summaries: [], answers: profile(['forlang', 'lang']) })
  assert.ok(langs.fields.slice(0, 5).some((f) => f.id === 'languages'), langs.fields.slice(0, 5).map((f) => f.id).join())
  assert.equal(care.quality?.questionnaireLed, true)
  assert.ok(care.basic && care.basic.counseling! > care.basic.mechanics!)
  assert.ok(care.subjects && care.subjects.bio! > care.subjects.phys!)
  assert.equal(riasecCode(scoreRiasec(profile(['counseling', 'teaching', 'social']))!)[0], 'S')
})

test('subjects tell apart what the activity scales cannot', () => {
  const music = score({ summaries: [], answers: profile(['music', 'design']) })
  const art = score({ summaries: [], answers: profile(['art', 'design']) })
  const rank = (r: typeof music, id: string) => r.fields.findIndex((f) => f.id === id)
  assert.ok(rank(music, 'music') < rank(art, 'music'))
  assert.ok(rank(art, 'fine-arts') < rank(music, 'fine-arts'))
})

test('questionnaire quality: no filling-in, flat profiles, careless answering, one gate', async () => {
  const q = await import('../lib/engine/questionnaire.ts')
  assert.equal(q.INTEREST_ITEMS.length, BASIC_INTERESTS.length * 3)
  assert.equal(q.INTEREST_LIST.length, q.INTEREST_ITEMS.length + 2)
  const subjects = subjectsFor((k) => (k.length % 3) + 2)
  // A scale with fewer than two answers isn't «neutral»: no profile yet.
  assert.equal(q.scoreBasic({ interests: answersFor(() => 4, 1) }), null)
  assert.ok(q.scoreBasic({ interests: answersFor(() => 4, 2) }))
  assert.equal(q.resultsReady({ interests: answersFor(() => 4, 2), subjects }, 0), true)
  // Most subjects are needed too.
  const few = Object.fromEntries(Object.entries(subjects).slice(0, q.MIN_SUBJECTS - 1))
  assert.equal(q.resultsReady({ interests: answersFor(() => 4, 2), subjects: few }, 0), false)
  assert.equal(q.resultsReady({}, 1), true)
  // All threes: flat, low confidence, said so; the run of identical answers is flagged as well.
  const flat = score({ summaries: [], answers: { interests: answersFor(() => 3), subjects: subjectsFor(() => 3) } })
  assert.equal(flat.quality?.flat, true)
  assert.equal(flat.confidence, 'low')
  assert.equal(flat.quality?.careless, true)
  const varied = Object.fromEntries(q.INTEREST_LIST.map((i, n) => [i.id, (n % 5) + 1]))
  for (const it of q.ATTENTION_ITEMS) varied[it.id] = it.answer
  assert.equal(q.careless({ interests: varied }), false)
  assert.equal(q.careless({ interests: { ...varied, chk: 5 } }), true)
  assert.deepEqual(q.responseFlags({ interests: { ...varied, chk2: 2 } }), { attention: true, longstring: false })
  const third = Math.round(q.INTEREST_ITEMS.length / 3)
  assert.equal(q.INTEREST_LIST[third].id, 'chk')
  assert.equal(q.INTEREST_LIST[2 * third + 1].id, 'chk2')
  const run = (n: number) => ({ interests: Object.fromEntries(q.INTEREST_LIST.slice(0, n).filter((i) => i.key !== 'check').map((i) => [i.id, 4])) })
  assert.equal(q.careless(run(q.LONGSTRING - 1)), false)
  assert.equal(q.careless(run(q.LONGSTRING)), true)
  const interrupted = run(q.LONGSTRING)
  delete interrupted.interests[q.INTEREST_LIST[5].id]
  assert.equal(q.careless(interrupted), false)
})

test('each person sees the items in an order of their own, and runs are counted in that order', async () => {
  const q = await import('../lib/engine/questionnaire.ts')
  const a = q.interestList(12345)
  assert.deepEqual(a.map((i) => i.id), q.interestList(12345).map((i) => i.id), 'the same seed gives the same order')
  assert.notDeepEqual(a.map((i) => i.id), q.interestList(54321).map((i) => i.id))
  assert.deepEqual([...a.map((i) => i.id)].sort(), [...q.INTEREST_LIST.map((i) => i.id)].sort(), 'a permutation of the same items')
  const interests = Object.fromEntries(a.filter((i) => i.key !== 'check').map((i, n) => [i.id, n < 12 ? 4 : (n % 5) + 1]))
  assert.ok(q.longestRun({ interests, order: 12345 }) >= 12)
  assert.ok(q.longestRun({ interests }) < 12)
})

test('progress counts interest items and subjects; older answer keys are ignored', async () => {
  const q = await import('../lib/engine/questionnaire.ts')
  const interests = Object.fromEntries(q.INTEREST_LIST.map((i, n) => [i.id, i.key === 'check' ? 2 : n % 5 + 1]))
  assert.equal(q.interestCompleteness({ interests }), 1)
  const total = q.INTEREST_LIST.length + SUBJECT_KEYS.length
  assert.deepEqual(q.questionnaireProgress({ interests, subjects: { music: { enjoy: 4 }, math: { enjoy: 5 } } }), { done: q.INTEREST_LIST.length + 2, total })
  const legacy = { riasec: { r1: 5, i1: 5 }, big5: { b1: 4 }, values: { salary: 5 } } as never
  assert.equal(q.resultsReady(legacy, 0), false)
  assert.deepEqual(q.questionnaireProgress(legacy), { done: 0, total })
})

const careProfile = () => profile(['counseling', 'socialScience', 'teaching', 'medicalScience', 'social', 'bio'])

test('with the questionnaire answered, data are evidence and do not move the ranking', () => {
  const answers = careProfile()
  const base = score({ summaries: [], answers })
  const summary = accumulate(engineeringPerson(), { source: 'takeout', label: 'YouTube history' })
  const both = score({ summaries: [summary], answers })
  assert.deepEqual(both.fields.map((m) => [m.id, m.match]), base.fields.map((m) => [m.id, m.match]))
  assert.ok(both.fields.find((m) => m.id === 'aerospace-engineering')!.evidence.length > 0, 'the data still show up as evidence')
  assert.equal(both.big5, undefined, 'no personality profile from the questionnaire')
})

test('interest fit is profile shape only: the same shape at another level ranks the same', () => {
  const liked = ['engineering', 'mechanics', 'math', 'phys']
  const at = (hi: number, lo: number) => ({ interests: answersFor((k) => (liked.includes(k) ? hi : lo)), subjects: subjectsFor((k) => (liked.includes(k) ? hi : lo)) })
  const low = score({ summaries: [], answers: at(3, 1) })
  const high = score({ summaries: [], answers: at(5, 3) })
  const rounded = (r: typeof low) => r.fields.map((m) => [m.id, Math.round(m.match * 1e9)]).sort()
  assert.deepEqual(rounded(high), rounded(low))
})

test('the maths grade informs and values filter: neither changes the fit', () => {
  const answers = careProfile()
  const plain = score({ summaries: [], answers })
  const more = score({ summaries: [], answers: { ...answers, grades: { scale: 'ch', math: 'weak' } } })
  assert.deepEqual(more.fields.map((m) => [m.id, m.match]), plain.fields.map((m) => [m.id, m.match]))
  assert.ok(plain.fields.every((m) => Array.isArray(m.offers)))
  assert.ok(plain.fields.some((m) => m.offers!.includes('helping')))
})

test('fields of similar fit form groups, alternatives come from other areas, reasons name what fits and what not', async () => {
  const { GROUP_WIDTH } = await import('../lib/engine/scoring.ts')
  const { FIELD_BY_ID } = await import('../lib/taxonomy/fields.ts')
  const r = score({ summaries: [], answers: careProfile() })
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
  assert.ok(r.fields[0].reasons.some((x) => x.k === 'basic' || x.k === 'subjects'), JSON.stringify(r.fields[0].reasons))
  const physics = r.fields.find((m) => m.id === 'physics')!
  assert.ok(physics.reasons.some((x) => x.k === 'subjectsLow' || x.k === 'basicLow'), JSON.stringify(physics.reasons))
  assert.ok(physics.reasons.at(-1)!.k.endsWith('Low'), 'what does not fit comes last')
})

test('the maths grade gives a feasibility note for maths-heavy fields only', async () => {
  const { feasibility, bandRange, cleanGrades } = await import('../lib/engine/grades.ts')
  const { FIELD_BY_ID } = await import('../lib/taxonomy/fields.ts')
  assert.deepEqual(bandRange('weak', 'ch'), [1, 4])
  assert.deepEqual(bandRange('sufficient', 'ch'), [4, 5])
  assert.deepEqual(bandRange('strong', 'ch'), [5, 6])
  assert.deepEqual(bandRange('strong', 'de'), [2.5, 1])
  assert.deepEqual(bandRange('weak', 'de'), [6, 4])
  assert.equal(feasibility(FIELD_BY_ID.mathematics, { scale: 'ch', math: 'weak' }).math, 'weak')
  assert.equal(feasibility(FIELD_BY_ID.psychology, { scale: 'ch', math: 'weak' }).math, undefined)
  assert.equal(cleanGrades({ scale: 'ch', math: 'great' }), null)
  assert.equal(cleanGrades({ scale: 'xx', math: 'weak' }), null)
})

test('field profiles come from O*NET knowledge and are standardised across fields', async () => {
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
  for (const k of BASIC_KEYS) assert.ok(Math.abs(mean(FIELDS.map((f) => f.basic[k]))) < 0.02, k)
  for (const k of SUBJECT_KEYS) assert.ok(Math.abs(mean(FIELDS.map((f) => f.subjectLevel[k]))) < 0.02, k)
  const topOf = (levels: Record<string, number>) => Object.entries(levels).sort((a, b) => b[1] - a[1])[0][0]
  const field = (id: string) => FIELDS.find((f) => f.id === id)!
  assert.equal(topOf(field('law').basic), 'law')
  assert.equal(topOf(field('criminology').basic), 'protective')
  assert.equal(topOf(field('mathematics').subjectLevel), 'math')
  assert.equal(topOf(field('languages').subjectLevel), 'forlang')
  assert.equal(topOf(field('history').subjectLevel), 'hist')
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
