import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DataCache } from '../lib/server/data-cache.ts'

test('data cache evicts least recently used files within its byte budget', () => {
  const cache = new DataCache<string>(10, 60_000)
  cache.set('a', 'a', 4)
  cache.set('b', 'b', 4)
  assert.equal(cache.get('a'), 'a')
  cache.set('c', 'c', 4)
  assert.equal(cache.get('b'), undefined)
  assert.equal(cache.get('a'), 'a')
  assert.equal(cache.get('c'), 'c')
  cache.set('a', 'replacement', 7)
  assert.equal(cache.get('c'), undefined)
  assert.equal(cache.get('a'), 'replacement')
  cache.set('huge', 'huge', 11)
  assert.equal(cache.get('huge'), undefined)
  assert.equal(cache.get('a'), 'replacement')
})

test('data cache expires files and bounds zero-byte missing results', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 })
  const cache = new DataCache<string>(10, 100, 2)
  cache.set('a', 'a', 0)
  cache.set('b', 'b', 0)
  cache.set('c', 'c', 0)
  assert.equal(cache.get('a'), undefined)
  t.mock.timers.tick(100)
  assert.equal(cache.get('b'), undefined)
  cache.set('d', 'd', 10)
  assert.equal(cache.get('c'), undefined)
  assert.equal(cache.get('d'), 'd')
})

test('concurrent programme requests download and parse a large shard once', async () => {
  const { spawn } = await import('node:child_process')
  const env = { ...process.env }
  for (const key of ['WSIS_DATA_URL', 'VERCEL_GIT_REPO_OWNER', 'VERCEL_GIT_REPO_SLUG']) delete env[key]
  const child = spawn(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createServer } from 'node:http';
    import { getShard } from './lib/server/data.ts';
    let calls = 0;
    let broken = false;
    const body = JSON.stringify({ field: 'computer-science', updated: '2026-10-18', count: 1,
      programmes: [{ id: 'fixture', description: 'x'.repeat(3 * 1024 * 1024) }] });
    const server = createServer((req, res) => {
      calls++;
      res.end(broken ? '{invalid' : body);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    process.env.WSIS_DATA_URL = 'http://127.0.0.1:' + server.address().port;
    try {
      const shards = await Promise.all(Array.from({length: 20}, () => getShard('computer-science')));
      assert.equal(calls, 1);
      for (const shard of shards) assert.equal(shard, shards[0]);
      assert.equal(await getShard('computer-science'), shards[0]);
      assert.equal(calls, 1);
      broken = true;
      await assert.rejects(getShard('mathematics'), /unreachable/);
      broken = false;
      assert.equal((await getShard('mathematics')).count, 1);
      assert.equal(calls, 5);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  `], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve) })
  assert.equal(code, 0, stderr)
})
