import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

test('personal AI requests require explicit consent and exclude personality answers', () => {
  const result = spawnSync(process.execPath, ['test/helpers/personal-consent.mjs'], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

test('personal comparisons require a click per list and ignore changed filters and late replies', () => {
  const result = spawnSync(process.execPath, ['test/helpers/personal-comparison.mjs'], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})


test('personal comparisons explain 1–20 programmes with missing or thin readings and preserve the paywall', () => {
  const result = spawnSync(process.execPath, ['--conditions=react-server', 'test/helpers/personal-fit-server.mjs'], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
