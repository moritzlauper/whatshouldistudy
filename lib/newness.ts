/**
 * "Neu" on a programme: it was first seen in our data within the last 90 days.
 * A day on which many programmes were first seen at once (a source added, or a
 * data run that lost its history) is a bulk import, not new offerings, so those
 * programmes do not count as new.
 */
export const BASELINE = '2000-01-01'
export const BULK_LIMIT = 100

/** The days on which more than `limit` programmes were first seen at once. */
export function bulkDays(firstSeen: Array<string | undefined>, limit = BULK_LIMIT): Set<string> {
  const counts = new Map<string, number>()
  for (const d of firstSeen) if (d && d !== BASELINE) counts.set(d, (counts.get(d) ?? 0) + 1)
  return new Set([...counts].filter(([, n]) => n > limit).map(([d]) => d))
}

export function isNewProgramme(firstSeen: string | undefined, cutoff: string, bulk: ReadonlySet<string>): boolean {
  return !!firstSeen && firstSeen !== BASELINE && firstSeen >= cutoff && !bulk.has(firstSeen)
}
