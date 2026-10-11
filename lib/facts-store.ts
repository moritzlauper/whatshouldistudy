import { CHECK_LANGUAGES, type CheckLanguage, type StoredFact } from '../scrapers/lib/facts.ts'
import type { ProgrammeFacts } from './engine/programme-fit.ts'
import type { Locale } from './site/config.ts'
import { SUBJECT_KEYS } from './taxonomy/fields.ts'

/**
 * The facts database: one Redis hash per country, a field per programme with what
 * Claude read about its official page (scrapers/lib/facts.ts). It is private: the
 * readings belong to the paid comparison. The weekly job writes it through
 * /api/facts/ingest, the site reads it from the same store.
 */

export interface StoreConfig {
  url: string
  token: string
}

/**
 * The Redis REST credentials: FACTS_REDIS_REST_* when set, else the private counter
 * database the site already has (USAGE_*). The public data branch is never used.
 */
export function storeConfig(env: Record<string, string | undefined> = process.env): StoreConfig | null {
  const pairs: Array<[string | undefined, string | undefined]> = [
    [env.FACTS_REDIS_REST_URL, env.FACTS_REDIS_REST_TOKEN],
    [env.USAGE_KV_REST_API_URL || env.USAGE_REDIS_REST_URL, env.USAGE_KV_REST_API_TOKEN || env.USAGE_REDIS_REST_TOKEN],
  ]
  for (const [url, token] of pairs) if (url && token) return { url, token }
  return null
}

export const factsKey = (country: string) => `wsis:facts:v3:${country}`
const tmpKey = (country: string) => `${factsKey(country)}:tmp`

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

/** Starts a new set of readings: they are filled under a temporary key until commitFacts renames it over the old set. */
export async function beginFacts(cfg: StoreConfig, country: string): Promise<void> {
  await command(cfg, ['DEL', tmpKey(country)])
}

export async function partFacts(cfg: StoreConfig, country: string, facts: StoredFact[]): Promise<void> {
  if (!facts.length) return
  const cmd: Array<string | number> = ['HSET', tmpKey(country)]
  for (const f of facts) cmd.push(f.id, JSON.stringify(f))
  await command(cfg, cmd, 15_000)
}

/**
 * Replaces the readings of a country in one step, so a half-written run is never
 * seen. An empty set is refused, so a failed run cannot wipe the stored readings.
 */
export async function commitFacts(cfg: StoreConfig, country: string): Promise<number> {
  const n = Number(await command(cfg, ['HLEN', tmpKey(country)]))
  if (!n) throw new Error(`no readings for ${country}, the stored ones are kept`)
  await command(cfg, ['RENAME', tmpKey(country), factsKey(country)])
  return n
}

/** A reading as it may be stored: every field of the right kind and size, nothing else. Otherwise null. */
export function validStoredFact(raw: unknown): StoredFact | null {
  if (!raw || typeof raw !== 'object') return null
  const x = raw as Record<string, unknown>
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)
  const id = text(x.id, 40)
  const url = text(x.url, 500)
  const hash = typeof x.hash === 'string' && /^[0-9a-f]{64}$/.test(x.hash) ? x.hash : null
  const at = typeof x.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.at) ? x.at : null
  const riasec =
    Array.isArray(x.riasec) && x.riasec.length === 6 && x.riasec.every((n) => Number.isInteger(n) && n >= 0 && n <= 5) ? (x.riasec as number[]) : null
  const subjects =
    Array.isArray(x.subjects) && x.subjects.length <= 6 && x.subjects.every((s) => typeof s === 'string' && (SUBJECT_KEYS as readonly string[]).includes(s))
      ? (x.subjects as string[])
      : null
  const enough = typeof x.enough === 'boolean' ? x.enough : null
  const given = x.checks && typeof x.checks === 'object' ? (x.checks as Record<string, unknown>) : null
  if (!id || !url || !hash || !at || !riasec || !subjects || enough === null || !given) return null
  const checks = {} as Record<CheckLanguage, string>
  for (const l of CHECK_LANGUAGES) {
    const c = given[l]
    if (typeof c !== 'string' || c.length > 300) return null
    checks[l] = c
  }
  return { id, url, hash, at, riasec, subjects, enough, checks }
}

const LANGUAGE: Record<Locale, CheckLanguage> = {
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
