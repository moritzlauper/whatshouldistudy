import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { bfhCards, fhnwLoad, fhnwOffers, levelOf, offerFields, toProgramme, unibasCards, unigeCards, uniluCards, zhawCards, zhawLoad } from '../scrapers/ch-weiterbildung.ts'
import { findChInstitution } from '../lib/ch-institutions.ts'
import { CONTINUING, isContinuing } from '../lib/programmes.ts'
import { LEVEL_ORDER } from '../lib/catalogue.ts'
import { levelLabel } from '../lib/site/labels.ts'

test('continuing education levels: MAS, DAS, CAS and executive MBAs; MiCAS and courses are none', () => {
  assert.equal(levelOf('CAS Data Science'), 'cas')
  assert.equal(levelOf('Certificate of Advanced Studies in Mediation'), 'cas')
  assert.equal(levelOf('DAS Case Management'), 'das')
  assert.equal(levelOf('MAS / CAS in Leadership and Purpose'), 'mas')
  assert.equal(levelOf('Executive MBA HSG'), 'mas')
  assert.equal(levelOf('EMBA Controlling & Consulting'), 'mas')
  assert.equal(levelOf('MiCAS Leadership (26./27.11.2026)'), undefined)
  assert.equal(levelOf('Fachkurs AI Essentials für KMUs'), undefined)
  assert.ok(CONTINUING.every(isContinuing) && !isContinuing('master'))
  // After the degree levels, so catalogue pages list them last.
  assert.deepEqual(LEVEL_ORDER.slice(-3), ['mas', 'das', 'cas'])
  assert.equal(levelLabel('cas', 'de-CH'), 'CAS (Weiterbildung)')
  assert.equal(levelLabel('mas', 'fr-CH'), 'MAS (formation continue)')
})

test('continuing education fields come from the name without its type', () => {
  const fields = (name: string) => offerFields(name).fields
  assert.deepEqual(fields('CAS Bambusflöte bauen & spielen'), ['music'])
  assert.deepEqual(fields('MAS Denkmalpflege und Umnutzung'), ['architecture', 'history'])
  assert.deepEqual(fields('CAS Still- und Laktationsberatung'), ['nursing'])
  assert.deepEqual(fields('CAS Systemische Sozialpädagogik in der Kinder- und Jugendhilfe'), ['social-work'])
  assert.deepEqual(fields('CAS Lerncoaching'), ['education', 'psychology'])
  assert.deepEqual(fields('CAS Software Architecture'), ['computer-science'])
  assert.ok(fields('CAS Arbeits- und Organisationspsychologie').includes('psychology'))
  // A single word is no field of its own: «Engineering», «Mastering», «(integral)».
  assert.ok(!fields('CAS Generative AI Engineering').includes('mechanical-engineering'))
  assert.ok(!fields('CAS Mastering Agile').includes('music-production'))
  assert.ok(!fields('CAS Opferhilfe (integral)').includes('mathematics'))
  assert.deepEqual(fields('Executive MBA'), ['business-management'])
  // Theses and closing modules are no programmes.
  for (const name of ['CAS Master-Thesis', 'MAS Masterarbeit-Modul', 'MAS-Abschluss', 'CAS']) assert.deepEqual(fields(name), [], name)
})

test('FHNW: the site search gives type, language, place and fee; the sandbox and other types stay out', async () => {
  const json = JSON.stringify({
    items: [
      { '@id': 'https://www.fhnw.ch/de/technik-umwelt/weiterbildung/angebot/weiterbildungen/cas-okobilanzierung-lca', title: 'CAS Ökobilanzierung (LCA)', continuing_education_type: { token: 'cas' }, languages_used: [{ token: 'de' }], location: [{ title: 'Brugg-Windisch' }], fee_int: 7800 },
      { '@id': 'https://www.fhnw.ch/de/ph/weiterbildung/angebot/weiterbildungen/cas-schulleitung', title: 'CAS Schulleitung', continuing_education_type: { token: 'cas' }, location: [{ title: 'Online' }] },
      { '@id': 'https://www.fhnw.ch/de/wirtschaft/weiterbildung/angebot/weiterbildungen/emba', title: 'Executive MBA FHNW', continuing_education_type: { token: 'mba' }, fee_int: 49_000 },
      { '@id': 'https://www.fhnw.ch/de/sandkasten/weiterbildung/test', title: 'CAS Test', continuing_education_type: { token: 'cas' } },
      { '@id': 'https://www.fhnw.ch/de/wirtschaft/weiterbildung/angebot/weiterbildungen/kurs-x', title: 'Kurs Excel', continuing_education_type: { token: 'course' } },
    ],
  })
  const cas = fhnwOffers(json, '', 'cas')
  assert.deepEqual(cas.map((x) => x.name), ['CAS Ökobilanzierung (LCA)', 'CAS Schulleitung'])
  assert.deepEqual(cas[0], { name: 'CAS Ökobilanzierung (LCA)', level: 'cas', url: 'https://www.fhnw.ch/de/technik-umwelt/weiterbildung/angebot/weiterbildungen/cas-okobilanzierung-lca', institution: undefined, languages: ['de'], city: 'Brugg-Windisch', fee: 7800 })
  // The school of education is an institution of its own; «Online» is no campus.
  assert.equal(cas[1].institution, 'Pädagogische Hochschule FHNW')
  assert.equal(cas[1].city, undefined)
  assert.deepEqual(fhnwOffers(json, '', 'mas').map((x) => [x.name, x.fee]), [['Executive MBA FHNW', 49_000]])

  const pages = [{ items: [{ n: 1 }, { n: 2 }], items_total: 3 }, { items: [{ n: 3 }], items_total: 3 }]
  const asked: string[] = []
  const request = async (url: string) => (asked.push(url), { status: 200, text: JSON.stringify(pages[asked.length - 1]) })
  assert.equal(JSON.parse((await fhnwLoad('https://x/@search?a=1', request))!).items.length, 3)
  assert.deepEqual(asked, ['https://x/@search?a=1&b_start=0', 'https://x/@search?a=1&b_start=2'])
  const short = async () => ({ status: 200, text: JSON.stringify({ items: [], items_total: 5 }) })
  assert.equal(await fhnwLoad('https://x/@search?a=1', short), null)
})

