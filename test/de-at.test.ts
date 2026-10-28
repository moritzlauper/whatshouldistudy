import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deLevel, deType, parseAngebot } from '../scrapers/de-studiensuche.ts'
import { atLevel, parseItem, toListItem } from '../scrapers/at-hochschulen.ts'
import type { AtRecord } from '../scrapers/at-hochschulen.ts'
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

test('the Austrian open dataset becomes programmes', () => {
  const record: AtRecord = {
    studium_id: 123,
    studium_de: 'Pharmazie',
    typ_de: 'Bachelorstudium',
    hochschule_de: 'Universität',
    institution_de: 'Universität Wien',
    ort_de: 'Wien',
    studieninfourl_de: 'https://studieren.univie.ac.at/pharmazie',
    uniurl_de: 'https://www.univie.ac.at/',
  }
  const it = toListItem(record)
  assert.deepEqual(it, { id: '123', name: 'Pharmazie', institution: 'Universität Wien', kind: 'Bachelorstudium', place: 'Wien', hochschule: 'Universität', link: 'https://studieren.univie.ac.at/pharmazie' })
  const p = parseItem(it, '2026-01-01T00:00:00.000Z')
  assert.equal(p?.institutionType, 'uni')
  assert.equal(p?.level, 'bachelor')
  assert.equal(p?.country, 'AT')
  assert.equal(p?.source, 'at-studienwahl')
  assert.deepEqual(p?.fields, ['pharmacy'])
  assert.equal(p?.url, 'https://studieren.univie.ac.at/pharmazie')
  // Without a link on the record, the programme links to the portal's search.
  assert.equal(toListItem({ ...record, studieninfourl_de: null, uniurl_de: null }).link, 'https://www.studienwahl.at/studien/?q=Pharmazie')
  // A record without a name or with a doctorate is no programme here.
  assert.equal(parseItem(toListItem({ ...record, studium_de: null }), '2026-01-01T00:00:00.000Z'), null)
  assert.equal(parseItem(toListItem({ ...record, typ_de: 'Doktoratsstudium' }), '2026-01-01T00:00:00.000Z'), null)
  assert.equal(atLevel('Masterstudium (Continuing Education)'), null)
  assert.equal(atLevel('Lehramtsstudium Bachelor'), 'bachelor')
  assert.equal(findAtInstitution('Hochschule für Angewandte Wissenschaften St. Pölten')?.id, 'fhstp')
  assert.equal(findAtInstitution('FH OÖ Studienbetriebs GmbH')?.id, 'fhooe')
})
