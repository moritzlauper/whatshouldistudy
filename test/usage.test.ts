import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IMPORT_SOURCES, PROFILE_CODES, eventCounter, parseImport, parseProfile, parseUsage, profileCounters, programmeCounters, sourceCounter, usageDay, usagePeriods, validDay, validMonth } from '../lib/usage-stats.ts'

test('imports accept only fixed categories and reject extra data', () => {
  for (const source of IMPORT_SOURCES) assert.deepEqual(parseImport({ source }), { source })
  for (const input of [null, [], 'youtube', { source: 'personal filename.json' }, { source: 'takeout', filename: 'secret.zip' }, { source: 'takeout', answers: [1, 2] }]) {
    assert.equal(parseImport(input), null)
  }
  assert.deepEqual(JSON.parse(sourceCounter('takeout')), { kind: 'import', source: 'takeout' })
})

test('browsers may report imports and shown results, but never unlocks or extra data', () => {
  assert.deepEqual(parseUsage({ event: 'result' }), { event: 'result' })
  assert.deepEqual(parseUsage({ source: 'takeout' }), { source: 'takeout' })
  for (const input of [{ event: 'unlock' }, { event: 'purchase' }, { event: 'result', score: 3 }, { event: 'result', source: 'takeout' }, ['result'], null]) {
    assert.equal(parseUsage(input), null)
  }
  assert.deepEqual(JSON.parse(eventCounter('unlock')), { kind: 'event', event: 'unlock' })
})

test('profile reports accept only a basis, a Holland code and up to three catalogue fields', () => {
  assert.equal(PROFILE_CODES.length, 122)
  const profile = { basis: 'both' as const, code: 'SIA', fields: ['psychology', 'education', 'social-work'] }
  assert.deepEqual(parseUsage({ event: 'result', profile }), { event: 'result', profile })
  assert.deepEqual(parseProfile({ basis: 'questionnaire', code: 'careless', fields: ['law'] }), { basis: 'questionnaire', code: 'careless', fields: ['law'] })
  for (const input of [
    { ...profile, basis: 'youtube' },
    { ...profile, code: 'SSA' },
    { ...profile, code: 'sia' },
    { ...profile, fields: [] },
    { ...profile, fields: ['psychology', 'psychology'] },
    { ...profile, fields: ['psychology', 'education', 'social-work', 'law'] },
    { ...profile, fields: ['my secret hobby'] },
    { ...profile, fields: ['__proto__'] },
    { ...profile, score: 80 },
    { basis: 'both', code: 'SIA' },
  ]) assert.equal(parseProfile(input), null, JSON.stringify(input))
  assert.equal(parseUsage({ event: 'result', profile: { ...profile, code: 'XYZ' } }), null)
  assert.equal(parseUsage({ event: 'result', profile, extra: 1 }), null)
  assert.deepEqual(profileCounters(profile).map((c) => JSON.parse(c)), [
    { kind: 'profile', basis: 'both', code: 'SIA', rank: 1, field: 'psychology' },
    { kind: 'profile', basis: 'both', code: 'SIA', rank: 2, field: 'education' },
    { kind: 'profile', basis: 'both', code: 'SIA', rank: 3, field: 'social-work' },
  ])
})

test('a shown result reports only its profile class and first fields', async () => {
  const { resultProfile } = await import('../lib/product-measure.ts')
  const results = {
    riasec: { profile: [0.2, 0.5, 0.9, 0.8, 0.3, 0.1], code: 'ASI', from: ['questionnaire'] },
    sources: [{ id: 'youtube', label: 'YouTube', dataPoints: 300 }],
    quality: { flat: false, careless: false, topTie: false, differentiation: 0.6, elevation: 0.4, questionnaireLed: true },
    fields: [{ id: 'fine-arts' }, { id: 'psychology' }, { id: 'education' }, { id: 'law' }],
  } as unknown as Parameters<typeof resultProfile>[0]
  assert.deepEqual(resultProfile(results), { basis: 'both', code: 'ASI', fields: ['fine-arts', 'psychology', 'education'] })
  assert.equal(resultProfile({ ...results, quality: { ...results.quality!, flat: true } })?.code, 'flat')
  assert.equal(resultProfile({ ...results, quality: { ...results.quality!, flat: true, careless: true } })?.code, 'careless')
  assert.equal(resultProfile({ ...results, sources: [] })?.basis, 'questionnaire')
  assert.equal(resultProfile({ ...results, riasec: { ...results.riasec, from: ['footprint'] } })?.basis, 'data')
  assert.equal(resultProfile({ ...results, riasec: { profile: results.riasec.profile, code: '', from: [] }, sources: [] }), null)
})

test('programme counters strip derived interests, scores and tokens', () => {
  const p = { id: 'test-1', name: 'Computer Science', institution: 'University', match: 95, matchedField: 'sensitive-field', topicHits: ['private interest'], token: 'secret' }
  const counters = programmeCounters([p, p], 'unlocked')
  assert.equal(counters.length, 1)
  assert.deepEqual(JSON.parse(counters[0]), { kind: 'programme', placement: 'unlocked', id: 'test-1', name: 'Computer Science', institution: 'University' })
  assert.equal(programmeCounters([], 'preview').length, 0)
})

