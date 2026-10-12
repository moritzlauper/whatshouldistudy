import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('personal comparisons require a click per list and ignore changed filters and late replies', () => {
  const result = spawnSync(process.execPath, ['test/helpers/personal-comparison.mjs'], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
