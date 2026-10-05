/**
 * Runs every scraper in turn (a failure is logged, not fatal) and then the
 * build. The GitHub Action runs the same steps individually; this is for
 * local runs: `pnpm data:all`.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { ROOT, log } from './lib/common.ts'

const scrapers = ['us-scorecard', 'fr-parcoursup', 'uk-discoveruni', 'global-openalex', 'global-directory']
const failed: string[] = []
for (const s of scrapers) {
  log(`▶ ${s}`)
  const r = spawnSync(process.execPath, [join(ROOT, 'scrapers', `${s}.ts`)], { stdio: 'inherit' })
  if (r.status !== 0) failed.push(s)
}
const extra = process.argv.slice(2)
const b = spawnSync(process.execPath, [join(ROOT, 'scrapers', 'build.ts'), ...extra], { stdio: 'inherit' })
if (failed.length) log(`Failed: ${failed.join(', ')}`)
process.exit(b.status ?? 1)
