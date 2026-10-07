import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IMPORT_SOURCES, parseImport, programmeCounters, sourceCounter, validMonth } from '../lib/usage-stats.ts'

test('imports accept only fixed categories and reject extra data', () => {
  for (const source of IMPORT_SOURCES) assert.deepEqual(parseImport({ source }), { source })
  for (const input of [null, [], 'youtube', { source: 'personal filename.json' }, { source: 'takeout', filename: 'secret.zip' }, { source: 'takeout', answers: [1, 2] }]) {
    assert.equal(parseImport(input), null)
  }
  assert.deepEqual(JSON.parse(sourceCounter('takeout')), { kind: 'import', source: 'takeout' })
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

test('storage writes only aggregates, sets retention, and survives outages', async () => {
  const { spawnSync } = await import('node:child_process')
  // server-only modules use React's server export condition in this isolated process.
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { countUsage, readUsage, usageConfigured } from './lib/server/usage.ts';
    const commands = [];
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://test.invalid');
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      assert.equal(options.cache, 'no-store');
      const command = JSON.parse(options.body);
      commands.push(command);
      return { ok: true, json: async () => ({ result: command[0] === 'HGETALL' ? ['{"kind":"import","source":"takeout"}', '4'] : 1 }) };
    };
    assert.equal(usageConfigured(), true);
    const counter = '{"kind":"import","source":"takeout"}';
    await countUsage([counter]);
    const command = commands[0];
    assert.equal(command[0], 'EVAL');
    assert.equal(command[2], 1);
    assert.match(command[3], /^wsis:usage:v1:20\\d{2}-\\d{2}$/);
    const month = new Date(command[3].slice(-7) + '-01T00:00:00Z');
    const expiry = Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1) / 1000 + 90 * 86400;
    assert.equal(command[4], expiry);
    assert.deepEqual(command.slice(5), [counter]);
    assert.deepEqual(await readUsage('2026-10'), [{ kind: 'import', source: 'takeout', count: 4 }]);
    await assert.rejects(() => readUsage('*'));
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
    env: { ...process.env, NEXT_PUBLIC_USAGE_STATS: '1', USAGE_REDIS_REST_URL: 'https://test.invalid', USAGE_REDIS_REST_TOKEN: 'test-token' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
})
