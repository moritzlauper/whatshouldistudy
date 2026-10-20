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

/** A browser report: exactly {source} after an import or {event: 'result'} when an own result is shown. */
export function parseUsage(value: unknown): { source: ImportSource } | { event: 'result' } | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && (value as Record<string, unknown>).event === 'result') return { event: 'result' }
  return parseImport(value)
}

/** Only public catalogue metadata may become aggregate counter keys. */
export function programmeCounters(items: Array<{ id: string; name: string; institution: string }>, placement: 'preview' | 'unlocked'): string[] {
  return [...new Map(items.map((p) => [p.id, JSON.stringify({ kind: 'programme', placement, id: p.id, name: p.name, institution: p.institution })])).values()]
}
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
