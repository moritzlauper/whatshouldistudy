import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFiDetail } from '../scrapers/fi-opintopolku.ts'
import type { FiDetail } from '../scrapers/fi-opintopolku.ts'

const at = '2026-10-07T00:00:00.000Z'

test('Finland: level, ISCED field and one row per institution from Opintopolku', () => {
  const d: FiDetail = {
    oid: '1.2.246.562.13.1',
    koulutustyyppi: 'yo',
    johtaaTutkintoon: true,
    kielivalinta: ['en', 'fi'],
    nimi: { en: " Master's Programme in Social Psychology", fi: 'Sosiaalipsykologian maisteriohjelma' },
    koulutukset: [{ koodiUri: 'koulutus_726401#12' }],
    tarjoajat: [{ oid: '1.2.246.562.10.39218317368', nimi: { en: 'University of Helsinki', fi: 'Helsingin yliopisto' }, paikkakunta: { nimi: { fi: 'Helsinki' } } }],
    koulutuskoodienAlatJaAsteet: [
      {
        koulutusalaKoodiUrit: ['kansallinenkoulutusluokitus2016koulutusalataso1_03', 'kansallinenkoulutusluokitus2016koulutusalataso3_0313'],
        koulutusasteKoodiUrit: ['kansallinenkoulutusluokitus2016koulutusastetaso1_7'],
      },
    ],
    metadata: { kuvaus: { en: '<p>Groups, identities and&nbsp;social influence.</p>' } },
  }
  const [p] = parseFiDetail(d, at)
  assert.equal(p.name, "Master's Programme in Social Psychology")
  assert.equal(p.level, 'master')
  assert.equal(p.fields[0], 'psychology')
  assert.equal(p.city, 'Helsinki')
  assert.deepEqual(p.languages, ['en'])
  assert.equal(p.tuition?.eu, 0)
  assert.equal(p.tuition?.international, 12000)
  assert.equal(p.description, 'Groups, identities and social influence.')
  assert.match(p.url ?? '', /opintopolku\.fi\/konfo\/en\/koulutus\/1\.2\.246/)

  const combined = parseFiDetail({ ...d, koulutuskoodienAlatJaAsteet: [{ koulutusasteKoodiUrit: ['kansallinenkoulutusluokitus2016koulutusastetaso1_6'] }, { koulutusasteKoodiUrit: ['kansallinenkoulutusluokitus2016koulutusastetaso1_7'] }] }, at)
  assert.equal(combined[0].level, 'integrated')
  assert.equal(parseFiDetail({ ...d, johtaaTutkintoon: false }, at).length, 0)
})

test('Australia: CRICOS degrees with field, city and yearly tuition', async () => {
  const { parseCricos, auLevel } = await import('../scrapers/au-cricos.ts')
  const course = (over: Record<string, string>) => ({
    'CRICOS Provider Code': '00099F',
    'Institution Name': 'University of Technology Sydney (UTS)',
    'CRICOS Course Code': '113313K',
    'Course Name': 'Bachelor of Psychology',
    'Field of Education 1 Detailed Field': '090701 - Psychology',
    'Course Level': 'Bachelor Degree',
    'Course Language': 'English',
    'Duration (Weeks)': '156',
    'Tuition Fee': '$150,000.00',
    Expired: 'No',
    ...over,
  })
  const { programmes } = parseCricos(
    {
      courses: [
        course({}),
        course({ 'CRICOS Course Code': 'X1', 'Course Name': 'Certificate III in Hairdressing', 'Course Level': 'Certificate III', 'Field of Education 1 Detailed Field': '110303 - Hairdressing' }),
        course({ 'CRICOS Course Code': 'X2', Expired: 'Yes' }),
        course({ 'CRICOS Course Code': 'X3', 'Course Name': 'Master of Data Science', 'Course Level': 'Masters Degree (Coursework)', 'Field of Education 1 Detailed Field': '020199 - Computer Science, n.e.c.', 'Duration (Weeks)': '104', 'Tuition Fee': '$100,000.00' }),
      ],
      institutions: [{ 'CRICOS Provider Code': '00099F', 'Trading Name': '', 'Institution Name': 'University of Technology Sydney (UTS)', 'Institution Type': 'Government', Website: 'www.uts.edu.au' }],
      courseLocations: [{ 'CRICOS Provider Code': '00099F', 'CRICOS Course Code': '113313K', 'Location City': 'ULTIMO', 'Location State': 'NSW' }],
    },
    '2026-10-07',
  )
  assert.equal(programmes.length, 2)
  const psy = programmes[0]
  assert.equal(psy.fields[0], 'psychology')
  assert.equal(psy.institution, 'University of Technology Sydney')
  assert.equal(psy.city, 'Ultimo')
  assert.equal(psy.region, 'New South Wales')
  assert.equal(psy.tuition?.international, 50000)
  assert.equal(psy.durationYears, 3)
  assert.equal(psy.institutionUrl, 'https://www.uts.edu.au')
  assert.equal(programmes[1].level, 'master')
  assert.ok(['statistics-data-science', 'computer-science'].includes(programmes[1].fields[0]))
  assert.equal(auLevel('Masters Degree (Extended)'), 'professional')
  assert.equal(auLevel('Graduate Diploma'), null)
})

