import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('the facts job passes Vercel protection without replacing its GitHub identity', () => {
  for (const bypass of ['', 'synthetic-automation-key']) {
    const preload = `
      import assert from 'node:assert/strict';
      globalThis.fetch = async (url, init) => {
        if (String(url).startsWith('https://identity.example/')) {
          assert.equal(init.headers.Authorization, 'Bearer synthetic-request-token');
          assert.equal(init.headers['x-vercel-protection-bypass'], undefined);
          return Response.json({ value: 'synthetic-github-identity' });
        }
        assert.equal(String(url), 'https://site.example/api/facts/ingest');
        assert.equal(init.headers.Authorization, 'Bearer synthetic-github-identity');
        assert.equal(init.headers['x-vercel-protection-bypass'], ${JSON.stringify(bypass || undefined)});
        return Response.json({ ok: true, storage: true });
      };
    `
    const result = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, 'scrapers/programme-facts-store.ts', 'ping', '--country', 'CH'], {
      encoding: 'utf8', env: { ...process.env,
        ACTIONS_ID_TOKEN_REQUEST_URL: 'https://identity.example/?test=1', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'synthetic-request-token',
        WSIS_SITE_URL: 'https://site.example', WSIS_BASE_PATH: '', VERCEL_AUTOMATION_BYPASS_SECRET: bypass,
      },
    })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /store answers/)
  }
})
