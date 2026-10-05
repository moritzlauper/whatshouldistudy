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

async function search(url: string) {
  try {
    const j = (await getJson<{ result?: { count?: number; results?: Array<Record<string, unknown>> } }>(url)) ?? {}
    const results = j.result?.results ?? []
    log(`AT search ${url}: ${j.result?.count ?? '?'} results`)
    for (const r of results.slice(0, 25)) {
      const title = txt(r.title)
      const dists = ((r.distributions as Array<Record<string, unknown>>) ?? []).map((d) => `${txt((d.format as Record<string, unknown>)?.id ?? d.format)}:${String(d.access_url ?? d.download_url ?? '').slice(0, 160)}`)
      log(`AT ds: ${title} | ${txt((r.publisher as Record<string, unknown>)?.name)} | ${dists.join(' ').slice(0, 700)}`)
    }
  } catch (e) {
    log(`AT search ${url} failed: ${(e as Error).message}`)
  }
}

async function main() {
  for (const q of ['Studierende Universität Studium', 'Studienangebot', 'Fachhochschul-Studiengänge', 'Studierende Fachhochschulen', 'Pädagogische Hochschulen Studierende', 'unidata']) {
    await search(`https://data.europa.eu/api/hub/search/search?q=${encodeURIComponent(q)}&filter=dataset&limit=25&facets=${encodeURIComponent(JSON.stringify({ country: ['at'] }))}`)
    await search(`https://www.data.gv.at/api/hub/search/search?q=${encodeURIComponent(q)}&filter=dataset&limit=25`)
  }
  // studienwahl.at: how a result list and a programme page look.
  for (const u of ['https://www.studienwahl.at/robots.txt', 'https://www.studienwahl.at/studien?page=2']) {
    try {
      const html = await (await fetchRetry(u, {}, 2)).text()
      log(`AT ${u}: ${html.length} chars`)
      const i = html.search(/class="[^"]*(result|studium|list-item|search-result)[^"]*"/i)
      log(`AT ${u} around results: ${html.slice(Math.max(0, i - 200), i + 3500).replace(/\s+/g, ' ')}`)
      const links = [...new Set(html.match(/href="\/studien?\/[^"]+"/g) ?? [])].slice(0, 20)
      log(`AT ${u} links: ${links.join(' ')}`)
      const pages = html.match(/page=(\d+)/g)?.slice(-3)
      log(`AT ${u} paging: ${pages?.join(' ')}`)
    } catch (e) {
      log(`AT ${u} failed: ${(e as Error).message}`)
    }
  }
  try {
    const home = await (await fetchRetry('https://unidata.gv.at/', {}, 2)).text()
    const js = home.match(/src="([^"]+main-[^"]+\.js)"/)?.[1]
    if (js) {
      const code = await (await fetchRetry(js, {}, 2)).text()
      log(`AT unidata js ${code.length} chars; api: ${[...new Set(code.match(/["'`][^"'`]*\/api\/[^"'`]{0,80}["'`]/g) ?? [])].slice(0, 20).join(' | ')}`)
    }
  } catch (e) {
    log(`AT unidata failed: ${(e as Error).message}`)
  }
  throw new Error('Austria: exploration only')
}
if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
