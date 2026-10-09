import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { CATALOGUE_COUNTRIES, LINK_ONLY, countryBySlug, countrySlug, normalizeSearch } from '../lib/catalogue.ts'
import { CATALOGUE_KEYS, toCatalogueEntry } from '../lib/programmes.ts'
import type { CatalogueShard, Programme } from '../lib/programmes.ts'

/** What the paid list adds on top of the free catalogue. */
const PAID = ['tuition', 'earnings', 'debt', 'admissionRate', 'selective', 'capacity', 'description']

test('the free catalogue carries none of the paid fields', () => {
  for (const k of PAID) assert.ok(!(CATALOGUE_KEYS as readonly string[]).includes(k), k)
  const full: Programme = {
    id: 'x', name: 'Informatik', institution: 'ETH Zürich', country: 'CH', level: 'bachelor', fields: ['computer-science'], fieldConfidence: 1,
    tuition: { currency: 'CHF', domestic: 730 }, earnings: { median: 90000, currency: 'CHF', yearsAfter: 1 }, admissionRate: 0.5, capacity: 400,
    description: 'Text of the institution', source: 'ch-studyprogrammes', updated: '2026-01-01',
  }
  assert.deepEqual(Object.keys(toCatalogueEntry(full)).sort(), ['fields', 'id', 'institution', 'level', 'name'])
  for (const f of readdirSync('data/sample/catalogue')) {
    const shard = JSON.parse(readFileSync(`data/sample/catalogue/${f}`, 'utf8')) as CatalogueShard
    for (const p of shard.programmes) for (const k of Object.keys(p)) assert.ok((CATALOGUE_KEYS as readonly string[]).includes(k), `${f}: ${k}`)
  }
})

test('countries without an open licence get no catalogue file', () => {
  const files = readdirSync('data/sample/catalogue')
  for (const cc of Object.keys(LINK_ONLY)) assert.ok(!files.includes(`${cc}.json`), cc)
})

test('every catalogue country has its own address', () => {
  const slugs = CATALOGUE_COUNTRIES.map(countrySlug)
  assert.equal(new Set(slugs).size, slugs.length)
  for (const cc of CATALOGUE_COUNTRIES) assert.equal(countryBySlug(countrySlug(cc)), cc)
  assert.equal(countrySlug('KR'), 'south-korea')
  assert.equal(countryBySlug('narnia'), null)
})

test('search ignores case, accents and ß', () => {
  assert.equal(normalizeSearch('Zürich, Betriebsökonomie'), 'zurich betriebsokonomie')
  assert.equal(normalizeSearch('Straße'), 'strasse')
})

test('search finds programmes by name, place and field, in the page language', async () => {
  const { spawnSync } = await import('node:child_process')
  const env = { ...process.env }
  for (const k of ['WSIS_DATA_URL', 'VERCEL_GIT_REPO_OWNER', 'VERCEL_GIT_REPO_SLUG']) delete env[k]
  // server-only modules use React's server export condition in this isolated process.
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { searchCatalogue } from './lib/server/catalogue.ts';
    const q = (o) => searchCatalogue({ country: 'CH', locale: 'de-CH', page: 0, q: '', ...o });
    const bern = await q({ q: 'bern architektur' });
    assert.ok(bern.ready);
    assert.ok(bern.items.length > 0);
    assert.ok(bern.items.every((p) => p.city === 'Bern' && p.fields.includes('architecture')));
    // A field's English name finds programmes named in German.
    const en = await searchCatalogue({ country: 'CH', locale: 'en', page: 0, q: 'business management' });
    assert.ok(en.items.some((p) => p.name.includes('Betriebsökonomie')));
    const masters = await q({ q: 'zurich', level: 'master' });
    assert.ok(masters.items.every((p) => p.level === 'master'));
    assert.ok((masters.levels.bachelor ?? 0) > 0);
    for (const p of masters.items) assert.equal(p.tuition, undefined);
    assert.equal((await q({ q: 'qqqxxx' })).total, 0);
  `], { cwd: process.cwd(), env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
