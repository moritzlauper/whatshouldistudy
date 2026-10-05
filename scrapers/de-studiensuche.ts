/**
 * Germany: every study programme from the Studiensuche of the Bundesagentur für
 * Arbeit (the database behind studiensuche.arbeitsagentur.de, documented at
 * studiensuche.api.bund.dev). First pass: explore the answer format.
 */
import { fetchRetry, isMain, log } from './lib/common.ts'

const API = 'https://rest.arbeitsagentur.de/infosysbub/studisu'
const HEADERS = { 'X-API-Key': 'infosysbub-studisu', Accept: 'application/json' }

function shape(x: unknown, depth = 0): unknown {
  if (Array.isArray(x)) return x.length ? [`${x.length}×`, shape(x[0], depth + 1)] : []
  if (x && typeof x === 'object') {
    if (depth > 4) return '{…}'
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shape(v, depth + 1)]))
  }
  return typeof x === 'string' ? `"${x.slice(0, 60)}"` : x
}

async function probe(path: string) {
  try {
    const res = await fetchRetry(`${API}${path}`, { headers: HEADERS }, 2)
    const text = await res.text()
    log(`DE ${path}: HTTP ${res.status}, ${text.length} chars`)
    try {
      const j = JSON.parse(text)
      log(`DE ${path} shape: ${JSON.stringify(shape(j)).slice(0, 4000)}`)
    } catch {
      log(`DE ${path} text: ${text.slice(0, 1500)}`)
    }
  } catch (e) {
    log(`DE ${path} failed: ${(e as Error).message}`)
  }
}

async function count(q: string) {
  try {
    const res = await fetchRetry(`${API}/pc/v1/studienangebote?${q}`, { headers: HEADERS }, 2)
    const j = (await res.json()) as { maxErgebnisse?: number; items?: Array<{ studienangebot: { studiBezeichnung: string } }> }
    log(`DE count ${q}: ${j.maxErgebnisse} (${j.items?.[0]?.studienangebot.studiBezeichnung ?? '-'})`)
  } catch (e) {
    log(`DE count ${q} failed: ${(e as Error).message.slice(0, 200)}`)
  }
}

async function main() {
  for (const q of [
    'sw=Informatik&sfa=93970',
    'sfa=93701,93796',
    'sfa=93701%7C93796',
    'sfa=2101',
    'studienfelder=2101',
    'sf=93701',
    'sfg=21',
    'sw=Bachelor',
    'sw=Master',
    'sw=Studium',
    'sw=*',
    'sw=ab',
    'sw=Wissenschaft',
    'sw=Informatik&abg=bachelor',
    'sw=Informatik&abg=2',
    'sw=Informatik&hsa=108',
    'sw=Informatik&re=BY',
    'sw=Informatik&pg=31',
  ])
    await count(q)
  // Degree and institution labels across a broad query.
  const degrees = new Map<string, number>()
  const kinds = new Map<string, number>()
  let links = 0
  for (let pg = 1; pg <= 15; pg++) {
    try {
      const res = await fetchRetry(`${API}/pc/v1/studienangebote?sw=Wirtschaft&pg=${pg}`, { headers: HEADERS }, 2)
      const j = (await res.json()) as { items: Array<{ studienangebot: { abschlussgrad?: { label: string }; hochschulart?: { label: string }; externalLinks?: unknown[] } }> }
      for (const it of j.items) {
        const a = it.studienangebot
        degrees.set(a.abschlussgrad?.label ?? '-', (degrees.get(a.abschlussgrad?.label ?? '-') ?? 0) + 1)
        kinds.set(a.hochschulart?.label ?? '-', (kinds.get(a.hochschulart?.label ?? '-') ?? 0) + 1)
        if (a.externalLinks?.length) {
          links++
          if (links < 4) log(`DE externalLinks: ${JSON.stringify(a.externalLinks).slice(0, 400)}`)
        }
      }
    } catch (e) {
      log(`DE page ${pg} failed: ${(e as Error).message.slice(0, 200)}`)
    }
  }
  log(`DE degrees: ${JSON.stringify([...degrees])}`)
  log(`DE kinds: ${JSON.stringify([...kinds])}`)
  log(`DE items with links: ${links}`)
  throw new Error('Germany: exploration only')
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
