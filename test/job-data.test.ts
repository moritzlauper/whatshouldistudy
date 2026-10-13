import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// Exercise the real loader without a network service or secrets. Native HTTP is
// the boundary because the feed is now larger than Next's fetch cache permits.
const state = { calls: 0, status: 200, body: '' }
;(globalThis as unknown as Record<string, unknown>).__jobLoaderFixture = state
const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true }
    if (specifier === 'node:https') return { url: `data:text/javascript,${encodeURIComponent(`
      import { EventEmitter } from 'node:events';
      export function get(url, callback) {
        const state = globalThis.__jobLoaderFixture;
        state.calls++;
        const request = new EventEmitter();
        request.setTimeout = () => request;
        request.destroy = (error) => request.emit('error', error);
        queueMicrotask(() => {
          const response = new EventEmitter();
          response.statusCode = state.status;
          response.resume = () => {};
          callback(response);
          const buffer = Buffer.from(state.body);
          for (let i = 0; i < buffer.length; i += 65536) response.emit('data', buffer.subarray(i, i + 65536));
          response.emit('end');
        });
        return request;
      }
    `)}`, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
const { getJobs } = await import('../lib/server/jobs.ts')

test('large job datasets load and share an hourly cache without the old 2 MB or 5000-job cutoff', async () => {
  const previousUrl = process.env.WSIS_JOBS_URL
  const checkedAt = new Date().toISOString()
  const jobs = Array.from({ length: 5100 }, (_, i) => ({
    id: `Swissquote:${i}`, sourceId: 'Swissquote', title: `Software Engineer ${'x'.repeat(150)}`,
    company: 'Example Bank', city: 'Zürich', country: 'CH', url: `https://jobs.smartrecruiters.com/Swissquote/${i}-software`,
    workplace: 'unknown', entry: 'unknown', checkedAt, occupationIds: ['software'],
  }))
  state.body = JSON.stringify({ version: 1, generatedAt: checkedAt, jobs, sources: [] })
  assert.ok(Buffer.byteLength(state.body) > 2 * 1024 * 1024)
  process.env.WSIS_JOBS_URL = 'https://job-data.example/jobs.json'
  try {
    const [first, simultaneous] = await Promise.all([getJobs(), getJobs()])
    assert.equal(first.unavailable, false)
    assert.equal(first.data.jobs.length, 5100)
    assert.equal(simultaneous.data.jobs.length, 5100)
    assert.equal((await getJobs()).data.jobs.length, 5100)
    assert.equal(state.calls, 1)
  } finally {
    if (previousUrl === undefined) delete process.env.WSIS_JOBS_URL
    else process.env.WSIS_JOBS_URL = previousUrl
    hook.deregister()
    delete (globalThis as unknown as Record<string, unknown>).__jobLoaderFixture
  }
})
