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

async function main() {
  for (const p of [
    '/pc/v1/studienangebote?sw=Informatik',
    '/pc/v1/studienangebote?sw=Informatik&pg=2',
    '/pc/v1/studienangebote',
    '/pc/v1/studienfelder',
    '/pc/v1/studienfeldgruppen',
    '/ed/v1/studienangebote?sw=Informatik',
  ])
    await probe(p)
  throw new Error('Germany: exploration only')
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
