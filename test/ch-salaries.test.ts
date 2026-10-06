import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSalaryWorkbook } from '../scrapers/ch-salaries.ts'
import { chSalaryFor } from '../lib/ch-salary.ts'

const head = (title: string) => [[title], ["Situation une année après l'obtention du diplôme, année de diplôme 2024"]]
// The layout of the BFS tables: label columns, then Q1/CV/median/CV/Q3/CV for «Total» and again for «Suisse».
const uh = {
  name: 'T11',
  rows: [
    ...head('TA3E61-11 Revenu professionnel brut standardisé1 des titulaires d’un diplôme HEU selon le lieu de travail, le niveau d’examen, le groupe de domaines d’études et le sexe (en francs par an)'),
    ['', '', '', 'Total', '', '', '', '', '', 'Suisse'],
    ['', '', '', '1. quartile', '', 'Médiane', '', '3. quartile', '', '1. quartile', '', 'Médiane', '', '3. quartile'],
    ['', '', '', '1. quartile', 'CV', 'Médiane', 'CV', '3. quartile', 'CV', '1. quartile', 'CV', 'Médiane', 'CV', '3. quartile', 'CV'],
    ['Master', 'Sciences\u00a0humaines et sociales', 'Total', '70000', '1', '84000', '1', '98000', '1', '71000', '1', '85000', '1', '99000', '1'],
    ['', '', 'Homme', '70000', '1', '83000', '1', '98000', '1', '71000', '1', '84000', '1', '99000', '1'],
    ['', 'Médecine et pharmacie', 'Total', '78000', '0.8', '90000', '0.6', '95000', '0.5', '78000', '1.3', '90000', '0.6', '95500', '0.3'],
    ['Doctorat', 'Droit', 'Total', '100000', '9.9', '126800', '2.4', '150000', '3.1', '112000', '6.2', '130000', '2.4', '150000', '3.2'],
  ],
}
const fh = {
  name: 'T12',
  rows: [
    ...head('TA3E61-12 Revenu professionnel brut standardisé1 des titulaires d’un diplôme HES ou HEP selon le lieu de travail, le niveau d’examen, le domaine d’études et le sexe (en francs par an)'),
    ['', '', '', '', 'Total', '', '', '', '', '', 'Suisse'],
    ['', '', '', '', '1. quartile', '', 'Médiane', '', '3. quartile', '', '1. quartile', '', 'Médiane', '', '3. quartile'],
    ['HES', 'Bachelor', 'Technique et IT', 'Total', '79500', '1', '87500', '0.3', '97000', '0.5', '80000', '0.6', '88000', '0.6', '97500', '0.8'],
    ['', '', 'Sport', 'Total', '**', '**', '**', '**', '**', '**', '**', '**', '**', '**', '**', '**'],
    ['', '', 'Travail social', 'Total', '76700', '0.8', '85200', '0.6', '96200', '0.7', '77400', '0.7', '85700', '0.7', '96300', '0.7'],
    ['HEP', "Diplôme d'enseignement", 'Formation des enseignants', 'Total', '83900', '0.5', '98300', '0.7', '115700', '0.5', '84000', '0.5', '98600', '0.6', '115800', '0.5'],
  ],
}
const other = { name: 'T1', rows: [['TA3E61-1 Revenu … série temporelle'], ['Années de diplôme 2002 à 2024']] }

test('reads the Swiss median per subject group from the BFS graduate tables', () => {
  const t = parseSalaryWorkbook([other, uh, fh], '2026-10-06', 'x')
  assert.equal(t.year, '2024')
  assert.deepEqual(t.uh['humanities-social'], { master: 85000 })
  assert.equal(t.uh.medicine?.master, 90000)
  assert.equal(t.uh.law?.doctorate, 130000)
  assert.equal(t.fh['tech-it']?.bachelor, 88000)
  assert.equal(t.fh.sport, undefined)
  assert.equal(t.fh.teaching?.diploma, 98600)
  assert.deepEqual(chSalaryFor('sociology', t), { year: '2024', uhMaster: 85000 })
  assert.deepEqual(chSalaryFor('social-work', t), { year: '2024', fhBachelor: 85700 })
  assert.equal(chSalaryFor('education', t)?.teaching, 98600)
})
