import 'server-only'
import { getCatalogue } from './data.ts'
import { normalizeSearch } from '../catalogue.ts'
import type { CatalogueResult } from '../catalogue.ts'
import type { CatalogueEntry, CatalogueShard, Level } from '../programmes.ts'
import { FIELD_BY_ID } from '../taxonomy/fields.ts'
import { fieldName } from '../site/labels.ts'
import type { Locale } from '../site/config.ts'

export interface CatalogueQuery {
  country: string
  q: string
  field?: string
  level?: Level
  locale: Locale
  page: number
}

export const PAGE_SIZE = 25

/** What a programme is found by: its name, institution, place and its fields in English and the page's language. */
type Index = { shard: CatalogueShard; text: string[]; names: string[] }
const indexes = new Map<string, Index>()

function index(shard: CatalogueShard, locale: Locale): Index {
  const key = `${shard.country}|${locale}`
  const hit = indexes.get(key)
  if (hit?.shard === shard) return hit
  const names = shard.programmes.map((p) => normalizeSearch(p.name))
  const text = shard.programmes.map((p, i) =>
    [names[i], normalizeSearch([p.institution, p.city, p.region, ...p.fields.flatMap((f) => [FIELD_BY_ID[f]?.name, fieldName(f, locale)])].filter(Boolean).join(' '))].join(' '),
  )
  const built = { shard, text, names }
  indexes.set(key, built)
  return built
}

/** Every word must match; programmes whose name holds the words come first. */
export async function searchCatalogue(query: CatalogueQuery): Promise<CatalogueResult> {
  const shard = await getCatalogue(query.country)
  if (!shard) return { ready: false, total: 0, levels: {}, items: [], fieldNames: {} }
  const { text, names } = index(shard, query.locale)
  const words = normalizeSearch(query.q).split(' ').filter(Boolean)
  const scored: Array<{ p: CatalogueEntry; score: number }> = []
  const levels: CatalogueResult['levels'] = {}
  shard.programmes.forEach((p, i) => {
    if (query.field && !p.fields.includes(query.field)) return
    if (!words.every((w) => text[i].includes(w))) return
    levels[p.level] = (levels[p.level] ?? 0) + 1
    if (query.level && p.level !== query.level) return
    const inName = words.filter((w) => names[i].includes(w)).length
    scored.push({ p, score: inName * 2 + (words.length && names[i].startsWith(words[0]) ? 1 : 0) })
  })
  // The catalogue is sorted by institution and name; a stable sort keeps that order within a score.
  if (words.length) scored.sort((a, b) => b.score - a.score)
  const items = scored.slice(query.page * PAGE_SIZE, (query.page + 1) * PAGE_SIZE).map((s) => s.p)
  const fieldNames: Record<string, string> = {}
  for (const p of items) for (const f of p.fields) fieldNames[f] ??= fieldName(f, query.locale)
  return { ready: true, total: scored.length, levels, items, fieldNames }
}
