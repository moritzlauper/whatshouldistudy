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
  const D = 'https://data.statistik.gv.at/data'
  for (const id of ['OGD_ordstud_ext_ORD_STUDIEN_1', 'OGD_unistud1_ext_UNI_STUD1_1', 'OGD_fhsstud_ext_FHS_S_1', 'OGD_phsstud_ext_PHS_S_1', 'OGD_uptstud_ext_UPT_S_1']) {
    await head(`${D}/${id}_HEADER.csv`, 40)
    await head(`${D}/${id}.csv`, 6)
  }
  for (const c of ['OGD_ordstud_ext_ORD_STUDIEN_1_C-BER_ZEIT-0', 'OGD_fhsstud_ext_FHS_S_1_C-SEMESTER-0', 'OGD_unistud1_ext_UNI_STUD1_1_C-SEMESTER-0']) await head(`${D}/${c}.csv`, 8)
  await head('https://unidata.gv.at/opendata/universitaeten/studierende', 8)
  await head('https://extapp.noc-science.at/apex/shibb/api/v1/hochschulen', 3)
  throw new Error('Austria: exploration only')
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
