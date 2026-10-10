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

test('Netherlands: registry prefixes for degree and study form are dropped from names', async () => {
  const { tidy } = await import('../scrapers/nl-duo.ts')
  assert.equal(tidy('M Finance'), 'Finance')
  assert.equal(tidy('B Food Commerce and Techn. VT'), 'Food Commerce and Techn.')
  assert.equal(tidy('AD Maintenance DT'), 'Maintenance')
  assert.equal(tidy('Bachelor of Design'), 'Bachelor of Design')
})

test('Switzerland: the universities’ own lists, with specialisations and Eckdaten', async () => {
  const ch = await import('../scrapers/ch-hochschulen.ts')
  const { findChInstitution } = await import('../lib/ch-institutions.ts')
  const uzh = ch.uzhList(
    `<article class="SubpageList--entry"><a class="Link" href="/de/studies/programs/bachelor/biology.html">Biologie</a><div class="SubpageList--entry--text">Typ: Mono, Major / Bereich: Naturwissenschaften / Sprache: deutsch, englisch</div></article>
     <article class="SubpageList--entry"><a class="Link" href="/de/studies/programs/bachelor/x.html">Nur Nebenfach</a><div class="SubpageList--entry--text">Typ: Minor / Bereich: X / Sprache: deutsch</div></article>`,
    'https://www.uzh.ch/', 'bachelor')
  assert.deepEqual(uzh.map((x) => [x.name, x.url, x.languages]), [['Bachelor Biologie', 'https://www.uzh.ch/de/studies/programs/bachelor/biology.html', ['de', 'en']]])
  const epfl = ch.epflDetail('<p>The EPFL program offers specializations in the following areas:</p><ul><li>AI &amp; Data Science</li><li>Cyber Security</li></ul><h3>Teaching language</h3><p>English. Excellent skills are required.</p>')
  assert.deepEqual(epfl, { focus: ['AI & Data Science', 'Cyber Security'], languages: ['en'] })
  assert.deepEqual(ch.zhawDetail('<p>Im letzten Studienjahr wählen Sie eine von drei Vertiefungen (Artificial Intelligence, Cybersecurity, Software Engineering) aus.</p>').focus, ['Artificial Intelligence', 'Cybersecurity', 'Software Engineering'])
  const zhaw = ch.zhawList('<a href="/de/linguistik/studium/master-lc"><h3>Detailinformationen zum Masterstudiengang Language and Communication</h3></a><a href="/de/linguistik/studium/master-lc/master-profil-konferenzdolmetschen"><h3>Konferenzdolmetschen</h3></a>', 'https://www.zhaw.ch/', 'master')
  assert.deepEqual(zhaw.map((x) => [x.name, x.focus]), [['Master Language and Communication', ['Konferenzdolmetschen']]])
  assert.deepEqual(ch.unibasDetail('<dl><dt>Regelstudienzeit</dt><dd>6 Semester</dd><dt>Credits</dt><dd>180</dd><dt>Sprache</dt><dd>Deutsch &amp; Englisch</dd></dl>'), { ects: 180, durationYears: 3, languages: ['de', 'en'] })
  // Philologies and other Swiss names the general classifier misses still get a field.
  const p = ch.toProgramme({ name: 'Bachelor Griechische Philologie', level: 'bachelor', url: 'https://www.uzh.ch/x' }, findChInstitution('UZH')!, '2026-01-01')
  assert.deepEqual(p?.fields, ['languages', 'literature'])
  assert.equal(p?.source, 'ch-hochschulen')
})

test('Switzerland: names, groups and fact sheets of the further universities', async () => {
  const ch = await import('../scrapers/ch-hochschulen.ts')
  assert.equal(ch.degreeName('bachelor', 'Bachelor of Science in Bauingenieurwesen'), 'Bachelor Bauingenieurwesen')
  assert.equal(ch.degreeName('bachelor', 'Industrial Design BA'), 'Bachelor Industrial Design')
  assert.equal(ch.degreeName('master', 'Masterstudio Scenography MA'), 'Master Scenography')
  assert.equal(ch.degreeName('master', 'MSE  - Profil Electrical Engineering\uFEFF'), 'Master Engineering, Profil Electrical Engineering')
  const eth = ch.ethMasters(JSON.stringify({ path: '/de.html', children: [{ path: '/de/studium/master/studienangebot.html', children: [{ title: 'Ingenieurwissenschaften', path: '/a.html', children: [{ title: 'Informatik', path: '/de/x/informatik.html' }, { title: 'Alt', path: '/de/x/alt.html', hidden: true }] }] }] }), 'https://ethz.ch/')
  assert.deepEqual(eth.map((x) => [x.name, x.url]), [['Master Informatik', 'https://ethz.ch/de/x/informatik.html']])
  assert.deepEqual(ch.ethDetail('<h2>Vertiefungen</h2><ul><li>Machine Intelligence</li><li>Theoretical Computer Science</li></ul><h2>Unterrichtssprache</h2><p>Englisch</p><h2>Umfang | Studiendauer</h2><p>120 ECTS | 2 Jahre</p>'), { focus: ['Machine Intelligence', 'Theoretical Computer Science'], languages: ['en'], ects: 120, durationYears: 2 })
  const hslu = ch.hsluList(
    `<a href="/de-ch/wirtschaft/studium/bachelor/business-administration/marketing">Bachelor of Science in Business Administration, Major Marketing</a>
     <a href="/de-ch/wirtschaft/studium/bachelor/business-administration/tourismus">Bachelor of Science in Business Administration, Major Tourismus</a>
     <a href="/de-ch/design-film-kunst/studium/bachelor/animation/fakten">Fakten zum Bachelor Animation</a>`,
    'https://www.hslu.ch/', 'bachelor')
  assert.deepEqual(hslu.map((x) => [x.name, x.url, x.focus]).sort(), [
    ['Bachelor Animation', 'https://www.hslu.ch/de-ch/design-film-kunst/studium/bachelor/animation', undefined],
    ['Bachelor Business Administration', 'https://www.hslu.ch/de-ch/wirtschaft/studium/bachelor/business-administration', ['Marketing', 'Tourismus']],
  ])
  assert.deepEqual(ch.bfhDetail('<h1>Informatik</h1><li><span class="infolist-title">Vertiefungen</span>IT-Security<br>Distributed Systems</li><li><span class="infolist-title">Studienform</span>Vollzeit (VZ, 6 Semester)</li><li><span class="infolist-title">Anzahl ECTS</span>180 ECTS</li><li><span class="infolist-title">Unterrichtssprache</span>Deutsch, ergänzt durch Englisch</li>'), { name: 'Informatik', focus: ['IT-Security', 'Distributed Systems'], ects: 180, durationYears: 3, languages: ['de', 'en'] })
  assert.deepEqual(ch.unifrDetail('<h4>Studienstruktur</h4><div><p>120 ECTS-Kreditpunkte + 60 ECTS-Kreditpunkte in Nebenprogrammen, 6 Semester</p></div><h4>Studiensprachen</h4><div><p>Studium auf Deutsch und Französisch</p></div>'), { ects: 180, durationYears: 3, languages: ['de', 'fr'] })
  const unibe = ch.unibeList('<a href="https://www.philnat.unibe.ch/studium/studienprogramme/bachelor_biologie/index_ger.html">Biologie (Mono)</a><a href="https://www.philhist.unibe.ch/studium/studienprogramme/bachelor_x/index_ger.html">Nur Minor</a>', 'https://www.unibe.ch/', 'bachelor')
  assert.deepEqual(unibe.map((x) => x.name), ['Bachelor Biologie'])
})
