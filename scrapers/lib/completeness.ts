/** Keep a university/level group when its reader failed or suddenly lost over 30 % of entries. */
export function preserveInstitutions<T extends { id: string; institution: string; level: string }>(fresh: T[], previous: T[]): { programmes: T[]; kept: string[] } {
  const key = (p: T) => JSON.stringify([p.institution, p.level])
  const old = new Map<string, T[]>()
  const counts = new Map<string, number>()
  for (const p of previous) old.set(key(p), [...(old.get(key(p)) ?? []), p])
  for (const p of fresh) counts.set(key(p), (counts.get(key(p)) ?? 0) + 1)
  const kept = [...old.keys()].filter((k) => (counts.get(k) ?? 0) < old.get(k)!.length * .7)
  const blocked = new Set(kept)
  return {
    programmes: [...fresh.filter((p) => !blocked.has(key(p))), ...kept.flatMap((k) => old.get(k)!)],
    kept: kept.map((k) => { const [institution, level] = JSON.parse(k); return `${institution} (${level})` }),
  }
}
