import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('free preview excludes the best programme even when it belongs to a lower field', () => {
  const env = { ...process.env }
  for (const key of ['WSIS_DATA_URL', 'VERCEL_GIT_REPO_OWNER', 'VERCEL_GIT_REPO_SLUG']) delete env[key]
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { rank, teaser } from './lib/server/rank.ts';
    const prefs = { level: 'any', countries: [], maxTuitionEur: 0, origin: 'ch', englishOnly: false };
    for (const score of [99, 1]) {
      const fields = [{ id: 'psychology', score }, { id: 'computer-science', score: 98 }, { id: 'mechanical-engineering', score: 97 }];
      const req = { fields, prefs };
      const paid = await rank({ ...req, pageSize: 1 });
      assert.ok(paid.items[0]);
      if (score === 1) assert.notEqual(paid.items[0].matchedField, fields[0].id);
      const free = await teaser(req);
      assert.ok(free.samples.length > 0);
      assert.ok(free.samples.every(p => p.id !== paid.items[0].id && !p.fields.includes(fields[0].id)));
      assert.ok(free.samples.every(p => !p.fields.includes(paid.items[0].matchedField)));
      assert.equal(free.facets.fields[fields[0].id], undefined);
      assert.ok(free.coverage.fields.every(f => f.id !== fields[0].id));
    }
    const single = await teaser({ fields: [{ id: 'psychology', score: 99 }], prefs });
    assert.deepEqual(single.samples, []);
  `], { cwd: process.cwd(), env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
