/** Lower case, without accents: «Zürich» and «zurich» are the same place to search for. */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss').toLowerCase().trim()
}

/** Whether a programme's city matches what was typed: any part of the name, accents and case ignored. */
export function cityMatches(city: string | undefined, typed: string): boolean {
  const q = foldText(typed)
  return !q || foldText(city ?? '').includes(q)
}
