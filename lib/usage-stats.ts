import { FIELD_BY_ID, RIASEC_KEYS } from './taxonomy/fields.ts'

/** The complete allowlist of imported source categories. No free text is accepted. */
export const IMPORT_SOURCES = ['youtube', 'takeout', 'google-search', 'spotify', 'spotify-export', 'instagram', 'tiktok', 'reddit', 'github'] as const
export type ImportSource = typeof IMPORT_SOURCES[number]
/** Steps worth a count. A browser may report only a shown result; unlocks are counted by the server after Stripe confirms payment. */
export const USAGE_EVENTS = ['result', 'unlock'] as const
export type UsageEvent = typeof USAGE_EVENTS[number]
export const USAGE_STATS = process.env.NEXT_PUBLIC_USAGE_STATS === '1'

export function parseImport(value: unknown): { source: ImportSource } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Object.keys(input).length !== 1 || !IMPORT_SOURCES.includes(input.source as ImportSource)) return null
  return { source: input.source as ImportSource }
}

/** What the profile rests on: answers, imported data, or both. No source type. */
export const PROFILE_BASES = ['questionnaire', 'data', 'both'] as const
export type ProfileBasis = typeof PROFILE_BASES[number]
/** The 120 three-letter Holland codes, plus profiles too flat or too carelessly answered to have one. */
export const PROFILE_CODES = [
  ...RIASEC_KEYS.flatMap((a) => RIASEC_KEYS.flatMap((b) => RIASEC_KEYS.map((c) => a + b + c))).filter((c) => new Set(c).size === 3),
  'flat', 'careless',
]
/** How many of the first fields are counted with the profile. */
export const PROFILE_FIELDS = 3
/** A coarse profile class and the first fields of one result: no answers, scores or sources. */
export interface ProfileReport { basis: ProfileBasis; code: string; fields: string[] }

export function parseProfile(value: unknown): ProfileReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Object.keys(input).length !== 3 || !PROFILE_BASES.includes(input.basis as ProfileBasis) || !PROFILE_CODES.includes(input.code as string)) return null
  const fields = input.fields
  if (!Array.isArray(fields) || !fields.length || fields.length > PROFILE_FIELDS || new Set(fields).size !== fields.length) return null
  if (!fields.every((id) => typeof id === 'string' && Object.hasOwn(FIELD_BY_ID, id))) return null
  return { basis: input.basis as ProfileBasis, code: input.code as string, fields: fields as string[] }
}

/** A browser report: exactly {source} after an import or {event: 'result'}, optionally with {profile}, when an own result is shown. */
export function parseUsage(value: unknown): { source: ImportSource } | { event: 'result'; profile?: ProfileReport } | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).event === 'result') {
    const keys = Object.keys(value)
    if (keys.length === 1) return { event: 'result' }
    const profile = keys.length === 2 && 'profile' in value ? parseProfile(value.profile) : null
    return profile ? { event: 'result', profile } : null
  }
  return parseImport(value)
}

/** Only public catalogue metadata may become aggregate counter keys. */
export function programmeCounters(items: Array<{ id: string; name: string; institution: string }>, placement: 'preview' | 'unlocked'): string[] {
  return [...new Map(items.map((p) => [p.id, JSON.stringify({ kind: 'programme', placement, id: p.id, name: p.name, institution: p.institution })])).values()]
}
/** One counter per place, so the report can show place 1 alone or the first three together. */
export const profileCounters = (p: ProfileReport) =>
  p.fields.map((field, i) => JSON.stringify({ kind: 'profile', basis: p.basis, code: p.code, rank: i + 1, field }))
export const sourceCounter = (source: ImportSource) => JSON.stringify({ kind: 'import', source })
export const eventCounter = (event: UsageEvent) => JSON.stringify({ kind: 'event', event })
export const validMonth = (month: string) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(month)
export const USAGE_DAY_TIMEZONE = 'Europe/Zurich'
export const validDay = (day: string) => /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(day)
  && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day

/** Swiss calendar days, including summer/winter time; existing months stay UTC. */
export function usageDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: USAGE_DAY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function usagePeriods(now = new Date()) {
  const day = usageDay(now)
  return {
    month: now.toISOString().slice(0, 7),
    day,
    monthExpiry: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000 + 90 * 86400,
    // Retain at least 90 days after the Swiss day's end, also across DST changes.
    dayExpiry: Date.parse(`${day}T00:00:00Z`) / 1000 + 91 * 86400,
  }
}
