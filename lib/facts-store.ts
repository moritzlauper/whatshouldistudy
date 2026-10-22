import { CHECK_LANGUAGES, TOPIC_KEYS, validDistinctiveTranslations, type CheckLanguage, type Specialisation, type StoredFact } from '../scrapers/lib/facts.ts'
import type { ProgrammeFacts } from './engine/programme-fit.ts'
import type { Locale } from './site/config.ts'
import { SUBJECT_KEYS } from './taxonomy/fields.ts'

/**
 * The facts database: one Redis hash per country, a field per programme with what
 * the AI read about its official page (scrapers/lib/facts.ts). It is private: the
 * readings belong to the paid comparison, and public pages get only what
 * specialisationNames and publicReading let through. The weekly job writes it
 * through /api/facts/ingest, the site reads it from the same store.
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
  // A reading made before topics, specialisations and distinctive sentences existed has none of them: they count as none.
  const topics = optional<string>(x.topics, (t) => typeof t === 'string' && TOPIC_KEYS.includes(t), 6)
  const specialisations = optional<Specialisation>(x.specialisations, validSpecialisation, 8)
  const distinctive = optional<string>(x.distinctive, (d) => typeof d === 'string' && d.length > 0 && d.length <= 160, 3)
  if (!id || !url || !hash || !at || !riasec || !subjects || !topics || !specialisations || !distinctive || enough === null || !given) return null
  if ((x.distinctiveTranslations !== undefined || Number(x.version) >= 6) && !validDistinctiveTranslations(x.distinctiveTranslations, distinctive.length)) return null
  const checks = {} as Record<CheckLanguage, string>
  for (const l of CHECK_LANGUAGES) {
    const c = given[l]
    if (typeof c !== 'string' || c.length > 300) return null
    checks[l] = c
  }
  return { ...(Number.isInteger(x.version) && Number(x.version) > 0 ? { version: Number(x.version) } : {}), id, url, hash, at, riasec, subjects, topics, specialisations, distinctive,
    ...(x.distinctiveTranslations !== undefined ? { distinctiveTranslations: x.distinctiveTranslations as StoredFact['distinctiveTranslations'] } : {}), enough, checks }
}

/**
 * The first field of a reading that is not as it may be stored, by name only; null when the reading is valid.
 * The site answers with this when it refuses a part, so that the log says what failed, never what was read.
 */
export function storedFactProblem(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'not a reading'
  const x = raw as Record<string, unknown>
  if (typeof x.id !== 'string' || x.id.length === 0 || x.id.length > 40) return 'id'
  if (typeof x.url !== 'string' || x.url.length === 0 || x.url.length > 500) return 'url'
  if (!(typeof x.hash === 'string' && /^[0-9a-f]{64}$/.test(x.hash))) return 'hash'
  if (!(typeof x.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.at))) return 'at'
  if (!(Array.isArray(x.riasec) && x.riasec.length === 6 && x.riasec.every((n) => Number.isInteger(n) && n >= 0 && n <= 5))) return 'riasec'
  if (!(Array.isArray(x.subjects) && x.subjects.length <= 6 && x.subjects.every((s) => typeof s === 'string' && (SUBJECT_KEYS as readonly string[]).includes(s)))) return 'subjects'
  if (typeof x.enough !== 'boolean') return 'enough'
  if (!(x.checks && typeof x.checks === 'object')) return 'checks'
  if (!(x.topics === undefined || (Array.isArray(x.topics) && x.topics.length <= 6 && x.topics.every((t) => typeof t === 'string' && TOPIC_KEYS.includes(t))))) return 'topics'
  if (!(x.specialisations === undefined || (Array.isArray(x.specialisations) && x.specialisations.length <= 8 && x.specialisations.every(validSpecialisation)))) return 'specialisations'
  if (!(x.distinctive === undefined || (Array.isArray(x.distinctive) && x.distinctive.length <= 3 && x.distinctive.every((d) => typeof d === 'string' && d.length > 0 && d.length <= 160)))) return 'distinctive'
  if ((x.distinctiveTranslations !== undefined || Number(x.version) >= 6) && !validDistinctiveTranslations(x.distinctiveTranslations, (x.distinctive as string[] | undefined)?.length ?? 0)) return 'distinctiveTranslations'
  const given = x.checks as Record<string, unknown>
  for (const l of CHECK_LANGUAGES) if (typeof given[l] !== 'string' || (given[l] as string).length > 300) return `checks.${l}`
  return null
}

/** A list that may be absent (then it counts as empty); when given, at most `max` items, all of which pass `ok`. */
function optional<T>(v: unknown, ok: (x: unknown) => boolean, max: number): T[] | null {
  if (v === undefined) return []
  return Array.isArray(v) && v.length <= max && v.every(ok) ? (v as T[]) : null
}

function validSpecialisation(s: unknown): boolean {
  if (!s || typeof s !== 'object') return false
  const y = s as Record<string, unknown>
  return (
    typeof y.name === 'string' &&
    y.name.length > 0 &&
    y.name.length <= 90 &&
    Array.isArray(y.topics) &&
    optional<string>(y.topics, (t) => typeof t === 'string' && TOPIC_KEYS.includes(t), 3) !== null
  )
}

const LANGUAGE: Record<Locale, CheckLanguage> = {
  en: 'en',
  'de-CH': 'de',
  'de-DE': 'de',
  'de-AT': 'de',
  'fr-CH': 'fr',
  'it-CH': 'it',
}

/** A reading in the reader's language. Untranslated legacy points wait for the offline backfill. */
export function factsForLocale(f: StoredFact, locale: Locale): ProgrammeFacts {
  return {
    id: f.id,
    riasec: f.riasec,
    subjects: f.subjects,
    topics: f.topics ?? [],
    specialisations: f.specialisations ?? [],
    distinctive: validDistinctiveTranslations(f.distinctiveTranslations, f.distinctive?.length ?? 0) ? f.distinctiveTranslations[LANGUAGE[locale]] : [],
    check: f.checks[LANGUAGE[locale]] || '',
    enough: f.enough,
  }
}

/**
 * The names of the specialisations each official page gives, by programme id, for the public field pages. Only the
 * names leave the store: the interest profile, the checks and the distinctive sentences stay in the paid reading.
 */
export function specialisationNames(facts: Record<string, StoredFact> | null): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [id, f] of Object.entries(facts ?? {})) {
    const names = (f.specialisations ?? []).map((s) => s.name)
    if (names.length) out[id] = names
  }
  return out
}

/** What a programme's public page shows of its reading. */
export interface PublicReading {
  specialisations: string[]
  /** What sets the programme apart, in the page's language. */
  distinctive: string[]
  /** When the official page was read, YYYY-MM-DD. */
  at: string
  /** The page that was read, when it is a web address. */
  url?: string
}

/**
 * The part of a reading that describes the programme itself, for its public page: the names of its specialisations and
 * what sets it apart. The interest profile, the topics and the check stay in the paid reading. Null when there is nothing.
 */
export function publicReading(f: StoredFact | undefined, locale: Locale): PublicReading | null {
  if (!f) return null
  const { specialisations = [], distinctive = [] } = factsForLocale(f, locale)
  const names = specialisations.map((s) => s.name)
  if (!names.length && !distinctive.length) return null
  const url = webAddress(f.url)
  return { specialisations: names, distinctive, at: f.at, ...(url ? { url } : {}) }
}

function webAddress(url: string): string | undefined {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined
  } catch {
    return undefined
  }
}
