import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATALOGUE_COUNTRIES, LINK_ONLY, PROGRAMME_PAGES_PENDING, hasProgrammePages, idFromSlug, programmeSlug } from '../lib/catalogue.ts'
import { routes } from '../lib/site/config.ts'
import { perFile, sitemapFile, sitemapFiles, sitemapGroups, sitemapXml } from '../lib/site/sitemaps.ts'

test('a programme slug is readable ASCII and ends in its id', () => {
  const eth = { id: 'q9sc9jkfs1', name: 'Bachelor Informatik', institution: 'ETH Zürich' }
  assert.equal(programmeSlug(eth), 'bachelor-informatik-eth-zurich-q9sc9jkfs1')
  assert.equal(idFromSlug(programmeSlug(eth)), 'q9sc9jkfs1')
  // A Korean title gives way to its English focus.
  assert.equal(programmeSlug({ id: '14b3e5n58g7', name: '식품영양학과', institution: 'Keimyung University', focus: ['Food and nutrition'] }), 'food-and-nutrition-keimyung-university-14b3e5n58g7')
  const long = programmeSlug({ id: 'abc123def', name: 'BTS - Production - Cybersécurité, Informatique et réseaux, ELectronique - Option B : Electronique et réseaux', institution: 'Lycée Edouard Branly - CFAI LYON' })
  assert.ok(long.length <= 80 + 10, long)
  assert.match(long, /^[a-z0-9-]+$/)
  assert.equal(idFromSlug(long), 'abc123def')
  assert.equal(idFromSlug('no-id-here-!'), null)
})

test('programme pages only where the source has an open licence', () => {
  for (const cc of [...Object.keys(LINK_ONLY), ...Object.keys(PROGRAMME_PAGES_PENDING)]) assert.equal(hasProgrammePages(cc), false, cc)
  // Germany and Austria link to the official search only.
  for (const cc of ['DE', 'AT']) assert.equal(hasProgrammePages(cc), false, cc)
  for (const cc of ['US', 'GB', 'FR', 'CH']) assert.equal(hasProgrammePages(cc), CATALOGUE_COUNTRIES.includes(cc), cc)
})

test('a programme lives under its main field', () => {
  assert.equal(routes('global').programme('CH', 'computer-science', 'x-abc123'), '/programmes/switzerland/computer-science/x-abc123')
  assert.equal(routes('ch', '/schweiz').programme('CH', 'computer-science', 'x-abc123'), '/schweiz/studiengaenge/informatik/x-abc123')
  assert.equal(routes('ch', '', 'fr-CH').programme('CH', 'computer-science', 'x-abc123'), '/fr/studiengaenge/informatik/x-abc123')
})

test('programme sitemaps: per host, per country, under the 50,000 limit', () => {
  const groups = sitemapGroups('whatshouldistudy.com')
  assert.ok(groups.some((g) => g.site === 'global' && g.country === 'US'))
  assert.ok(!groups.some((g) => g.country === 'DE' || g.country === 'AT'))
  assert.ok(groups.some((g) => g.site === 'global' && g.country === 'CH'))
  assert.ok(sitemapGroups('wasstudieren.ch').some((g) => g.site === 'ch' && g.country === 'CH'))
  const files = sitemapFiles('whatshouldistudy.com', (cc) => (cc === 'US' ? 97_538 : 1000))
  assert.deepEqual(files.filter((f) => f.startsWith('global-us-')), ['global-us-0.xml', 'global-us-1.xml', 'global-us-2.xml'])
  const us = sitemapFile('whatshouldistudy.com', 'global-us-2.xml')
  assert.equal(us?.part, 2)
  assert.ok(perFile(us!.group) * us!.group.locales.length <= 50_000)
  assert.equal(sitemapFile('whatshouldistudy.com', 'global-de-0.xml'), null)
  assert.equal(sitemapFile('whatshouldistudy.com', '../etc.xml'), null)
  const xml = sitemapXml([{ loc: 'https://x.com/a?b=1&c=2', alternates: { 'de-CH': 'https://x.ch/a' } }])
  assert.match(xml, /<loc>https:\/\/x\.com\/a\?b=1&amp;c=2<\/loc>/)
  assert.match(xml, /hreflang="de-CH"/)
})

test('a programme page finds its programme by id and moves to its own address', async () => {
  const { spawnSync } = await import('node:child_process')
  const env = { ...process.env }
  for (const k of ['WSIS_DATA_URL', 'VERCEL_GIT_REPO_OWNER', 'VERCEL_GIT_REPO_SLUG']) delete env[k]
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { resolveProgramme } from './lib/server/programme.ts';
    import { programmeSlug } from './lib/catalogue.ts';
    import { getCatalogue } from './lib/server/data.ts';
    const gb = await getCatalogue('GB');
    const p = gb.programmes.find((x) => x.fields.length > 1);
    const slug = programmeSlug(p);
    const ok = await resolveProgramme('GB', p.fields[0], slug);
    assert.equal(ok.found.p.id, p.id);
    // Under a second field or an old slug: the programme's own address.
    assert.deepEqual((await resolveProgramme('GB', p.fields[1], slug)).redirect, { field: p.fields[0], slug });
    assert.deepEqual((await resolveProgramme('GB', p.fields[0], 'old-name-' + p.id)).redirect, { field: p.fields[0], slug });
    // An id from an older data run: found again by name, else the field's list.
    assert.deepEqual((await resolveProgramme('GB', p.fields[0], slug.replace(/[a-z0-9]+$/, 'zzzzzzzz'))).redirect, { field: p.fields[0], slug });
    assert.deepEqual(await resolveProgramme('GB', p.fields[0], 'nothing-zzzzzzzz'), { gone: p.fields[0] });
    assert.equal(await resolveProgramme('DE', p.fields[0], slug), null);
    // Switzerland, from the BFS rows.
    const ch = (await getCatalogue('CH')).programmes[0];
    assert.equal((await resolveProgramme('CH', ch.fields[0], programmeSlug(ch))).found.p.id, ch.id);
    // Only the catalogue's fields reach the page.
    assert.equal(ok.found.p.source !== undefined, true);
  `], { cwd: process.cwd(), env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
