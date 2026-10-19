import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

test('readback detects lost translations without printing private reading text', () => {
  const folder = mkdtempSync(join(tmpdir(), 'facts-verify-'))
  const file = join(folder, 'facts.json')
  const fact = {
    id: 'p', version: 5, url: 'https://example.org/p', hash: 'a'.repeat(64), at: '2026-10-19',
    riasec: [0, 0, 0, 0, 0, 0], subjects: [], topics: [], specialisations: [], enough: true,
    distinctive: ['Private source sentence.'], checks: { de: '', fr: '', it: '', en: '' },
    distinctiveTranslations: { de: ['Privater Satz.'], fr: ['Phrase privée.'], it: ['Frase privata.'], en: ['Private sentence.'] },
  }
  writeFileSync(file, JSON.stringify({ country: 'CH', programmes: { p: fact } }))
  try {
    for (const loseTranslations of [false, true]) {
      const stored = { ...fact, ...(loseTranslations ? { distinctiveTranslations: undefined } : {}) }
      const preload = `globalThis.fetch = async (url) => Response.json(String(url).startsWith('https://identity.example/')
        ? { value: 'synthetic-identity' } : { programmes: { p: ${JSON.stringify(stored)} } });`
      const result = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, 'scrapers/programme-facts-store.ts', 'verify', '--country', 'CH', '--in', file], {
        encoding: 'utf8', env: { ...process.env, ACTIONS_ID_TOKEN_REQUEST_URL: 'https://identity.example/?test=1',
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'synthetic-token', WSIS_SITE_URL: 'https://site.example',
        },
      })
      assert.equal(result.status, loseTranslations ? 1 : 0, result.stderr)
      if (!loseTranslations) assert.match(result.stdout, /verified 1 readings; 1\/1 with all four translations/)
      assert.doesNotMatch(result.stdout + result.stderr, /Private source sentence|Frase privata/)
    }
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})
