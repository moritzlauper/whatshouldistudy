import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

function report(status: number, challenge: boolean, bypass: string) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    process.argv[2] = '2026-10';
    globalThis.fetch = async (url, options) => {
      assert.equal(url.toString(), 'https://report.invalid/api/usage?month=2026-10');
      assert.equal(options.headers.Authorization, 'Bearer admin-test-secret');
      assert.equal(options.headers['x-vercel-protection-bypass'], ${JSON.stringify(bypass || undefined)});
      assert.equal(options.redirect, 'error');
      return new Response(JSON.stringify({ rows: [{ kind: 'event', event: 'result', count: 12 }] }), {
        status: ${status}, headers: ${JSON.stringify(challenge ? { 'x-vercel-mitigated': 'challenge' } : {})}
      });
    };
    await import('./scripts/usage-report.ts');
  `], {
    cwd: process.cwd(), encoding: 'utf8',
    env: { ...process.env, USAGE_REPORT_URL: 'https://report.invalid', USAGE_ADMIN_TOKEN: 'admin-test-secret', VERCEL_AUTOMATION_BYPASS_SECRET: bypass },
  })
}

test('report supports authenticated automation and sites without Vercel protection', () => {
  for (const bypass of ['', 'automation-test-secret']) {
    const result = report(200, false, bypass)
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage totals: 2026-10/)
    assert.match(result.stdout, /result/)
    assert.doesNotMatch(result.stdout + result.stderr, /admin-test-secret|automation-test-secret/)
  }
})

test('report distinguishes a Vercel challenge from an ordinary HTTP 429', () => {
  const challenge = report(429, true, '')
  assert.equal(challenge.status, 1)
  assert.match(challenge.stderr, /Vercel bot protection/)
  assert.match(challenge.stderr, /VERCEL_AUTOMATION_BYPASS_SECRET/)
  const rateLimit = report(429, false, '')
  assert.equal(rateLimit.status, 1)
  assert.match(rateLimit.stderr, /Report failed \(HTTP 429\)/)
  assert.doesNotMatch(rateLimit.stderr, /bot protection/)
})

test('automation access still reports an invalid admin credential as unauthorized', () => {
  const result = report(401, false, 'automation-test-secret')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Report failed \(HTTP 401\)/)
  assert.doesNotMatch(result.stdout + result.stderr, /admin-test-secret|automation-test-secret/)
})