test('BFH, ZHAW, Basel, Geneva and Lucerne cards', async () => {
  const bfh = `<li><div class="teas-course-teaser teaser"> <a href="https://www.bfh.ch/de/weiterbildung/cas/adipositas/"> <div class="teaser-body"> <ul class="list-unstyled title-categories"> <li>CAS</li> </ul> <h2 class="teaser-title"> Adipositas</h2> <p class="teaser-text">Text</p> </div> </a></div></li>
    <li><a href="https://www.bfh.ch/de/weiterbildung/emba/controlling-consulting/"> <div class="teaser-body"> <ul class="list-unstyled title-categories"> <li>EMBA</li> </ul> <h2 class="teaser-title">Controlling &amp; Consulting</h2> </div> </a></li>`
  assert.deepEqual(bfhCards(bfh, '', 'cas'), [{ name: 'CAS Adipositas', level: 'cas', url: 'https://www.bfh.ch/de/weiterbildung/cas/adipositas/' }])
  assert.deepEqual(bfhCards(bfh, '', 'mas').map((x) => x.name), ['EMBA Controlling & Consulting'])

  const card = (slug: string, title: string, ects: string, venue: string) => `<a href="/de/lsfm/weiterbildung/detail/kurs/${slug}">
      <div class="card h-100"><div class="card-header"><p class="topic lighter ng-binding">Bau</p>
      <p class="title h3"><strong> ${title} </strong></p><p class="graduation"><strong> ${ects} </strong></p></div>
      <div class="card-footer"><div class="course-venue col-sm "><p class="ng-binding"><span class="venue-title lighter"> Ort: </span><br> ${venue} </p></div></div></div></a>`
  const zhaw = card('mas-in-nachhaltigem-bauen', 'MAS in nachhaltigem Bauen', '(60 ECTS)', 'Zürich') + card('cas-x', 'Mobilität', '', 'Online')
  assert.deepEqual(zhawCards(zhaw, 'https://www.zhaw.ch/de/weiterbildung/finden-sie-ihr-angebot', 'mas'), [
    { name: 'MAS in nachhaltigem Bauen', level: 'mas', url: 'https://www.zhaw.ch/de/lsfm/weiterbildung/detail/kurs/mas-in-nachhaltigem-bauen', ects: 60, city: 'Zürich' },
    { name: 'MAS Mobilität', level: 'mas', url: 'https://www.zhaw.ch/de/lsfm/weiterbildung/detail/kurs/cas-x', ects: undefined, city: undefined },
  ])
  // A finder that ends before its stated number of results keeps the previous data.
  const finder = async (url: string) => ({ status: 200, text: /page%5D=1$/.test(url) ? `13 Ergebnisse ${card('a', 'A', '', '')}` : '' })
  assert.equal(await zhawLoad('https://www.zhaw.ch/x?tx_solr%5Bfilter%5D%5B0%5D=graduation%3ACAS', finder), null)
  const complete = async (url: string) => ({ status: 200, text: /page%5D=1$/.test(url) ? `2 Ergebnisse ${card('a', 'A', '', '')}` : card('b', 'B', '', '') })
  assert.equal(zhawCards((await zhawLoad('https://www.zhaw.ch/x?tx_solr%5Bfilter%5D%5B0%5D=graduation%3ACAS', complete))!, 'https://www.zhaw.ch/', 'cas').length, 2)

  const unibas = `<ul class="list-result"><li><a href="/studienangebot/kurs/cas-palliative-care-19711" title="CAS Palliative Care">
    <h2>CAS Palliative Care</h2><p>Start: Herbst</p></a></li><li><a href="/studienangebot/kurs/mas-x-1" title="MAS X"><h2>MAS Spiritual Care</h2></a></li></ul>`
  assert.deepEqual(unibasCards(unibas, 'https://advancedstudies.unibas.ch/studienangebot/kurse/certificate-of-advanced-studies-54/0', 'cas'), [
    { name: 'CAS Palliative Care', level: 'cas', url: 'https://advancedstudies.unibas.ch/studienangebot/kurs/cas-palliative-care-19711' },
  ])

  const unige = `<a href="https://www.unige.ch/formcont/cours/das-infosec"
     class="programme-card d-Sciences " data-type="DAS" data-lang="Français" data-title="DAS Sécurité de l&rsquo;information" data-past="0">x</a>
    <a href="https://www.unige.ch/formcont/cours/old" class="programme-card" data-type="DAS" data-lang="English" data-title="DAS Old" data-past="1">x</a>
    <a href="https://www.unige.ch/formcont/cours/emba" class="programme-card" data-type="MBA" data-lang="English" data-title="Global Health" data-past="0">x</a>`
  assert.deepEqual(unigeCards(unige, '', 'das'), [{ name: 'DAS Sécurité de l’information', level: 'das', url: 'https://www.unige.ch/formcont/cours/das-infosec', languages: ['fr'] }])
  assert.deepEqual(unigeCards(unige, '', 'mas').map((x) => x.name), ['Executive MBA Global Health'])

  const unilu = `<li><a href="/weiterbildung/tf/mas-cas-in-leadership-and-purpose/" target="" title="MAS / CAS in Leadership and Purpose">MAS</a></li>
    <li><a href="/weiterbildung/gmf/cas-palliative-care/ueberblick/" title="CAS in Palliative Care">CAS</a></li>
    <li><a href="/weiterbildung/ksf/uebersicht/" title="Kultur- und Sozialwissenschaftliche Fakultät">x</a></li>`
  assert.deepEqual(uniluCards(unilu, 'https://www.unilu.ch/weiterbildung/', 'mas').map((x) => x.url), ['https://www.unilu.ch/weiterbildung/tf/mas-cas-in-leadership-and-purpose/'])
  assert.deepEqual(uniluCards(unilu, 'https://www.unilu.ch/weiterbildung/', 'cas').map((x) => x.url), ['https://www.unilu.ch/weiterbildung/gmf/cas-palliative-care/'])
})

