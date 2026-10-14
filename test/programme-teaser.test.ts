import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('free preview exposes no programme records, including when the best belongs to a lower field', () => {
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
      assert.deepEqual(free.samples, []);
      assert.ok(free.total > 0);
      assert.ok(!JSON.stringify(free).includes(paid.items[0].id));
      assert.equal(free.facets.fields[fields[0].id], undefined);
      assert.ok(free.coverage.fields.every(f => f.id !== fields[0].id));
    }
    const single = await teaser({ fields: [{ id: 'psychology', score: 99 }], prefs });
    assert.deepEqual(single.samples, []);
  `], { cwd: process.cwd(), env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

test('institution type limits ranked and preview programmes without exposing the paid top result', () => {
  const env = { ...process.env }
  for (const key of ['WSIS_DATA_URL', 'VERCEL_GIT_REPO_OWNER', 'VERCEL_GIT_REPO_SLUG']) delete env[key]
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { rank, sanitizeRequest, teaser } from './lib/server/rank.ts';
    const fields = ['psychology', 'computer-science', 'mechanical-engineering', 'education', 'nursing', 'business-management', 'architecture', 'medicine'].map(id => ({ id, score: 90 }));
    const prefs = { level: 'any', countries: ['CH'], maxTuitionEur: 0, origin: 'ch', englishOnly: false };
    const all = await rank({ fields, prefs, pageSize: 2000 });
    assert.ok(all.total > 0);
    for (const institutionType of ['uni', 'eth', 'fh', 'ph']) {
      const req = sanitizeRequest({ fields, prefs: { ...prefs, institutionType } });
      assert.equal(req?.prefs.institutionType, institutionType);
      const paid = await rank({ ...req, pageSize: 2000 });
      assert.ok(paid.total > 0 && paid.total < all.total, institutionType);
      assert.ok(paid.items.every(p => p.institutionType === institutionType));
      const free = await teaser(req);
      assert.deepEqual(free.samples, []);
      assert.ok(free.total <= paid.total);
    }
    assert.equal(sanitizeRequest({ fields, prefs: { ...prefs, institutionType: 'made-up' } })?.prefs.institutionType, undefined);
  `], { cwd: process.cwd(), env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
