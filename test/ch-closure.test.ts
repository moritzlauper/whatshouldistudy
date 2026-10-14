import { test } from 'node:test'
import assert from 'node:assert/strict'
import { closureOf, toProgramme } from '../scrapers/ch-hochschulen.ts'
import { findChInstitution } from '../lib/ch-institutions.ts'

test('reads a closure notice in English and German, with the programme that replaces it', () => {
  assert.deepEqual(
    closureOf('<p>Please note that new registrations for this study program will no longer be possible from fall semester 2026. Instead, the new Research Master in Sociology and Communication is offered.</p>'),
    { closedFrom: { term: 'autumn', year: 2026 }, successor: 'Research Master in Sociology and Communication' },
  )
  assert.deepEqual(
    closureOf('<p>Neuanmeldungen für diesen Studiengang sind ab dem Herbstsemester 2026 nicht mehr möglich. Stattdessen wird der neue Research Master in Soziologie und Kommunikation angeboten.</p>'),
    { closedFrom: { term: 'autumn', year: 2026 }, successor: 'Research Master in Soziologie und Kommunikation' },
  )
})

test('a spring notice needs no successor', () => {
  assert.deepEqual(closureOf('<p>Neuanmeldungen sind ab dem Frühjahrssemester 2027 nicht mehr möglich.</p>'), { closedFrom: { term: 'spring', year: 2027 } })
})

test('pages without a notice, or with only a “no longer offered” remark, are not closed', () => {
  assert.equal(closureOf('<p>Der Studiengang beginnt jeweils im Herbstsemester. Bewerbungen bis 30. April.</p>'), undefined)
  assert.equal(closureOf('<p>The programme is no longer offered in fall semester 2026.</p>'), undefined)
})

test('a closed programme keeps its notice in the catalogue entry', () => {
  const inst = findChInstitution('Universität Bern')!
  const at = '2026-10-14'
  const url = 'https://www.unibe.ch/studium/studienangebote/master/studienprogramme/master_soziologie/index_ger.html'
  const closed = toProgramme({ name: 'Master Soziologie', level: 'master', url, closedFrom: { term: 'autumn', year: 2026 }, successor: 'Research Master in Sociology and Communication' }, inst, at)
  assert.deepEqual(closed?.closedFrom, { term: 'autumn', year: 2026 })
  assert.equal(closed?.successor, 'Research Master in Sociology and Communication')
  const open = toProgramme({ name: 'Master Soziologie', level: 'master', url }, inst, at)
  assert.equal(open?.closedFrom, undefined)
  assert.equal(open?.successor, undefined)
})
