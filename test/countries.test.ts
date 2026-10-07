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
