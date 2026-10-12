/** A model response must contain each requested ID exactly once, with no foreign IDs. */
export function exactBatch(raw: unknown, ids: ReadonlySet<string>): Record<string, unknown>[] {
  if (!Array.isArray(raw)) throw new Error('Missing programmes in model response')
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !ids.has(item.id) || seen.has(item.id)) {
      throw new Error('Unexpected or duplicate programme in model response')
    }
    seen.add(item.id)
  }
  if (seen.size !== ids.size) throw new Error(`Incomplete model response: ${seen.size}/${ids.size}`)
  return raw
}
