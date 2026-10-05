/**
 * The programme record every scraper produces and the paid API serves.
 * Shared by the scrapers (Node) and the site (server routes and UI).
 */

export type Level = 'short' | 'bachelor' | 'master' | 'integrated' | 'doctorate' | 'professional'

export const LEVEL_LABELS: Record<Level, string> = {
  short: 'Short-cycle / foundation',
  bachelor: "Bachelor's",
  master: "Master's",
  integrated: "Integrated bachelor's + master's",
  doctorate: 'Doctorate',
  professional: 'Professional degree (MD, JD, ...)',
}

export interface Programme {
  id: string
  name: string
  institution: string
  country: string
  city?: string
  region?: string
  level: Level
  /** Field ids, primary first. */
  fields: string[]
  /** How sure the field assignment is: 1 = official subject code, lower = from the title. */
  fieldConfidence: number
  languages?: string[]
  tuition?: Tuition
  durationYears?: number
  mode?: 'full-time' | 'part-time' | 'both' | 'distance'
  url?: string
  institutionUrl?: string
  earnings?: { median: number; currency: string; yearsAfter: number }
  debt?: { median: number; currency: string }
  admissionRate?: number
  selective?: boolean
  capacity?: number
  public?: boolean
  /** Who can apply (Switzerland: which Matura). */
  admission?: string
  /** Swiss institution type: uni, eth, fh, ph. */
  institutionType?: string
  source: string
  /** ISO date the programme first appeared in our data. */
  firstSeen?: string
  updated: string
}

export interface Tuition {
  currency: string
  /** Fee for students from the country (US: in-state). */
  domestic?: number
  /** Fee for EU/EEA students where that differs (France, Ireland, ...). */
  eu?: number
  /** Fee for everyone else (US: out-of-state). */
  international?: number
  estimated?: boolean
  note?: string
}

export interface ProgrammeShard {
  field: string
  updated: string
  count: number
  programmes: Programme[]
}

export interface ResearchInstitution {
  id: string
  name: string
  country: string
  city?: string
  url?: string
  /** 0..1 within the country for this field. */
  strength: number
  works: number
}

export interface ResearchShard {
  field: string
  updated: string
  byCountry: Record<string, ResearchInstitution[]>
}

export interface SourceStatus {
  id: string
  name: string
  countries: string[]
  ok: boolean
  count: number
  fetchedAt?: string
  error?: string
  url: string
  licence: string
}

export interface DataMeta {
  updated: string
  sources: SourceStatus[]
  /** EUR per unit of each currency. */
  fx: Record<string, number>
  /** Programme counts per field and country. */
  counts: Record<string, Record<string, number>>
  totals: { programmes: number; countries: number; institutions: number; newLast90Days: number }
  unclassified: number
}

export interface FieldStat {
  programmes: number
  countries: number
  /** Median US earnings for bachelor's graduates, 1 year after (USD). */
  usMedianEarnings?: number
  /** Rank of usMedianEarnings among fields (0..1). */
  salaryPercentile?: number
}

/** Stable short id from the identifying parts of a programme. */
export function programmeId(parts: Array<string | number | undefined>): string {
  const s = parts.map((p) => String(p ?? '').toLowerCase().trim()).join('|')
  // FNV-1a, 52 bits, base36: stable across runs and platforms.
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0
  }
  return (h1.toString(36) + (h2 & 0xfffff).toString(36)).padStart(10, '0')
}
