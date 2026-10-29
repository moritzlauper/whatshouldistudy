import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

function report(status: number, challenge: boolean, bypass: string, period = '2026-10', collectingSince: string | null = '2026-10-20', oldServer = false, rows: object[] = [{ kind: 'event', event: 'result', count: 12 }], extraArgs: string[] = []) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    const RealDate = Date;
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : ['2026-10-21T10:00:00Z'])); }
      static now() { return RealDate.parse('2026-10-21T10:00:00Z'); }
    };
    process.argv.length = 2;
    process.argv.push(${JSON.stringify(period)}, ...${JSON.stringify(extraArgs)});
    globalThis.fetch = async (url, options) => {
      assert.equal(url.toString(), ${JSON.stringify(`https://report.invalid/api/usage?${period.length === 10 ? 'day' : 'month'}=${period}`)});
      assert.equal(options.headers.Authorization, 'Bearer admin-test-secret');
      assert.equal(options.headers['x-vercel-protection-bypass'], ${JSON.stringify(bypass || undefined)});
      assert.equal(options.redirect, 'error');
      return new Response(JSON.stringify({ ...${JSON.stringify(oldServer ? {} : { day: period, timezone: 'Europe/Zurich', collectingSince })}, rows: ${JSON.stringify(rows)} }), {
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

test('daily reports use Swiss days and disclose incomplete initial history', () => {
  const first = report(200, false, '', '2026-10-20')
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, /Europe\/Zurich/)
  assert.match(first.stdout, /Partial day/)
  assert.match(first.stdout, /result/)
  const earlier = report(200, false, '', '2026-10-19')
  assert.equal(earlier.status, 0, earlier.stderr)
  assert.match(earlier.stdout, /No daily history/)
  assert.doesNotMatch(earlier.stdout, /Results shown/)
  const pending = report(200, false, '', '2026-10-20', null)
  assert.match(pending.stdout, /No daily counters recorded yet/)
})

test('daily reports refuse monthly responses from deployments without daily support', () => {
  const result = report(200, false, '', '2026-10-20', null, true)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /does not support daily reports yet/)
})

test('invalid dates are rejected before a request is sent', () => {
  const result = report(200, false, '', '2026-02-30')
  assert.equal(result.status, 1)
  assert.match(result.stderr, /YYYY-MM-DD/)
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

test('profile tables hide rare combinations below the threshold', () => {
  const rows = [
    { kind: 'profile', basis: 'questionnaire', code: 'SIA', rank: 1, field: 'psychology', count: 6 },
    { kind: 'profile', basis: 'questionnaire', code: 'SIA', rank: 1, field: 'rare-field', count: 2 },
    { kind: 'profile', basis: 'both', code: 'RIC', rank: 1, field: 'lonely-field', count: 1 },
  ]
  const result = report(200, false, '', '2026-10', null, true, rows)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Profile codes/)
  assert.match(result.stdout, /psychology/)
  assert.doesNotMatch(result.stdout, /rare-field|lonely-field|RIC/)
  assert.match(result.stdout, /2 rarer combinations hidden/)
  const all = report(200, false, '', '2026-10', null, true, rows, ['--min=1'])
  assert.match(all.stdout, /rare-field/)
  assert.match(all.stdout, /lonely-field/)
})