test('Australia: CRICOS CSV keeps its column names', async () => {
  const { cricosRows } = await import('../scrapers/au-cricos.ts')
  const rows = cricosRows('﻿"CRICOS Provider Code","Course Name","Course Level"\r\n"00099F","Bachelor of Psychology","Bachelor Degree"\r\n')
  assert.equal(rows[0]['Course Level'], 'Bachelor Degree')
  assert.equal(rows[0]['CRICOS Provider Code'], '00099F')
})

test('Netherlands: DUO offerings, merged by place, with level, language and credits', async () => {
  const { parseDuo } = await import('../scrapers/nl-duo.ts')
  const { csvObjects } = await import('../scrapers/lib/common.ts')
  const header = '"ONDERWIJSBESTUURID","ONDERWIJSBESTUUR_NAAM","ONDERWIJSAANBIEDERID","ONDERWIJSAANBIEDER_NAAM","SOORT","OPLEIDINGSEENHEIDCODE","ERKENDEOPLEIDINGSCODE","VARIANT_VAN","ERKENNER","NAAM_LANG","INTERNATIONALE_NAAM","BEGINDATUM","EINDDATUM","NIVEAU","GRAAD","STUDIELAST","EQF","NLQF","WAARDEDOCUMENTSOORT","PENVOERDER","EIGENNAAM","EIGENNAAM_DUITS","EIGENNAAM_ENGELS","VORM","VOERTAAL","AANGEBODEN_OPLEIDING_BEGINDATUM","AANGEBODEN_OPLEIDING_EINDDATUM","EERSTE_INSTROOMDATUM","LAATSTE_INSTROOMDATUM","WEBSITE","SAMENWERKEND_MET","BUITENLANDSEPARTNER","DEFICIENTIE","EISEN_WERKZAAMHEDEN","PROPEDEUTISCHE_FASE","STUDIEKEUZECHECK","VERSNELD_TRAJECT","AANGEBODEN_OPLEIDINGCODE","EIGEN_AANGEBODEN_OPLEIDINGSLEUTEL","ONDERWIJSLOCATIECODE","ONDERWIJSLOCATIESTRAAT","ONDERWIJSLOCATIEPLAATS","OMSCHRIJVING"'
  const csv = [
    header,
    // The programme itself, without a provider: not an offering.
    '"100B349","Stichting HZ University of Appl. Scienc.","","","OPLEIDING","1001O2667","30020",,"NVAO","ICT","Information & Communication Technology",2013-09-01,,"HBO-BA","BACHELOR",240,"6","6","GETUIGSCHRIFT","Stichting HZ University of Applied Sciences",,,,,,,,,,,,,,,,,,,,,,,',
    '"100B349","Stichting HZ University of Appl. Scienc.","113A881","HZ University of Applied Sciences","OPLEIDING","1001O2667","30020",,"NVAO","ICT","Information & Communication Technology",2013-09-01,,"HBO-BA","BACHELOR",240,"6","6","GETUIGSCHRIFT","Stichting HZ University of Applied Sciences",,,,"DEELTIJD","NLD",2023-02-23,,2023-09-01,,"https://hz.nl/opleidingen/hbo-ict-deeltijd",,,,,"PROPEDEUTISCHE_FASE_EXAMEN","GEEN_STUDIEKEUZE_CHECK",,"6e574f4c",,"113X626","Het Groene Woud","Middelburg",',
    '"100B349","Stichting HZ University of Appl. Scienc.","113A881","HZ University of Applied Sciences","OPLEIDING","1001O2667","30020",,"NVAO","ICT","Information & Communication Technology",2013-09-01,,"HBO-BA","BACHELOR",240,"6","6","GETUIGSCHRIFT","Stichting HZ University of Applied Sciences",,,,"VOLTIJD","ENG",2021-09-01,,2021-09-01,,"https://hz.nl/opleidingen/hbo-ict",,,,,"PROPEDEUTISCHE_FASE_EXAMEN","GEEN_STUDIEKEUZE_CHECK",,"7e2f59f9",,"113X626","Het Groene Woud","Middelburg",',
    // Ended: no longer open to new students.
    '"100B349","Stichting HZ University of Appl. Scienc.","113A881","HZ University of Applied Sciences","OPLEIDING","1001O3168","34279",,"NVAO","Civiele Techniek","Civil Engineering",2002-09-01,2020-08-31,"HBO-BA","BACHELOR",240,"6","6","GETUIGSCHRIFT","Stichting HZ University of Applied Sciences",,,,"VOLTIJD","NLD",2002-09-01,,2002-09-01,,"https://hz.nl/ct",,,,,,,,"aa11",,"113X626","Het Groene Woud","Middelburg",',
  ].join('\n')
  const { programmes } = parseDuo(csvObjects(csv), '2026-10-10T00:00:00.000Z')
  assert.equal(programmes.length, 1)
  const ict = programmes[0]
  assert.equal(ict.name, 'Information & Communication Technology')
  assert.equal(ict.institution, 'HZ University of Applied Sciences')
  assert.equal(ict.city, 'Middelburg')
  assert.equal(ict.level, 'bachelor')
  assert.equal(ict.mode, 'both')
  assert.deepEqual(ict.languages?.sort(), ['en', 'nl'])
  assert.equal(ict.durationYears, 4)
  assert.equal(ict.ects, 240)
  assert.equal(ict.institutionType, 'fh')
  assert.ok(ict.fields.includes('information-systems') || ict.fields.includes('computer-science'), ict.fields.join())
  assert.deepEqual(ict.focus, ['ICT'])
})

