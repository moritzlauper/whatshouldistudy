import type { StoredFact } from '../scrapers/lib/facts.ts'
import type { ProgrammeFacts } from './engine/programme-fit.ts'
import type { Locale } from './site/config.ts'

/**
 * The facts database: one Redis hash per country, a field per programme with
 * what Claude read about its official page (scrapers/lib/facts.ts). It lives in
 * a private database, not on the public data branch: the readings are part of
 * the paid comparison. The weekly job writes it (scrapers/programme-facts-store.ts),
 * the site reads it (lib/server/facts-db.ts).
 */

export interface StoreConfig {
  url: string
  token: string
}

/** FACTS_REDIS_REST_URL and FACTS_REDIS_REST_TOKEN, the Upstash REST credentials of that database. */
export function storeConfig(env: Record<string, string | undefined> = process.env): StoreConfig | null {
  const url = env.FACTS_REDIS_REST_URL
  const token = env.FACTS_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

export const factsKey = (country: string) => `wsis:facts:v3:${country}`

export async function command(cfg: StoreConfig, cmd: Array<string | number>, timeoutMs = 8000): Promise<unknown> {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })
  const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string }
  if (!res.ok || json.error) throw new Error(`facts store: ${json.error ?? `HTTP ${res.status}`}`)
  return json.result
}

/** HGETALL's flat list (field, value, field, value …) as readings by programme id. A broken entry is left out. */
export function parseHash(flat: unknown): Record<string, StoredFact> {
  const out: Record<string, StoredFact> = {}
  const list = Array.isArray(flat) ? (flat as string[]) : []
  for (let i = 0; i + 1 < list.length; i += 2) {
    try {
      out[list[i]] = JSON.parse(list[i + 1]) as StoredFact
    } catch {
      // Not a reading we wrote; the programme counts as unread.
    }
  }
  return out
}

export async function readFacts(cfg: StoreConfig, country: string): Promise<Record<string, StoredFact>> {
  return parseHash(await command(cfg, ['HGETALL', factsKey(country)]))
}

/**
 * Replaces a country's readings in one step: the new hash is filled under a
 * temporary key and renamed over the old one, so a half-written run is never seen.
 * An empty set is refused, so a failed run cannot wipe the database.
 */
export async function writeFacts(cfg: StoreConfig, country: string, facts: Record<string, StoredFact>, batch = 50): Promise<number> {
  const entries = Object.entries(facts)
  if (!entries.length) throw new Error(`no readings for ${country}, the stored ones are kept`)
  const tmp = `${factsKey(country)}:tmp`
  await command(cfg, ['DEL', tmp])
  for (let i = 0; i < entries.length; i += batch) {
    const cmd: Array<string | number> = ['HSET', tmp]
    for (const [id, f] of entries.slice(i, i + batch)) cmd.push(id, JSON.stringify(f))
    await command(cfg, cmd)
  }
  await command(cfg, ['RENAME', tmp, factsKey(country)])
  return entries.length
}

const LANGUAGE: Record<Locale, 'de' | 'fr' | 'it' | 'en'> = {
  en: 'en',
  'de-CH': 'de',
  'de-DE': 'de',
  'de-AT': 'de',
  'fr-CH': 'fr',
  'it-CH': 'it',
}

/** A reading as the site shows it: the interest profile, the subjects, and the check in the reader's language. */
export function factsForLocale(f: StoredFact, locale: Locale): ProgrammeFacts {
  return { id: f.id, riasec: f.riasec, subjects: f.subjects, check: f.checks[LANGUAGE[locale]] || f.checks.en, enough: f.enough }
}
