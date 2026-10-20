import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { ATTRIBUTION_MS, assignmentActive, validParticipant, validVariant } from '../lib/paywall-experiment.ts'

test('experiment ids and fourteen-day attribution are strictly bounded', () => {
  assert.ok(validParticipant('de305d54-75b4-431b-adb2-eb6b9e546014'))
  for (const id of [null, '', '*', '../paid', 'de305d54-75b4-131b-adb2-eb6b9e546014']) assert.equal(validParticipant(id), false)
  assert.ok(validVariant('late'))
  assert.equal(validVariant('free'), false)
  assert.equal(ATTRIBUTION_MS, 14 * 86400_000)
  assert.ok(assignmentActive(100, 100 + ATTRIBUTION_MS - 1))
  assert.equal(assignmentActive(100, 100 + ATTRIBUTION_MS), false)
  assert.equal(assignmentActive(101, 100), false)
})

// Runs the actual atomic Lua scripts against an isolated, disposable local Redis.
// REDIS_TEST_CLI=/path/to/redis-cli REDIS_TEST_PORT=16379 node --test test/paywall-experiment.test.ts
test('real Redis: stable 50/50 assignment, unique payments, withdrawal, admin API and automatic day-14 winner', {
  skip: !process.env.REDIS_TEST_CLI || !process.env.REDIS_TEST_PORT,
}, () => {
  const result = spawnSync(process.execPath, ['--conditions=react-server', 'test/helpers/paywall-experiment.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, NEXT_PUBLIC_USAGE_STATS: '1', USAGE_ADMIN_TOKEN: 'test-admin',
      USAGE_KV_REST_API_URL: '', USAGE_KV_REST_API_TOKEN: '',
      USAGE_REDIS_REST_URL: 'https://test.invalid', USAGE_REDIS_REST_TOKEN: 'test-only' },
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
