import 'server-only'
import type { StoredFact } from '../../scrapers/lib/facts.ts'
import { readFacts, storeConfig } from '../facts-store.ts'

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

export async function countryFacts(country: string): Promise<Record<string, StoredFact> | null> {
  const cfg = storeConfig()
  if (!cfg) return null
  const hit = cache.get(country)
  if (hit && Date.now() - hit.at < TTL) return hit.facts
  try {
    const facts = await readFacts(cfg, country)
    cache.set(country, { at: Date.now(), facts })
    return facts
  } catch {
    console.warn('Facts storage unavailable')
    return hit?.facts ?? null
  }
}

