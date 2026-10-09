import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseSpDetails } from '../scrapers/ch-studyprogrammes.ts'
import type { SpDetails } from '../scrapers/ch-studyprogrammes.ts'

const fixtures = JSON.parse(readFileSync(new URL('../scrapers/fixtures/ch-studyprogrammes.json', import.meta.url), 'utf8')) as Array<{ level: 'bachelor' | 'master'; d: SpDetails }>

test('reads a studyprogrammes.ch entry with its focus, own page and institution data', () => {
  const [agro, bern, luzern] = fixtures.map((x) => parseSpDetails(x.d, x.level, '2026-10-06'))
  assert.equal(agro?.institution, 'Berner Fachhochschule')
  assert.equal(agro?.institutionType, 'fh')
  assert.equal(agro?.url, 'https://www.bfh.ch/fr/etudes/bachelor/agronomie')
  assert.equal(agro?.durationYears, 3)
  assert.equal(agro?.mode, 'both')
  assert.ok(agro?.fields.includes('agriculture'))
  // Windows-1250 mojibake in French texts is repaired.
  assert.match(agro?.description ?? '', / à la Haute école/)
  assert.ok(!(agro?.focus ?? []).includes('BFH'))
  assert.equal(bern?.fields[0], 'sociology')
  assert.deepEqual(bern?.focus?.slice(0, 3), ['Soziale Ungleichheit', 'Migration', 'Bildungssoziologie'])
  assert.notDeepEqual(bern?.focus, luzern?.focus)
})

test('majors listed in the description become their own rows', async () => {
  const { parseSpProgrammes } = await import('../scrapers/ch-studyprogrammes.ts')
  const { textTopics } = await import('../lib/engine/classifier.ts')
  const d = {
    id: 99001,
    institute: { name: 'Zürcher Hochschule der Künste', abbreviation: 'ZHdK' },
    degree_level: { id: 0 },
    name: 'Bachelor in Design',
    description: 'Majors: Cast / Audiovisual Media, Game Design, Industrial Design, Interaction Design, Knowledge Visualization, Trends & Identity, Visual Communication',
    ects_credits: '180',
  }
  const rows = parseSpProgrammes(d, 'bachelor', '2026-10-06')
  assert.equal(rows.length, 7)
  const cast = rows.find((r) => /Cast/.test(r.name))!
  assert.equal(cast.name, 'Bachelor in Design: Cast / Audiovisual Media')
  assert.ok(cast.parent)
  assert.equal(cast.fields[0], 'film-production')
  const game = rows.find((r) => /Game Design/.test(r.name))!
  assert.equal(game.fields[0], 'game-design')
  assert.ok(!game.fields.includes('film-production'), game.fields.join())
  assert.ok(!cast.fields.includes('game-design'), cast.fields.join())
  // No field of its own: only the umbrella's main field, not Film or Game Design.
  assert.equal(rows.find((r) => /Trends/.test(r.name))!.fields.length, 1)
  assert.equal(rows.find((r) => /Knowledge/.test(r.name))!.fields[0], 'graphic-design')
  const theater = parseSpProgrammes({ ...d, id: 99002, name: 'Bachelor in Theater', description: 'Majors: Regie, Schauspiel, Szenischer Raum, Theaterpädagogik' }, 'bachelor', '2026-10-06')
  assert.ok(theater.every((r) => r.fields[0] === 'performing-arts'), theater.map((r) => r.fields.join('+')).join(' / '))
  // The other majors don't leak into this row's topics.
  assert.ok(!textTopics(`${cast.name} \n ${(cast.focus ?? []).join(', ')} \n ${cast.description}`).some((k) => /game/.test(k)))
  assert.equal(new Set(rows.map((r) => r.id)).size, 7)
})

test('a link in the location field falls back to the institution city', () => {
  const p = parseSpDetails(
    {
      id: 99002,
      institute: { name: 'EPFL', abbreviation: 'EPFL' },
      name: 'Master in Quantum Science and Engineering',
      ects_credits: '120',
      location: 'https://www.epfl.ch/education/master/fr/programmes/science-et-ingenierie-quantiques/',
    },
    'master',
    '2026-10-09',
  )
  assert.equal(p?.city, 'Lausanne')
})

test('key facts from the institution: degree, ECTS, deadline, own admission, partners', () => {
  const agro = parseSpDetails(fixtures[0].d, 'bachelor', '2026-10-09')!
  assert.equal(agro.degreeTitle, 'Bachelor of Science BFH en Agronomie')
  assert.equal(agro.ects, 180)
  assert.equal(agro.deadline, '30. April')
  assert.equal(agro.regulationsUrl, 'https://www.bfh.ch/fr/la-bfh/bases-legales/')
  assert.match(agro.tuition?.note ?? '', /CHF 750/)
  // A keyword that only repeats a field («Agriculture») is not a focus.
  assert.ok(!(agro.focus ?? []).includes('Agriculture'), agro.focus?.join())
  const qse = parseSpDetails(
    {
      id: 99003,
      institute: { name: 'ETH Zürich', abbreviation: 'ETHZ' },
      name: 'Master in Quantum Engineering',
      degree_name: 'Master of Science ETH in Quantum Engineering',
      description: 'A history of breakthroughs: the programme builds on the liberal arts tradition of engineering, from philosophy to the history of science.',
      keywords: ['Quantum Engineering', 'Physics', 'Quantum computing'],
      admission_requirements: 'Bachelor in Physik oder Elektrotechnik mit mindestens 30 ECTS in Quantenmechanik.',
      admission_deadline: '15. Dezember (HS)',
      partner_institutes: 'Paul Scherrer Institut',
      departement: 'D-ITET',
      additional_languages: [{ abbreviation: 'de' }],
      admission_fields_of_study: [{ name: 'Physik' }, { name: 'Elektrotechnik' }],
      ects_credits: '120',
    },
    'master',
    '2026-10-09',
  )!
  assert.ok(!qse.fields.includes('history') && !qse.fields.includes('liberal-arts'), qse.fields.join())
  assert.deepEqual(qse.focus, ['Quantum computing'])
  assert.equal(qse.deadline, '15. Dezember (HS)')
  assert.equal(qse.partners, 'Paul Scherrer Institut')
  assert.deepEqual(qse.priorStudies, ['Physik', 'Elektrotechnik'])
  assert.match(qse.requirements ?? '', /Quantenmechanik/)
})
