/**
 * The facts database. Claude reads the official page of every programme we have
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
import Anthropic from '@anthropic-ai/sdk'
import { pageText, robotsAllow, sameSite } from '../lib/official-facts.ts'
import { officialPageOf } from '../lib/official-pages.ts'
import { FACTS_SCHEMA, FACTS_SYSTEM, batches, costMicroUsd, hashText, isUnchanged, mergeFacts, normaliseFact, type PageMember, type StoredFact } from './lib/facts.ts'
import { log, sleep } from './lib/common.ts'

interface Row {
  id: string
  name: string
  institution: string
  institutionUrl?: string
  city?: string
  level: string
  country: string
  url?: string
  focus?: string[]
  languages?: string[]
}

const UA = 'Mozilla/5.0 (compatible; wasstudieren-bot/1.0; +https://wasstudieren.ch)'
const PAUSE = 1500
const MAX_CHARS = 7000
const MIN_CHARS = 200
const MODEL = 'claude-haiku-5-5'

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

const isHomepage = (url: string): boolean => {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === ''
  } catch {
    return true
  }
}

let lastRequest = 0

/** One request at a time, PAUSE milliseconds apart, as robots.txt and the other scrapers expect. */
async function get(url: string): Promise<{ status: number; text: string }> {
  const wait = lastRequest + PAUSE - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequest = Date.now()
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'de-CH,de;q=0.9,fr;q=0.8,it;q=0.7,en;q=0.6' },
      signal: AbortSignal.timeout(15_000),
    })
    return { status: res.status, text: res.ok ? await res.text() : '' }
  } catch (e) {
    log(`request failed: ${url} (${(e as Error).message})`)
    return { status: 0, text: '' }
  }
}

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
  const country = arg('--country', 'CH')
  const limit = Number(arg('--limit', '0')) || Infinity
  const maxUsd = Number(arg('--max-usd', '3'))
  // Read every page again, also those whose text did not change (after a change to the prompt).
  const reread = process.argv.includes('--reread')
  if (!dataDir || !outFile) throw new Error('usage: --data <dir> --out <file> [--previous <file>] [--country CH] [--limit N] [--max-usd 3]')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')

  const previous: Record<string, StoredFact> = previousFile && existsSync(previousFile)
    ? (JSON.parse(readFileSync(previousFile, 'utf8')) as { programmes?: Record<string, StoredFact> }).programmes ?? {}
    : {}
  const rows = loadRows(dataDir).filter((r) => r.country === country)

  // A programme gets its own page: the checked one, else the feed's link. A homepage describes no programme.
  const candidates = rows
    .flatMap((r) => {
      const url = officialPageOf(r) ?? r.url
      if (!url || isHomepage(url)) return []
      if (r.institutionUrl && !sameSite(url, r.institutionUrl)) return []
      return [{ r, url }]
    })
    .sort((a, b) => (a.r.id < b.r.id ? -1 : a.r.id > b.r.id ? 1 : 0))
    .slice(0, limit)
  log(`${country}: ${candidates.length} programmes with a page of their own, of ${rows.length} in the data`)

  const byUrl = new Map<string, typeof candidates>()
  for (const c of candidates) byUrl.set(c.url, [...(byUrl.get(c.url) ?? []), c])

  const robots = new Map<string, string>()
  const toRead: Array<{ r: Row; text: string; page: PageMember }> = []
  const stats = { pages: 0, unchanged: 0, unreadable: 0, refused: 0, calls: 0, fresh: 0, spendMicro: 0 }

  for (const [url, members] of byUrl) {
    const origin = new URL(url).origin
    if (!robots.has(origin)) {
      const res = await get(`${origin}/robots.txt`)
      robots.set(origin, res.status === 200 ? res.text : '')
    }
    if (!robotsAllow(robots.get(origin) ?? '', url)) {
      stats.refused += members.length
      log(`robots.txt does not allow ${url}`)
      continue
    }
    const res = await get(url)
    stats.pages++
    const text = res.status === 200 ? pageText(res.text).slice(0, MAX_CHARS) : ''
    if (text.length < MIN_CHARS) {
      stats.unreadable += members.length
      log(`no readable text at ${url} (HTTP ${res.status || 'error'}, ${text.length} characters)`)
      continue
    }
    const hash = hashText(text)
    for (const { r } of members) {
      if (!reread && isUnchanged(previous[r.id], url, hash)) stats.unchanged++
      else toRead.push({ r, text, page: { url, hash } })
    }
  }

  const client = new Anthropic()
  const fresh: StoredFact[] = []
  const at = new Date().toISOString().slice(0, 10)
  for (const group of batches(toRead, 5)) {
    if (stats.spendMicro >= maxUsd * 1_000_000) {
      log(`spending cap of $${maxUsd} reached; the rest is read in the next run`)
      break
    }
    const sent = new Map(group.map((x) => [x.r.id, x.page]))
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: FACTS_SCHEMA } },
        system: FACTS_SYSTEM,
        messages: [{ role: 'user', content: `Programmes:\n${group.map((x) => block(x.r, x.text)).join('\n\n')}` }],
      })
      stats.calls++
      stats.spendMicro += costMicroUsd(response.usage)
      if (response.stop_reason !== 'end_turn') throw new Error(`stopped: ${response.stop_reason}`)
      const out = JSON.parse(response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')) as { programmes?: unknown[] }
      for (const raw of out.programmes ?? []) {
        const f = normaliseFact(raw, sent, at)
        if (f) {
          fresh.push(f)
          stats.fresh++
        }
      }
    } catch (e) {
      log(`model call failed for ${group.length} programmes: ${(e as Error).message}`)
    }
  }

  // Readings of programmes that left the data go; the others keep theirs when this run did not read them.
  const known = new Set(rows.map((r) => r.id))
  const merged = Object.fromEntries(Object.entries(mergeFacts(previous, fresh)).filter(([id]) => known.has(id)))
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, `${JSON.stringify({ updated: new Date().toISOString(), country, programmes: merged }, null, 1)}\n`)
  log(
    `done: ${Object.keys(merged).length} readings kept; ${stats.fresh} new, ${stats.unchanged} pages unchanged, ` +
      `${stats.unreadable} unreadable, ${stats.refused} refused by robots.txt; ${stats.calls} model calls, about $${(stats.spendMicro / 1e6).toFixed(3)}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
