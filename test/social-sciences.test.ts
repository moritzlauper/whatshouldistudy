import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accumulate } from '../lib/engine/accumulate.ts'
import { classify, textTopics, topFields } from '../lib/engine/classifier.ts'
import { score } from '../lib/engine/scoring.ts'
import { FIELD_INDEX } from '../lib/taxonomy/fields.ts'
import type { SignalItem } from '../lib/engine/types.ts'
import { SOCIAL_SCIENCE_TITLES } from './fixtures/social-sciences.ts'

const top = (text: string) => topFields(text, 1)[0]?.id

/** Reproducible sampling; the ranking must not depend on a lucky title or channel. */
function sample(titles: readonly string[], seed: number, count = 60): string[] {
  let state = seed
  return Array.from({ length: count }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return titles[Math.floor((state / 2 ** 32) * titles.length)]
  })
}

function history(titles: readonly string[]): SignalItem[] {
  const now = Date.now()
  return titles.map((title, i) => {
    const channel = `Channel ${i % 3 + 1}`
    return {
      kind: 'watch', text: `${title}\n${channel}`, label: channel, group: channel,
      weight: .3, time: now - (i + 1) * 6 * 864e5,
    }
  })
}

for (const [field, titles] of Object.entries(SOCIAL_SCIENCE_TITLES)) {
  test(`${field}: recognises realistic titles without a known channel`, () => {
    for (const title of titles) assert.equal(top(title), field, title)
  })

  test(`${field}: leads in 30 sampled histories with evidence from the titles`, () => {
    for (let seed = 1; seed <= 30; seed++) {
      const summary = accumulate(history(sample(titles, seed)), { source: 'takeout', label: 'Synthetic history' })
      const result = score({ summaries: [summary] })
      assert.equal(result.fields[0].id, field, `seed ${seed}`)
      assert.equal(summary.fields[field].items, 60, `seed ${seed}: every title provides evidence`)
      assert.ok(result.fields[0].evidence.some((e) => titles.some((title) => e.label.startsWith(title))))
    }
  })
}

test('historical phrases cover inflections and both spellings of the Thirty Years War', () => {
  for (const title of [
    'Das Römische Reich', 'Im Römischen Reich', 'Aus dem Römischen Reich',
    'Die Grenzen des Römischen Reichs', 'Die Grenzen des Römischen Reiches',
    'Der Dreißigjährige Krieg', 'Der Dreissigjährige Krieg', 'Im Dreissigjährigen Krieg',
    'Die Folgen des Dreissigjährigen Krieges', 'Thirty Years’ War',
    'La guerre de Trente Ans', "La guerra dei trent'anni",
  ]) assert.equal(top(title), 'history', title)
})

test('ambiguous place, method and myth words do not invent a subject', () => {
  for (const title of [
    'Rome', 'Rom', 'Mauerbau', 'Ein dreissigjähriger Mann',
    'Fieldwork notes from Tuesday', 'Feldforschung: Notizen vom Dienstag',
    'Five myths you should stop believing', 'Myths and facts',
  ]) assert.equal(top(title), undefined, title)
  assert.equal(top('Five myths about protein and nutrition'), 'nutrition')
  assert.equal(top('Fieldwork on plate tectonics'), 'earth-sciences')
})

test('new terms respect token boundaries and keep unrelated interests out', () => {
  for (const title of [
    'Koalabären schlafen lange', 'Die Farben aufeinander abstimmen',
    "Minecraft Let's Play #42 funny moments", 'Morning routine and room tour',
  ]) assert.equal(top(title), undefined, title)
  for (const title of ['Quantenmechanik einfach erklärt', 'How to bake sourdough bread', 'Python programming tutorial']) {
    const c = classify(title)
    for (const field of Object.keys(SOCIAL_SCIENCE_TITLES)) assert.equal(c.raw[FIELD_INDEX[field]], 0, `${title}: ${field}`)
  }
  assert.equal(top('Vodou: religion and religious practice'), 'religious-studies')
})

test('new evidence reaches topics and programme names still classify by their subject', () => {
  assert.ok(textTopics('Wahlkämpfe und Volksabstimmungen').length >= 2)
  const summary = accumulate(history(['Warum zerbrechen Koalitionen?']), { source: 'takeout', label: 'Synthetic history' })
  assert.ok(summary.topics?.['p:koalition'])
  assert.ok(summary.fields['political-science'].terms.koalitionen)
  for (const [title, field] of [
    ['Bachelor Politikwissenschaft', 'political-science'], ['Bachelor Geschichte', 'history'],
    ['Bachelor Ethnologie', 'anthropology'], ['Bachelor Soziologie', 'sociology'],
  ]) assert.equal(top(title), field, title)
})

test('sports, tuning and business alliances do not become social-science evidence', () => {
  const controls = [
    'Maori rugby highlights', 'Māori All Blacks highlights',
    'Abstimmung der Instrumente im Orchester', 'Abstimmung von Terminen',
    'Die Koalition von Unternehmen gewinnt den Auftrag', 'A coalition of businesses',
  ]
  for (const title of controls) {
    const c = classify(title)
    assert.equal(c.raw[FIELD_INDEX.anthropology], 0, title)
    assert.equal(c.raw[FIELD_INDEX['political-science']], 0, title)
  }
  assert.equal(top(controls[0]), undefined)
  assert.equal(top(controls[2]), 'music')
  assert.equal(top(controls[4]), 'business-management')
  assert.equal(top('Abstimmung der Kantone über eine Volksinitiative'), 'political-science')
  assert.equal(top('Maori: Rituale und Bräuche'), 'anthropology')
  const summary = accumulate(history(controls), { source: 'takeout', label: 'Synthetic history' })
  assert.equal(summary.fields.anthropology, undefined)
  assert.equal(summary.fields['political-science'], undefined)
})

test('a small sociology share does not take over a predominantly political history', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const titles = [
      ...sample(SOCIAL_SCIENCE_TITLES['political-science'], seed, 51),
      ...sample(SOCIAL_SCIENCE_TITLES.sociology, seed + 30, 9),
    ]
    const summary = accumulate(history(titles), { source: 'takeout', label: 'Synthetic history' })
    assert.equal(score({ summaries: [summary] }).fields[0].id, 'political-science', `seed ${seed}`)
  }
})
