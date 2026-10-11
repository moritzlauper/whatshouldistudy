/**
 * Takes turns between groups (fields) in an already sorted list: the first of
 * each group comes first, then the second of each, and so on. Each group keeps
 * its own order. Used so a page of programme candidates holds the best of
 * each field, not only the strongest field.
 */
export function spreadByField<T extends { matchedField: string }>(sorted: T[]): T[] {
  const groups = new Map<string, T[]>()
  for (const p of sorted) groups.set(p.matchedField, [...(groups.get(p.matchedField) ?? []), p])
  const lists = [...groups.values()]
  const out: T[] = []
  for (let i = 0; out.length < sorted.length; i++) for (const l of lists) if (l[i]) out.push(l[i])
  return out
}
