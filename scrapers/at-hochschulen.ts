/**
 * Austria: study programmes at universities, FH and PH. First pass: explore
 * what data.gv.at (CKAN), studienwahl.at and unidata offer.
 */
import { fetchRetry, getJson, isMain, log } from './lib/common.ts'

const CKAN = 'https://www.data.gv.at/katalog/api/3/action'
const QUERIES = ['Studierende Universität Studium', 'Studienangebot', 'Studiengänge Fachhochschule', 'Hochschulstatistik', 'unidata', 'Studien Universitäten']

interface Pkg {
  name: string
  title?: string | Record<string, string>
  organization?: { title?: string }
  resources?: Array<{ format?: string; url?: string; name?: string | Record<string, string> }>
}
const txt = (x: unknown) => (typeof x === 'string' ? x : x && typeof x === 'object' ? (Object.values(x)[0] as string) : '')

async function page(url: string) {
  try {
    const res = await fetchRetry(url, {}, 2)
    const html = await res.text()
    log(`AT ${url}: HTTP ${res.status}, ${html.length} chars`)
    const apis = [...new Set(html.match(/["'](\/?(?:api|rest|odata|service)[^"'\s]{0,120})["']/gi) ?? [])].slice(0, 30)
    log(`AT ${url} api-like paths: ${apis.join(' | ')}`)
    const scripts = [...new Set(html.match(/src=["'][^"']+\.js[^"']*["']/gi) ?? [])].slice(0, 15)
    log(`AT ${url} scripts: ${scripts.join(' | ')}`)
    log(`AT ${url} head: ${html.replace(/\s+/g, ' ').slice(0, 1200)}`)
  } catch (e) {
    log(`AT ${url} failed: ${(e as Error).message}`)
  }
}

async function main() {
  const found = new Map<string, Pkg>()
  for (const q of QUERIES) {
    try {
      const res = await getJson<{ result: { count: number; results: Pkg[] } }>(`${CKAN}/package_search?q=${encodeURIComponent(q)}&rows=30`)
      log(`AT CKAN «${q}»: ${res.result.count} results`)
      for (const p of res.result.results) found.set(p.name, p)
    } catch (e) {
      log(`AT CKAN «${q}» failed: ${(e as Error).message}`)
    }
  }
  for (const p of found.values())
    log(`AT dataset: ${p.name} | ${txt(p.title)} | ${p.organization?.title ?? ''} | ${(p.resources ?? []).map((r) => `${r.format}:${r.url}`).join(' ').slice(0, 600)}`)
  for (const u of ['https://www.studienwahl.at/', 'https://www.studienwahl.at/studien', 'https://unidata.gv.at/', 'https://www.data.gv.at/'] ) await page(u)
  throw new Error('Austria: exploration only')
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
