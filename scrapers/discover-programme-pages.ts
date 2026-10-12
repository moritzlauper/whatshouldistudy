import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { robotsAllow } from '../lib/official-facts.ts'
import { headingsOf, namesProgramme, NOT_A_PROGRAMME, sitemapLocs, STUDY_PATH } from '../lib/page-match.ts'

/**
 * Looks for the official page of programmes the data names without a link. For each
 * institution's domain the sitemap is read and its study pages are fetched: robots.txt
 * is respected, one request per domain at a time, PAUSE apart. A page is a candidate
 * when its title or first heading names the programme at its level. Nothing is stored:
 * the candidates are printed for a person to check before they are listed in
 * lib/official-pages.ts.
 */

const UA = 'Mozilla/5.0 (compatible; wasstudieren-bot/1.0; +https://wasstudieren.ch)'
const PAUSE = 1500
const MAX_CANDIDATES = 4
const HUB_LIMIT = 40

type Row = { id: string; name: string; level: string; country: string; institutionUrl?: string; url?: string }

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}

function loadRows(dir: string): Row[] {
  const rows: Row[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const j = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    for (const r of Array.isArray(j) ? j : j.programmes ?? []) rows.push(r)
  }
  return rows
}

const hostOf = (u: string) => new URL(u).hostname.replace(/^www\./, '')
const lastRequest = new Map<string, number>()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** One request to a domain at a time, PAUSE apart. A failed request counts as a missing page. */
async function fetchPaced(host: string, url: string): Promise<{ status: number; text: string }> {
  const wait = (lastRequest.get(host) ?? 0) + PAUSE - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequest.set(host, Date.now())
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'de-CH,de;q=0.9,fr;q=0.8,it;q=0.7,en;q=0.6' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    })
    return { status: res.status, text: res.status === 200 ? await res.text() : '' }
  } catch {
    return { status: 0, text: '' }
  }
}

/** The pages listed in the domain's sitemap; a sitemap index is followed, up to ten of its sitemaps. */
async function sitemapPages(host: string): Promise<string[]> {
  for (const root of [`https://${host}/sitemap.xml`, `https://www.${host}/sitemap.xml`, `https://${host}/sitemap_index.xml`]) {
    const r = await fetchPaced(host, root)
    if (r.status !== 200) continue
    const locs = sitemapLocs(r.text)
    const children = locs.filter((u) => /\.xml$/i.test(u))
    if (children.length && children.length === locs.length) {
      const pages: string[] = []
      for (const child of children.slice(0, 10)) {
        const s = await fetchPaced(host, child)
        if (s.status === 200) pages.push(...sitemapLocs(s.text))
      }
      return pages
    }
    return locs
  }
  return []
}

function isStudyPage(url: string, host: string): boolean {
  try {
    const path = decodeURIComponent(new URL(url).pathname)
    return hostOf(url) === host && STUDY_PATH.test(path) && !NOT_A_PROGRAMME.test(path)
  } catch {
    return false
  }
}

/** The study links on a page of the domain. */
async function studyLinks(host: string, url: string): Promise<string[]> {
  const r = await fetchPaced(host, url)
  if (r.status !== 200) return []
  const out = new Set<string>()
  for (const m of r.text.matchAll(/href="([^"#]+)"/gi)) {
    try {
      const abs = new URL(m[1], url).toString()
      if (isStudyPage(abs, host)) out.add(abs)
    } catch {
      // a link that is not an address is skipped
    }
  }
  return [...out]
}

/** The study pages of a domain: from its sitemap, or, where there is none, from the study links of the home page and of the pages it links to. */
async function studyPages(host: string, max: number): Promise<string[]> {
  const fromSitemap = (await sitemapPages(host)).filter((u) => isStudyPage(u, host))
  if (fromSitemap.length) return fromSitemap.sort((a, b) => a.length - b.length).slice(0, max)
  const home = await studyLinks(host, `https://www.${host}/`)
  const hubs = home.length ? home : await studyLinks(host, `https://${host}/`)
  const found = new Set<string>(hubs)
  for (const hub of hubs.slice(0, HUB_LIMIT)) for (const u of await studyLinks(host, hub)) found.add(u)
  return [...found].sort((a, b) => a.length - b.length).slice(0, max)
}

async function scanHost(host: string, programmes: Row[], max: number): Promise<number> {
  const robots = await fetchPaced(host, `https://${host}/robots.txt`)
  const robotsText = robots.status === 200 ? robots.text : ''
  const pages = await studyPages(host, max)
  console.log(`${host}: ${pages.length} study pages in the sitemap, for ${programmes.length} programmes`)
  let found = 0
  const shown = new Map<string, number>()
  for (const url of pages) {
    if (!robotsAllow(robotsText, url)) continue
    const r = await fetchPaced(host, url)
    if (r.status !== 200) continue
    const { title, heading } = headingsOf(r.text)
    for (const p of programmes) {
      if ((shown.get(p.id) ?? 0) >= MAX_CANDIDATES || !namesProgramme(p, title, heading)) continue
      shown.set(p.id, (shown.get(p.id) ?? 0) + 1)
      found++
      console.log(`CANDIDATE | ${p.id} | ${p.name} | ${p.level} | ${url} | ${title.slice(0, 120)}`)
    }
  }
  console.log(`${host}: ${found} candidate lines`)
  return found
}

async function main() {
  const root = arg('--data', 'data-in')
  const country = arg('--country', 'CH')
  const max = Number(arg('--max', '250'))
  const only = arg('--hosts', '').split(',').map((h) => h.trim()).filter(Boolean)
  const rows = loadRows(join(root, 'programmes')).filter((r) => r.country === country && !r.url && r.institutionUrl)
  const byHost = new Map<string, Row[]>()
  for (const r of rows) {
    let host: string
    try {
      host = hostOf(r.institutionUrl ?? '')
    } catch {
      continue
    }
    if (only.length && !only.includes(host)) continue
    byHost.set(host, [...(byHost.get(host) ?? []), r])
  }
  console.log(`${rows.length} programmes without a link, on ${byHost.size} domains`)
  const counts = await Promise.all([...byHost].map(([host, list]) => scanHost(host, list, max)))
  console.log(`done: ${counts.reduce((sum, n) => sum + n, 0)} candidate lines`)
}

main()
