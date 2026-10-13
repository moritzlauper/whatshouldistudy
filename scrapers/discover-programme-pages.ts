import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { programmeCountry } from '../lib/programme-countries.ts'
import { discoverPages, emptyPageIndex, type PageIndex, type PageRow } from './lib/programme-pages.ts'
import { writeJson } from './lib/common.ts'

/** Finds and verifies degree pages; stores URLs and heading evidence, never descriptions. */
async function main() {
  const arg = (name: string, fallback: string) => {
    const i = process.argv.indexOf(name)
    return i >= 0 ? process.argv[i + 1] ?? fallback : fallback
  }
  const country = programmeCountry(arg('--country', 'CH'))
  const folder = join(arg('--data', 'data-in'), 'programmes')
  const out = arg('--out', `scrapers/out/pages-${country}.json`)
  const maxPages = Number(arg('--max', '100'))
  const maxHosts = Number(arg('--max-hosts', '10'))
  if (![maxPages, maxHosts].every((n) => Number.isInteger(n) && n > 0)) throw new Error('Positive --max and --max-hosts required')
  const rows: PageRow[] = readdirSync(folder).filter((f) => f.endsWith('.json')).flatMap((f) => JSON.parse(readFileSync(join(folder, f), 'utf8')).programmes ?? [])
  const unique = [...new Map(rows.filter((p) => p.country === country).map((p) => [p.id, p])).values()]
  if (!unique.length) throw new Error(`No programme data for ${country}`)
  const index: PageIndex = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : emptyPageIndex()
  const stats = await discoverPages(unique, index, { maxHosts, maxPages, hosts: arg('--hosts', '').split(',').map((h) => h.trim()).filter(Boolean) })
  writeJson(out, index)
  console.log(`${country}: ${stats.found} verified pages found on ${stats.hosts} institutions; ${Object.keys(index.pages).length} saved`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
