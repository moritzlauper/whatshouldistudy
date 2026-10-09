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