test('Norway: DBH programmes with level, ISCED field from NUS, credits and language', async () => {
  const { parseDbh } = await import('../scrapers/no-dbh.ts')
  const base = { Institusjonskode: '1110', Institusjonsnavn: 'Universitetet i Oslo', Avdelingsnavn: 'Det samfunnsvitenskapelige fakultet', Årstall: '2026', Semester: '3', 'Andel av heltid': '1.00', Organisering_kode: '1', 'Underv.språk': 'NOR', 'Videreutd.': '0', 'Tilbys til': '99999' }
  const rows = [
    { ...base, Studieprogramkode: 'SOS-BA', Studieprogramnavn: 'Sosiologi (bachelor)', Nivåkode: 'B3', Studiepoeng: '180.00', 'NUS-kode': '631101' },
    // The same programme again in the spring term.
    { ...base, Semester: '1', Studieprogramkode: 'SOS-BA', Studieprogramnavn: 'Sosiologi (bachelor)', Nivåkode: 'B3', Studiepoeng: '180.00', 'NUS-kode': '631101' },
    { ...base, Studieprogramkode: 'PSY-PR', Studieprogramnavn: 'Profesjonsstudiet i psykologi', Nivåkode: 'PR', Studiepoeng: '360.00', 'NUS-kode': '732101', 'Underv.språk': 'ENG' },
    // Further education, a one-year unit and an ended programme are left out.
    { ...base, Studieprogramkode: 'VID', Studieprogramnavn: 'Videreutdanning i ledelse', Nivåkode: 'HN', Studiepoeng: '30.00', 'Videreutd.': '1' },
    { ...base, Studieprogramkode: 'ARS', Studieprogramnavn: 'Årsstudium i historie', Nivåkode: 'AR', Studiepoeng: '60.00' },
    { ...base, Studieprogramkode: 'OLD', Studieprogramnavn: 'Bachelor i gammelt fag', Nivåkode: 'B3', Studiepoeng: '180.00', 'Tilbys til': '20201' },
  ]
  const isced = new Map([
    ['631101', '0314'],
    ['732101', '0313'],
  ])
  const { programmes } = parseDbh(rows, isced, '2026-10-10T00:00:00.000Z')
  assert.equal(programmes.length, 2)
  const [sos, psy] = programmes
  assert.equal(sos.level, 'bachelor')
  assert.equal(sos.fields[0], 'sociology')
  assert.equal(sos.city, 'Oslo')
  assert.equal(sos.durationYears, 3)
  assert.deepEqual(sos.languages, ['no'])
  assert.equal(sos.institutionType, 'uni')
  assert.equal(psy.level, 'professional')
  assert.equal(psy.fields[0], 'psychology')
  assert.equal(psy.durationYears, 6)
  assert.deepEqual(psy.languages, ['en'])
})
