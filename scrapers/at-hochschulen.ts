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

async function head(url: string, lines = 6) {
  try {
    const raw = await (await fetchRetry(url, {}, 2)).arrayBuffer()
    let text = new TextDecoder('utf-8').decode(raw)
    if (text.includes('\uFFFD')) text = new TextDecoder('latin1').decode(raw)
    const rows = text.split(/\r?\n/)
    log(`AT ${url}: ${rows.length} lines`)
    for (const r of rows.slice(0, lines)) log(`AT   ${r.slice(0, 600)}`)
  } catch (e) {
    log(`AT ${url} failed: ${(e as Error).message.slice(0, 200)}`)
  }
}

async function main() {
  for (const u of ['https://unidata.gv.at/opendata', 'https://unidata.gv.at/opendata/', 'https://unidata.gv.at/opendata/universitaeten']) {
    try {
      const html = await (await fetchRetry(u, {}, 2)).text()
      const links = [...new Set(html.match(/\/opendata\/[a-z0-9\-_/]+/gi) ?? [])]
      log(`AT ${u}: ${html.length} chars; opendata links: ${links.join(' | ')}`)
    } catch (e) {
      log(`AT ${u} failed: ${(e as Error).message.slice(0, 160)}`)
    }
  }
  for (const g of ['universitaeten/studien', 'universitaeten/belegte-studien', 'universitaeten/studienangebot', 'universitaeten/studienabschluesse', 'fachhochschulen/studien', 'fachhochschulen/studierende', 'fachhochschulen/studiengaenge', 'paedagogische-hochschulen/studien', 'privathochschulen/studien']) await head(`https://unidata.gv.at/opendata/${g}`, 4)
  for (const q of ['Studienrichtung', 'belegte Studien Universität', 'Studiengänge', 'ISCED Studierende', 'Fachhochschul-Studiengänge', 'Studien nach Universität']) {
    try {
      const j = (await getJson<{ result?: { count?: number; results?: Array<Record<string, unknown>> } }>(`https://www.data.gv.at/api/hub/search/search?q=${encodeURIComponent(q)}&filter=dataset&limit=40`)) ?? {}
      log(`AT data.gv.at «${q}»: ${j.result?.count}`)
      for (const r of j.result?.results ?? []) {
        const d = ((r.distributions as Array<Record<string, unknown>>) ?? []).map((x) => String(x.access_url ?? x.download_url ?? '')).filter((x) => /csv|json|opendata/i.test(x)).slice(0, 2)
        if (d.length) log(`AT   ${txt(r.title)} | ${d.join(' ')}`)
      }
    } catch (e) {
      log(`AT search ${q} failed: ${(e as Error).message.slice(0, 160)}`)
    }
  }
  // studienwahl.at: what a result list shows.
  try {
    const html = await (await fetchRetry('https://www.studienwahl.at/studien/?page=1&per-page=50', {}, 2)).text()
    const links = html.match(/href="\/studien\/[^"]+\.de\.html"/g) ?? []
    log(`AT studienwahl list: ${links.length} programme links; total text: ${(html.match(/[\d.]+\s*(Ergebnisse|Studien|Treffer)/g) ?? []).slice(0, 3).join(' | ')}`)
    const k = html.indexOf(links[0]?.slice(6, -1) ?? '###')
    log(`AT studienwahl item: ${html.slice(Math.max(0, k - 600), k + 1800).replace(/\s+/g, ' ')}`)
    const detail = links[0]?.slice(6, -1)
    if (detail) {
      const d = await (await fetchRetry(`https://www.studienwahl.at${detail}`, {}, 2)).text()
      const m = d.indexOf('<h1')
      log(`AT studienwahl detail ${detail}: ${d.slice(m, m + 3500).replace(/\s+/g, ' ')}`)
    }
  } catch (e) {
    log(`AT studienwahl failed: ${(e as Error).message.slice(0, 160)}`)
  }
  throw new Error('Austria: exploration only')
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
