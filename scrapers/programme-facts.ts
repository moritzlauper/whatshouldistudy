/**
 * The facts database. the AI reads the official page of every programme we have
 * a link for and keeps what it said as facts: how strongly the programme involves
 * each interest type, which school subjects it needs, and what to check before
 * deciding. Page texts are not kept, only their hashes, so a page that has not
 * changed is not sent to the model again. Pages are read one at a time, one
 * request every 1.5 seconds, and only where robots.txt allows it, as the Swiss
 * university scraper does.
 *
 *   node scrapers/programme-facts.ts --data <dir> --previous <file> --out <file>
 *        [--country CH] [--limit 20] [--max-usd 3] [--reread]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { factsAiConfigured, completeFacts } from './lib/facts-ai.ts'
import { exactBatch } from '../lib/ai-batch.ts'
import { robotsAllow } from '../lib/official-facts.ts'
import { programmeCountry } from '../lib/programme-countries.ts'
import { isContinuing } from '../lib/programmes.ts'
import { emptyPageIndex, programmePage, type PageIndex } from './lib/programme-pages.ts'
import { programmePageText } from './lib/programme-page-text.ts'
import { FACTS_SCHEMA, FACTS_SYSTEM, batches, costMicroUsd, hashText, isUnchanged, mergeFacts, normaliseFact, type PageMember, type StoredFact } from './lib/facts.ts'
import { storedFactProblem } from '../lib/facts-store.ts'
import { translateStoredFacts } from './lib/facts-translations.ts'
import { log } from './lib/common.ts'
import { fetchSite } from './lib/site-fetch.ts'

interface Row {
  id: string
  name: string
  institution: string
  institutionUrl?: string
  city?: string
  level: string
  country: string
  url?: string
  source?: string
  focus?: string[]
  languages?: string[]
}

const MAX_CHARS = 7000
const MIN_CHARS = 200

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function loadRows(dir: string): Row[] {
  const folder = join(dir, 'programmes')
  if (!existsSync(folder)) throw new Error(`no programmes folder in ${dir}`)
  const rows = readdirSync(folder)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => (JSON.parse(readFileSync(join(folder, f), 'utf8')) as { programmes?: Row[] }).programmes ?? [])
  return [...new Map(rows.map((r) => [r.id, r])).values()]
}

const get = (url: string) => fetchSite(url, 15_000)

function block(r: Row, text: string): string {
  return [
    `<programme id="${r.id}">`,
    `Name: ${r.name}`,
    `Institution: ${r.institution}${r.city ? `, ${r.city}` : ''}`,
    `Level: ${r.level}`,
    r.focus?.length ? `Listed focus areas: ${r.focus.join('; ')}` : '',
    r.languages?.length ? `Languages: ${r.languages.join(', ')}` : '',
    `Official page text:\n${text}`,
    '</programme>',
  ]
    .filter(Boolean)
    .join('\n')
}

async function main() {
  const dataDir = arg('--data', '')
  const outFile = arg('--out', '')
  const previousFile = arg('--previous', '')
  const country = programmeCountry(arg('--country', 'CH'))
  const pagesFile = arg('--pages', '')
  const index: PageIndex = pagesFile && existsSync(pagesFile) ? JSON.parse(readFileSync(pagesFile, 'utf8')) : emptyPageIndex()
  const requestedLimit = Number(arg('--limit', '0'))
  if (!Number.isInteger(requestedLimit) || requestedLimit < 0) throw new Error('Invalid --limit')
  const limit = requestedLimit || Infinity
  const maxUsd = Number(arg('--max-usd', '3'))
  if (!Number.isFinite(maxUsd) || maxUsd <= 0) throw new Error('Invalid --max-usd')
  // Read every page again, also those whose text did not change (after a change to the prompt).
  const reread = process.argv.includes('--reread')
  const translateOnly = process.argv.includes('--translate-only')
  if (!outFile || (translateOnly ? !previousFile : !dataDir)) throw new Error('usage: --data <dir> --out <file> [--previous <file>] [--country CH] [--limit N] [--max-usd 3]; or --translate-only --previous <file> --out <file>')
  if (!factsAiConfigured()) throw new Error('ANTHROPIC_API_KEY is required')

  const previous: Record<string, StoredFact> = previousFile && existsSync(previousFile)
    ? (JSON.parse(readFileSync(previousFile, 'utf8')) as { programmes?: Record<string, StoredFact> }).programmes ?? {}
    : {}
  if (translateOnly) {
    const source = JSON.parse(readFileSync(previousFile, 'utf8')) as { country?: string }
    if (source.country && source.country !== country) throw new Error('Previous readings belong to another country')
    const result = await translateStoredFacts(previous, maxUsd, limit, undefined, ({ translated, failed, remaining }) => {
      if ((translated + failed) % 25 === 0 || remaining === 0) log(`${country}: ${translated} translated, ${failed} failed, ${remaining} remaining`)
    })
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, `${JSON.stringify({ updated: new Date().toISOString(), country, programmes: result.programmes })}\n`)
    log(`${country}: ${result.translated} translated, ${result.failed} failed, ${result.remaining} remaining; about $${(result.spendMicro / 1e6).toFixed(3)}`)
    return
  }
  // Continuing education is not read: the readings cost money and serve the degree ranking.
  const rows = loadRows(dataDir).filter((r) => r.country === country && !isContinuing(r.level))
  if (!rows.length) throw new Error(`No programme data for ${country}; keeping previous readings`)

  // A programme gets its own page: the checked one, else the feed's link. A homepage describes no programme.
  const candidates = rows
    .flatMap((r) => {
      const url = programmePage(r, index)
      if (!url) return []
      return [{ r, url }]
    })
    .sort((a, b) => (index.attempts[a.r.id] ?? '').localeCompare(index.attempts[b.r.id] ?? '') || (previous[a.r.id]?.at ?? '').localeCompare(previous[b.r.id]?.at ?? '') || a.r.id.localeCompare(b.r.id))
    .slice(0, limit)
  log(`${country}: ${candidates.length} programmes with a page of their own, of ${rows.length} in the data`)

  const byUrl = new Map<string, typeof candidates>()
  for (const c of candidates) byUrl.set(c.url, [...(byUrl.get(c.url) ?? []), c])

  const robots = new Map<string, string>()
  const toRead: Array<{ r: Row; text: string; page: PageMember }> = []
  const stats = { pages: 0, unchanged: 0, unreadable: 0, refused: 0, calls: 0, fresh: 0, spendMicro: 0 }

  for (const [url, members] of byUrl) {
    for (const { r } of members) index.attempts[r.id] = new Date().toISOString()
    const origin = new URL(url).origin
    if (!robots.has(origin)) {
      const res = await get(`${origin}/robots.txt`)
      robots.set(origin, res.status === 200 ? res.text : res.status === 404 ? '' : 'User-agent: *\nDisallow: /')
    }
    if (!robotsAllow(robots.get(origin) ?? '', url)) {
      stats.refused += members.length
      log(`robots.txt does not allow ${url}`)
      continue
    }
    const discovered = members.find(({ r }) => index.pages[r.id]?.url === url)?.r
    const res = await programmePageText(url, get, discovered)
    stats.pages++
    const text = res.status === 200 ? res.text.slice(0, MAX_CHARS) : ''
    if (text.length < MIN_CHARS) {
      stats.unreadable += members.length
      log(`no readable text at ${url} (HTTP ${res.status || 'error'}, ${text.length} characters)`)
      continue
    }
    const hash = hashText(text)
    for (const { r } of members) {
      if (!reread && isUnchanged(previous[r.id], url, hash)) stats.unchanged++
      else toRead.push({ r, text, page: { url, hash, text } })
    }
  }

  const fresh: StoredFact[] = []
  const at = new Date().toISOString().slice(0, 10)
  for (const group of batches(toRead, 3)) {
    if (stats.spendMicro >= maxUsd * 1_000_000) {
      log(`spending cap of $${maxUsd} reached; the rest is read in the next run`)
      break
    }
    const sent = new Map(group.map((x) => [x.r.id, x.page]))
    const input = `Programmes:\n${group.map((x) => block(x.r, x.text)).join('\n\n')}`
    // Reserve a conservative upper bound before each attempt, including retries.
    const reserveMicro = (FACTS_SYSTEM.length + input.length) * 2 + 16000 * 5
    for (let attempt = 0; attempt < 2; attempt++) {
      if (stats.spendMicro + reserveMicro > maxUsd * 1_000_000) break
      // Keep the reservation on timeouts: the provider may still have billed a call.
      stats.spendMicro += reserveMicro
      stats.calls++
      try {
        const response = await completeFacts({
          maxTokens: 16000, schema: FACTS_SCHEMA, timeoutMs: 120_000,
          system: FACTS_SYSTEM,
          input,
        })
        stats.spendMicro += costMicroUsd(response.usage) - reserveMicro
        if (!response.complete) throw new Error('Incomplete facts')
        const out = JSON.parse(response.text) as { programmes?: unknown[] }
        const read = exactBatch(out.programmes, new Set(sent.keys())).map((raw) => normaliseFact(raw, sent, at))
        if (read.some((f) => !f)) throw new Error('Invalid fact in batch')
        fresh.push(...read as StoredFact[])
        stats.fresh += read.length
        break
      } catch {
        log(`model call failed for ${group.length} programmes, attempt ${attempt + 1}`)
      }
    }
  }

  // A reading the store would refuse is not kept: its programme keeps the reading it had, and the log names the field.
  const storable = fresh.filter((f) => {
    const problem = storedFactProblem(f)
    if (problem) log(`reading of ${f.id} not stored: ${problem}`)
    return !problem
  })
  // Readings of programmes that left the data go; the others keep theirs when this run did not read them.
  const known = new Set(rows.map((r) => r.id))
  const merged = Object.fromEntries(Object.entries(mergeFacts(previous, storable)).filter(([id]) => known.has(id)))
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, `${JSON.stringify({ updated: new Date().toISOString(), country, programmes: merged }, null, 1)}\n`)
  if (pagesFile) {
    mkdirSync(dirname(pagesFile), { recursive: true })
    writeFileSync(pagesFile, JSON.stringify(index))
  }
  log(
    `done: ${Object.keys(merged).length} readings kept; ${stats.fresh} new, ${stats.unchanged} pages unchanged, ` +
      `${stats.unreadable} unreadable, ${stats.refused} refused by robots.txt; ${stats.calls} model calls, about $${(stats.spendMicro / 1e6).toFixed(3)}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
