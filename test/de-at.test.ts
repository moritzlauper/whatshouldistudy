import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deLevel, deType, parseAngebot } from '../scrapers/de-studiensuche.ts'
import { atLevel, parseItem, parseList } from '../scrapers/at-hochschulen.ts'
import { germanFields } from '../scrapers/lib/de-titles.ts'
import { findAtInstitution } from '../lib/at-institutions.ts'

test('German compound titles find their field', () => {
  const f = (t: string) => germanFields(t).fields
  assert.ok(f('Kultur- und Sozialanthropologie').includes('anthropology'))
  assert.ok(f('Orchesterdirigieren').includes('music'))
  assert.ok(f('Elementarpädagogik').includes('education'))
  assert.ok(f('Sport- und Bewegungswissenschaft').includes('sports-science'))
  assert.ok(f('Wirtschaftspsychologie Bachelor').includes('psychology'))
  assert.deepEqual(f('Spanisch Bachelor Lehramt an Gymnasien und Gesamtschulen'), ['education', 'languages'])
  // «Gymnasien» is not Asia, «Transport» is not sport, «Kunststoff» is not art.
  assert.ok(!f('Geschichte Bachelor Lehramt an Gymnasien').includes('languages'))
  assert.ok(!f('Transportlogistik').includes('sports-science'))
  assert.ok(!f('Kunststofftechnik').includes('fine-arts'))
})

test('Studiensuche offers become programmes', () => {
  assert.equal(deLevel('Bachelor/Bakkalaureus'), 'bachelor')
  assert.equal(deLevel('Staatsexamen'), 'professional')
  assert.equal(deType('Fachhochschule/Hochschule für angewandte Wissenschaften', 'Hochschule Osnabrück'), 'fh')
  const p = parseAngebot(
    {
      id: '1',
      studiBezeichnung: 'Elektrotechnik Bachelor',
      abschlussgrad: { label: 'Bachelor/Bakkalaureus' },
      hochschulart: { label: 'Fachhochschule/Hochschule für angewandte Wissenschaften' },
      region: { Key: 'NI', label: 'Niedersachsen' },
      studienanbieter: { name: 'Hochschule Osnabrück' },
    },
    '2026-01-01T00:00:00.000Z',
  )
  assert.equal(p?.country, 'DE')
  assert.equal(p?.institutionType, 'fh')
  assert.deepEqual(p?.fields, ['electrical-engineering'])
})

test('studienwahl.at list pages are parsed', () => {
  const html = `<div class="course col-12"> <h2>Pharmazie</h2> <p>Universität Wien</p> <b>Bachelorstudium » Wien</b> <a href="/studien/pharmazie-123.html">mehr</a></div>`
  const [it] = parseList(html)
  assert.deepEqual(it, { name: 'Pharmazie', institution: 'Universität Wien', kind: 'Bachelorstudium', place: 'Wien', href: '/studien/pharmazie-123.html' })
  const p = parseItem(it, '2026-01-01T00:00:00.000Z')
  assert.equal(p?.institutionType, 'uni')
  assert.deepEqual(p?.fields, ['pharmacy'])
  assert.equal(p?.url, 'https://www.studienwahl.at/studien/pharmazie-123.html')
  assert.equal(atLevel('Masterstudium (Continuing Education)'), null)
  assert.equal(atLevel('Lehramtsstudium Bachelor'), 'bachelor')
  assert.equal(findAtInstitution('Hochschule für Angewandte Wissenschaften St. Pölten')?.id, 'fhstp')
  assert.equal(findAtInstitution('FH OÖ Studienbetriebs GmbH')?.id, 'fhooe')
})
