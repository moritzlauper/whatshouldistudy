/**
 * A university whose programme list is read from its own website, for the
 * countries without an openly licensed national list (Germany, Austria).
 * Same rules as in scrapers/ch-hochschulen.ts: facts only (name, level,
 * language, credits, duration, names of specialisations, link), no texts,
 * robots.txt respected, one request every 1.5 seconds.
 *
 * Readers get the raw HTML (or JSON) of a list or programme page and return
 * what they found; the shared helpers live in scrapers/ch-hochschulen.ts.
 */
import type { Level } from '../../lib/programmes.ts'
import type { Listed } from '../ch-hochschulen.ts'

export type SiteType = 'uni' | 'tu' | 'fh' | 'art' | 'ph'

export interface SiteSource {
  country: 'DE' | 'AT'
  /** Short stable id, e.g. 'lmu', 'univie'. */
  id: string
  name: string
  type: SiteType
  city: string
  /** Bundesland, e.g. 'BY', 'W'. */
  region: string
  url: string
  /** Teaching languages when a programme doesn't say. */
  languages: string[]
  lists: Array<{ url: string; level: Level; read: (html: string, base: string, level: Level) => Listed[] }>
  detail?: (html: string) => Partial<Listed>
  /** Only these levels get their own page read. */
  detailLevels?: Level[]
}
