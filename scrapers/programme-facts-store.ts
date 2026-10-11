/**
 * Moves the facts database between the private store and a file. `pull` writes
 * what is stored for a country to --out, the readings the reader starts from;
 * `push` replaces the stored readings with the --in file. Needs
 * FACTS_REDIS_REST_URL and FACTS_REDIS_REST_TOKEN.
 *
 *   node scrapers/programme-facts-store.ts pull --country CH --out <file>
 *   node scrapers/programme-facts-store.ts push --country CH --in <file>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { readFacts, storeConfig, writeFacts } from '../lib/facts-store.ts'
import { log } from './lib/common.ts'
import type { StoredFact } from './lib/facts.ts'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function main() {
  const [mode] = process.argv.slice(2)
  const country = arg('--country', 'CH')
  const cfg = storeConfig()
  if (!cfg) throw new Error('FACTS_REDIS_REST_URL and FACTS_REDIS_REST_TOKEN are not set')
  if (mode === 'pull') {
    const out = arg('--out', '')
    if (!out) throw new Error('usage: pull --country CH --out <file>')
    const programmes = await readFacts(cfg, country)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `${JSON.stringify({ country, programmes })}\n`)
    log(`${country}: ${Object.keys(programmes).length} readings stored`)
  } else if (mode === 'push') {
    const file = arg('--in', '')
    if (!file) throw new Error('usage: push --country CH --in <file>')
    const data = JSON.parse(readFileSync(file, 'utf8')) as { country?: string; programmes?: Record<string, StoredFact> }
    if (data.country && data.country !== country) throw new Error(`${file} holds ${data.country}, not ${country}`)
    const n = await writeFacts(cfg, country, data.programmes ?? {})
    log(`${country}: ${n} readings stored`)
  } else {
    throw new Error('usage: node scrapers/programme-facts-store.ts pull|push --country CH')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