test('report month cannot address other Redis keys', () => {
  assert.ok(validMonth('2026-10'))
  for (const value of ['2026-00', '2026-13', '*', '2026-01:secret', '../tokens']) assert.equal(validMonth(value), false)
})

test('daily reports validate calendar dates and reject other Redis keys', () => {
  for (const day of ['2026-10-20', '2024-02-29', '2000-02-29']) assert.ok(validDay(day), day)
  for (const day of ['2026-02-29', '2026-04-31', '2026-00-01', '2026-10', '2026-10-20:secret', '../tokens', '*']) assert.equal(validDay(day), false, day)
})

test('Swiss daily boundaries follow DST while monthly keys remain UTC', () => {
  for (const [instant, day] of [
    ['2026-10-19T21:59:59Z', '2026-10-19'],
    ['2026-10-19T22:00:00Z', '2026-10-20'],
    ['2026-01-19T22:59:59Z', '2026-01-19'],
    ['2026-01-19T23:00:00Z', '2026-01-20'],
    ['2026-03-29T21:59:59Z', '2026-03-29'],
    ['2026-03-29T22:00:00Z', '2026-03-30'],
    ['2026-10-25T22:59:59Z', '2026-10-25'],
    ['2026-10-25T23:00:00Z', '2026-10-26'],
  ]) assert.equal(usageDay(new Date(instant)), day, instant)
  const periods = usagePeriods(new Date('2026-10-31T23:30:00Z'))
  assert.equal(periods.month, '2026-10')
  assert.equal(periods.day, '2026-11-01')
  assert.equal(periods.monthExpiry, Date.parse('2026-11-01T00:00:00Z') / 1000 + 90 * 86400)
  assert.equal(periods.dayExpiry, Date.parse('2026-11-02T00:00:00Z') / 1000 + 90 * 86400)
})

test('storage writes only aggregates, sets retention, and survives outages', async () => {
  const { spawnSync } = await import('node:child_process')
  // server-only modules use React's server export condition in this isolated process.
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { countUsage, readDailySince, readUsage, usageConfigured } from './lib/server/usage.ts';
    const commands = [];
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://test.invalid');
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      assert.equal(options.cache, 'no-store');
      const command = JSON.parse(options.body);
      commands.push(command);
      return { ok: true, json: async () => ({ result: command[0] === 'HGETALL' ? ['{"kind":"import","source":"takeout"}', '4'] : command[0] === 'GET' ? '2026-10-20' : 1 }) };
    };
    assert.equal(usageConfigured(), true);
    const counter = '{"kind":"import","source":"takeout"}';
    await countUsage([counter]);
    const command = commands[0];
    assert.equal(command[0], 'EVAL');
    assert.equal(command[2], 3);
    assert.match(command[3], /^wsis:usage:v1:20\\d{2}-\\d{2}$/);
    const month = new Date(command[3].slice(-7) + '-01T00:00:00Z');
    const expiry = Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1) / 1000 + 90 * 86400;
    assert.match(command[4], /^wsis:usage:day:zurich:v1:20\\d{2}-\\d{2}-\\d{2}$/);
    assert.equal(command[5], 'wsis:usage:day:zurich:v1:since');
    assert.equal(command[6], expiry);
    assert.equal(command[7], Date.parse(command[8] + 'T00:00:00Z') / 1000 + 91 * 86400);
    assert.equal(command[4].slice(-10), command[8]);
    assert.deepEqual(command.slice(9), [counter]);
    assert.deepEqual(await readUsage('2026-10'), [{ kind: 'import', source: 'takeout', count: 4 }]);
    await assert.rejects(() => readUsage('*'));
    assert.deepEqual(await readUsage('2026-10-20'), [{ kind: 'import', source: 'takeout', count: 4 }]);
    assert.deepEqual(commands.at(-1), ['HGETALL', 'wsis:usage:day:zurich:v1:2026-10-20']);
    assert.equal(await readDailySince(), '2026-10-20');
    await assert.rejects(() => readUsage('2026-02-30'));
    const before = commands.length;
    delete process.env.USAGE_REDIS_REST_TOKEN;
    await countUsage([counter]);
    assert.equal(commands.length, before);
    process.env.USAGE_REDIS_REST_TOKEN = 'test-token';
    globalThis.fetch = async () => { throw new Error('private connection details'); };
    const warnings = [];
    console.warn = (text) => warnings.push(text);
    await countUsage([counter]);
    assert.deepEqual(warnings, ['Usage statistics storage unavailable']);
  `], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_PUBLIC_USAGE_STATS: '1', USAGE_KV_REST_API_URL: '', USAGE_KV_REST_API_TOKEN: '', USAGE_REDIS_REST_URL: 'https://test.invalid', USAGE_REDIS_REST_TOKEN: 'test-token' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
})