test('an offer becomes a programme with its own source and the fee for the whole programme', () => {
  const p = toProgramme({ name: 'CAS Ökobilanzierung (LCA)', level: 'cas', url: 'https://www.fhnw.ch/de/x', city: 'Muttenz', fee: 7800, languages: ['de'] }, findChInstitution('FHNW')!, '2026-10-22')!
  assert.equal(p.source, 'ch-weiterbildung')
  assert.equal(p.level, 'cas')
  assert.equal(p.region, 'BL')
  assert.deepEqual(p.fields, ['environmental-science'])
  assert.deepEqual(p.tuition, { currency: 'CHF', domestic: 7800, eu: 7800, international: 7800, total: true, note: 'Kosten des ganzen Programms laut Hochschule' })
  // No Matura rule: that one belongs to the bachelor's programmes.
  assert.equal(p.admission, undefined)
  assert.equal(toProgramme({ name: 'CAS Master-Thesis', level: 'cas', url: 'https://www.fhnw.ch/de/y' }, findChInstitution('FHNW')!, '2026-10-22'), null)
})

test('the ranking keeps continuing education apart from the degree programmes', () => {
  const env = { ...process.env }
  for (const key of ['WSIS_DATA_URL', 'VERCEL_GIT_REPO_OWNER', 'VERCEL_GIT_REPO_SLUG']) delete env[key]
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { rank, sanitizeRequest } from './lib/server/rank.ts';
    const fields = ['psychology', 'business-management', 'law', 'cybersecurity'].map(id => ({ id, score: 90 }));
    const base = { countries: ['CH'], maxTuitionEur: 0, origin: 'ch', englishOnly: false };
    const wb = ['mas', 'das', 'cas'];
    for (const level of ['bachelor', 'master', 'any']) {
      const r = await rank({ fields, prefs: { ...base, level }, pageSize: 2000 });
      assert.ok(r.total > 0, level);
      assert.ok(r.items.every(p => !wb.includes(p.level)), level);
    }
    const req = sanitizeRequest({ fields, prefs: { ...base, level: 'continuing' } });
    assert.equal(req.prefs.level, 'continuing');
    const r = await rank({ ...req, pageSize: 2000 });
    assert.ok(r.total >= 4);
    assert.ok(r.items.every(p => wb.includes(p.level)));
    const fee = r.items.find(p => p.tuition?.total);
    assert.equal(fee.fee.amount, fee.tuition.domestic);
  `], { cwd: process.cwd(), env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
