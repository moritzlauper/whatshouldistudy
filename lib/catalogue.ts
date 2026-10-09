import { COUNTRIES } from './countries.ts'
import type { CatalogueEntry, Level } from './programmes.ts'

/**
 * The free programme catalogue: one page per country with a search, and one
 * per country and field listing every programme. The global site has it for
 * every country with programme data (/programmes/switzerland/computer-science),
 * each country site for its own country (/studiengaenge/informatik).
 */

/** Countries with programme-level data from an official source; a country without programmes in the data has no pages. */
export const CATALOGUE_COUNTRIES = Object.keys(COUNTRIES).filter((cc) => COUNTRIES[cc].programmeData)

/** Address of a country on the global site, from its English name: south-korea. */
export function countrySlug(cc: string): string {
  return (COUNTRIES[cc]?.name ?? cc)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function countryBySlug(slug: string): string | null {
  return CATALOGUE_COUNTRIES.find((cc) => countrySlug(cc) === slug) ?? null
}

/** The order levels are listed in. */
export const LEVEL_ORDER: Level[] = ['bachelor', 'integrated', 'professional', 'master', 'short', 'doctorate']

/** Lower case, without accents and punctuation, for search. */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** A page of search results, as /api/catalogue returns it. */
export interface CatalogueResult {
  /** False until the data run has built this country's catalogue. */
  ready: boolean
  total: number
  /** Matches per level, before the level filter. */
  levels: Partial<Record<Level, number>>
  items: CatalogueEntry[]
  /** Names of the fields in `items`, in the requested language. */
  fieldNames: Record<string, string>
}
