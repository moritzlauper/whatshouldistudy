import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('career suggestions render readable reasons and a free route back to the same profile', () => {
  const result = spawnSync(process.execPath, ['test/helpers/work-view.mjs'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
