import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('daily usage API preserves admin protection, validates dates and retains monthly compatibility', () => {
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    import { pathToFileURL } from 'node:url';
    const root = pathToFileURL(process.cwd() + '/');
    registerHooks({ resolve(specifier, context, next) {
      if (specifier.startsWith('@/')) return next(new URL(specifier.slice(2), root).href, context);
      return next(specifier === 'next/server' ? 'next/server.js' : specifier, context);
    } });
    const { GET } = await import('./app/api/usage/route.ts');
    const commands = [];
    globalThis.fetch = async (url, options) => {
      const command = JSON.parse(options.body);
      commands.push(command);
      return Response.json({ result: command[0] === 'GET' ? '2026-10-20' : ['{"kind":"event","event":"result"}', '7'] });
    };
    const request = (query, authorized = true) => new Request('https://example.invalid/api/usage?' + query, {
      headers: authorized ? { authorization: 'Bearer test-admin' } : {},
    });
    assert.equal((await GET(request('day=2026-10-20', false))).status, 401);
    for (const query of ['day=2026-02-30', 'day=', 'day=2026-10-20&month=2026-10', 'month=2026-13']) {
      assert.equal((await GET(request(query))).status, 400, query);
    }
    assert.equal(commands.length, 0);
    const daily = await GET(request('day=2026-10-20'));
    assert.equal(daily.status, 200);
    assert.equal(daily.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await daily.json(), { day: '2026-10-20', timezone: 'Europe/Zurich', collectingSince: '2026-10-20', rows: [{ kind: 'event', event: 'result', count: 7 }] });
    assert.ok(commands.some(c => c[1] === 'wsis:usage:day:zurich:v1:2026-10-20'));
    const monthly = await GET(request('month=2026-10'));
    assert.deepEqual(await monthly.json(), { month: '2026-10', rows: [{ kind: 'event', event: 'result', count: 7 }] });
    assert.deepEqual(commands.at(-1), ['HGETALL', 'wsis:usage:v1:2026-10']);
    globalThis.fetch = async () => { throw new Error('private connection info'); };
    const failed = await GET(request('day=2026-10-20'));
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /private connection/);
  `], {
    encoding: 'utf8',
    env: { ...process.env, NEXT_PUBLIC_USAGE_STATS: '1', USAGE_ADMIN_TOKEN: 'test-admin', USAGE_KV_REST_API_URL: '', USAGE_KV_REST_API_TOKEN: '', USAGE_REDIS_REST_URL: 'https://test.invalid', USAGE_REDIS_REST_TOKEN: 'test-token' },
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
