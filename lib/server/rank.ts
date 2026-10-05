import 'server-only'
import { COUNTRIES, feeFor } from '../countries.ts'
import type { Preferences } from '../engine/types.ts'
import type { Level, Programme } from '../programmes.ts'
import { FIELD_BY_ID } from '../taxonomy/fields.ts'
import { getMeta, getShard } from './data.ts'

export interface RankRequest {
  /** The person's top fields with their 0..100 match. */
  fields: Array<{ id: string; score: number }>
  prefs: Preferences
  country?: string
  level?: Level | 'any'
  sort?: 'match' | 'cost' | 'earnings' | 'new'
  q?: string
  page?: number
  pageSize?: number
}

export interface RankedProgramme extends Programme {
  match: number
  matchedField: string
  fee?: { amount: number; currency: string; eur: number; estimated: boolean }
  isNew: boolean
}

export interface RankResult {
  total: number
  page: number
  pageSize: number
  items: RankedProgramme[]
  facets: { countries: Record<string, number>; levels: Record<string, number>; fields: Record<string, number> }
  updated?: string
  sample: boolean
}

const LEVELS_FOR: Record<Preferences['level'], Level[] | null> = {
  bachelor: ['bachelor', 'integrated', 'short', 'professional'],
  master: ['master', 'integrated', 'professional', 'doctorate'],
  any: null,
}

export function sanitizeRequest(body: unknown): RankRequest | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const fields = Array.isArray(b.fields)
    ? (b.fields as Array<{ id?: unknown; score?: unknown }>)
        .filter((f) => typeof f.id === 'string' && FIELD_BY_ID[f.id as string])
        .slice(0, 8)
        .map((f) => ({ id: f.id as string, score: Math.max(0, Math.min(100, Number(f.score) || 0)) }))
    : []
  if (!fields.length) return null
  const p = (b.prefs ?? {}) as Partial<Preferences>
  const prefs: Preferences = {
    level: p.level === 'master' || p.level === 'any' ? p.level : 'bachelor',
    countries: Array.isArray(p.countries) ? p.countries.filter((c) => typeof c === 'string' && /^[A-Z]{2}$/.test(c)).slice(0, 60) : [],
    maxTuitionEur: Math.max(0, Number(p.maxTuitionEur) || 0),
    origin: (['eu', 'us', 'uk', 'ch', 'other'] as const).includes(p.origin as never) ? (p.origin as Preferences['origin']) : 'eu',
    englishOnly: !!p.englishOnly,
  }
  return {
    fields,
    prefs,
    country: typeof b.country === 'string' && /^[A-Z]{2}$/.test(b.country) ? b.country : undefined,
    level: typeof b.level === 'string' ? (b.level as Level | 'any') : undefined,
    sort: (['match', 'cost', 'earnings', 'new'] as const).includes(b.sort as never) ? (b.sort as RankRequest['sort']) : 'match',
    q: typeof b.q === 'string' ? b.q.slice(0, 80) : undefined,
    page: Math.max(0, Math.floor(Number(b.page) || 0)),
    pageSize: Math.max(1, Math.min(2000, Math.floor(Number(b.pageSize) || 40))),
  }
}

export async function rank(req: RankRequest): Promise<RankResult> {
  const { meta, sample } = await getMeta()
  const fx = meta?.fx ?? { EUR: 1, USD: 0.92, GBP: 1.17 }
  const scoreOf = new Map(req.fields.map((f) => [f.id, f.score]))
  const byId = new Map<string, RankedProgramme>()
  const cutoff = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)

  const shards = await Promise.all(req.fields.map((f) => getShard(f.id)))
  for (const shard of shards) {
    if (!shard) continue
    for (const p of shard.programmes) {
      // Its best requested field decides; secondary fields count a little less.
      let best = 0
      let bestField = ''
      p.fields.forEach((fid, i) => {
        const s = scoreOf.get(fid)
        if (s === undefined) return
        const v = s * (i === 0 ? 1 : 0.85) * (0.85 + 0.15 * p.fieldConfidence)
        if (v > best) {
          best = v
          bestField = fid
        }
      })
      const prev = byId.get(p.id)
      if (prev && prev.match >= best) continue
      const fee = feeFor(p, req.prefs.origin)
      byId.set(p.id, {
        ...p,
        match: Math.round(best),
        matchedField: bestField,
        fee: fee ? { ...fee, eur: Math.round(fee.amount * (fx[fee.currency] ?? 1)) } : undefined,
        isNew: (p.firstSeen ?? '') >= cutoff && p.firstSeen !== '2000-01-01',
      })
    }
  }

  const levels = LEVELS_FOR[req.prefs.level]
  const q = req.q?.toLowerCase().trim()
  const base = [...byId.values()].filter((p) => {
    if (levels && !levels.includes(p.level)) return false
    if (req.prefs.countries.length && !req.prefs.countries.includes(p.country)) return false
    if (req.prefs.maxTuitionEur && p.fee && p.fee.eur > req.prefs.maxTuitionEur) return false
    if (req.prefs.englishOnly && !(p.languages ?? []).includes('en')) return false
    if (q && !`${p.name} ${p.institution} ${p.city ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })

  const facets: RankResult['facets'] = { countries: {}, levels: {}, fields: {} }
  for (const p of base) {
    facets.countries[p.country] = (facets.countries[p.country] ?? 0) + 1
    facets.levels[p.level] = (facets.levels[p.level] ?? 0) + 1
    facets.fields[p.matchedField] = (facets.fields[p.matchedField] ?? 0) + 1
  }
  const filtered = base.filter((p) => (!req.country || p.country === req.country) && (!req.level || req.level === 'any' || p.level === req.level))

  const sorters: Record<NonNullable<RankRequest['sort']>, (a: RankedProgramme, b: RankedProgramme) => number> = {
    match: (a, b) => b.match - a.match || (b.earnings?.median ?? 0) - (a.earnings?.median ?? 0) || a.name.localeCompare(b.name),
    cost: (a, b) => (a.fee?.eur ?? Infinity) - (b.fee?.eur ?? Infinity) || b.match - a.match,
    earnings: (a, b) => (b.earnings?.median ?? -1) - (a.earnings?.median ?? -1) || b.match - a.match,
    new: (a, b) => (b.firstSeen ?? '').localeCompare(a.firstSeen ?? '') || b.match - a.match,
  }
  filtered.sort(sorters[req.sort ?? 'match'])

  const pageSize = req.pageSize ?? 40
  const page = req.page ?? 0
  return {
    total: filtered.length,
    page,
    pageSize,
    items: filtered.slice(page * pageSize, (page + 1) * pageSize),
    facets,
    updated: meta?.updated,
    sample,
  }
}

/** What the free tier sees: how much there is, and a few examples. */
export async function teaser(req: RankRequest) {
  const full = await rank({ ...req, page: 0, pageSize: 3 })
  const { meta } = await getMeta()
  const programmeCountries = Object.keys(COUNTRIES).filter((c) => COUNTRIES[c].programmeData)
  return {
    total: full.total,
    facets: full.facets,
    samples: full.items,
    sample: full.sample,
    updated: full.updated,
    coverage: {
      programmeCountries,
      totals: meta?.totals,
      fields: req.fields.map((f) => ({ id: f.id, name: FIELD_BY_ID[f.id]?.name, total: Object.values(meta?.counts[f.id] ?? {}).reduce((s, x) => s + x, 0) })),
    },
  }
}
