import 'server-only'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { StoredFact } from '../../scrapers/lib/facts.ts'
import { factsKey, parseHash, storeConfig, type StoreConfig } from '../facts-store.ts'

/**
 * The facts database as the site reads it: the readings of a country, kept in
 * memory for an hour, since the weekly job writes them once. If the store cannot
 * be read, the last readings this instance had are used, or none.
 */
const TTL = 60 * 60 * 1000
const cache = new Map<string, { at: number; facts: Record<string, StoredFact> }>()

/** After a new set of readings is committed: this instance reads it again on its next request. */
export function forgetCountry(country: string) {
  cache.delete(country)
}

/**
 * The store's HGETALL, sent outside Next's fetch. A fetch with `cache: 'no-store'` would turn every page that
 * shows a reading dynamic, and the field pages are rendered once a day; lib/server/data.ts makes the same choice.
 */
function readHash(cfg: StoreConfig, country: string): Promise<unknown> {
  const url = new URL(cfg.url)
  const body = JSON.stringify(['HGETALL', factsKey(country)])
  const send = url.protocol === 'http:' ? httpRequest : httpsRequest
  return new Promise((resolve, reject) => {
    const req = send(
      url,
      { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          let json: { result?: unknown; error?: string } = {}
          try {
            json = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch {
            // Not JSON: the status below says what happened.
          }
          if ((res.statusCode ?? 0) >= 300 || json.error) reject(new Error(`facts store: ${json.error ?? `HTTP ${res.statusCode}`}`))
          else resolve(json.result)
        })
        res.on('error', reject)
      },
    )
    req.on('error', reject)
    req.setTimeout(8000, () => req.destroy(new Error('facts store: timeout')))
    req.end(body)
  })
}

export async function countryFacts(country: string): Promise<Record<string, StoredFact> | null> {
  const cfg = storeConfig()
  if (!cfg) return null
  const hit = cache.get(country)
  if (hit && Date.now() - hit.at < TTL) return hit.facts
  try {
    const facts = parseHash(await readHash(cfg, country))
    cache.set(country, { at: Date.now(), facts })
    return facts
  } catch {
    console.warn('Facts storage unavailable')
    return hit?.facts ?? null
  }
}
