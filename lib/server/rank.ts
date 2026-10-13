import 'server-only'
import { COUNTRIES, feeFor } from '../countries.ts'
import { isGenericTopic, textTopics } from '../engine/classifier.ts'
import { orderByNumber, orderedFieldIds } from '../engine/programme-fit.ts'
import type { Preferences } from '../engine/types.ts'
import type { Level, Programme } from '../programmes.ts'
import { FIELD_BY_ID } from '../taxonomy/fields.ts'
import { getMeta, getShard } from './data.ts'
import { cityMatches } from '../city-search.ts'
import { bulkDays, isNewProgramme } from '../newness.ts'
import { TYPE_LABEL, type InstType } from '../institutions.ts'

export interface RankRequest {
  /** The person's top fields with their 0..100 match. */
  fields: Array<{ id: string; score: number }>
  prefs: Preferences
  country?: string
  level?: Level | 'any'
  sort?: 'match' | 'cost' | 'earnings' | 'new'
  q?: string
  /** Part of a city's name, accents and case ignored. */
  city?: string
  /** Only these programmes, by id (at most 2000). */
  ids?: string[]
  page?: number
  pageSize?: number
  /** Your topics (lexicon keys) with 0..1 weights; no titles, nothing else. */
  topics?: Record<string, number>
}

export interface RankedProgramme extends Programme {
  match: number
  matchedField: string
  /** Your topics that this programme names, strongest first. */
  topicHits?: string[]
  /** Points those topics added; breaks ties between equal matches. */
  topicBonus?: number
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

/** A programme's topics, from its name, focus and description; cached per programme. */
const topicCache = new Map<string, string[]>()
function programmeTopics(p: Programme): string[] {
  let t = topicCache.get(p.id)
  if (!t) {
    if (topicCache.size > 200_000) topicCache.clear()
    t = textTopics(`${p.name} \n ${(p.focus ?? []).join(', ')} \n ${p.description ?? ''}`)
    topicCache.set(p.id, t)
  }
  return t
}

/**
 * Your topics this programme names, and the points they add: up to 10, so two
 * masters in the same field come apart by what they actually teach.
 */
function topicBonus(p: Programme, topics: Record<string, number>): { hits: string[]; bonus: number } {
  const core = (k: string) => k.replace(/^[ps=]:?/, '')
  const all = programmeTopics(p).filter((k) => topics[k])
  // «ungleichheit» inside «soziale ungleichheit» is the same hit, counted once.
  const hits = all
    .filter((k) => !all.some((o) => o !== k && core(o).length > core(k).length && core(o).includes(core(k))))
    .sort((a, b) => topics[b] - topics[a])
  const overlap = hits.reduce((s, k) => s + topics[k], 0)
  return { hits: hits.slice(0, 5), bonus: 10 * (1 - Math.exp(-overlap / 0.8)) }
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
    institutionType: typeof p.institutionType === 'string' && Object.hasOwn(TYPE_LABEL, p.institutionType) ? p.institutionType as InstType : undefined,
    countries: Array.isArray(p.countries) ? p.countries.filter((c) => typeof c === 'string' && /^[A-Z]{2}$/.test(c)).slice(0, 60) : [],
    maxTuitionEur: Math.max(0, Number(p.maxTuitionEur) || 0),
    origin: (['eu', 'us', 'uk', 'ch', 'other'] as const).includes(p.origin as never) ? (p.origin as Preferences['origin']) : 'eu',
    englishOnly: !!p.englishOnly,
  }
  const topics: Record<string, number> = {}
  if (b.topics && typeof b.topics === 'object') {
    for (const [k, v] of Object.entries(b.topics as Record<string, unknown>).slice(0, 100)) {
      const n = Number(v)
      if (k.length <= 60 && !isGenericTopic(k) && Number.isFinite(n) && n > 0) topics[k] = Math.min(1, n)
    }
  }
  return {
    fields,
    prefs,
    topics: Object.keys(topics).length ? topics : undefined,
    country: typeof b.country === 'string' && /^[A-Z]{2}$/.test(b.country) ? b.country : undefined,
    level: typeof b.level === 'string' ? (b.level as Level | 'any') : undefined,
    sort: (['match', 'cost', 'earnings', 'new'] as const).includes(b.sort as never) ? (b.sort as RankRequest['sort']) : 'match',
    q: typeof b.q === 'string' ? b.q.slice(0, 80) : undefined,
    city: typeof b.city === 'string' && b.city.trim() ? b.city.trim().slice(0, 60) : undefined,
    ids: Array.isArray(b.ids) && b.ids.length
      ? b.ids.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 40).slice(0, 2000)
      : undefined,
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

  // A search looks through every field: a programme is found by its name, not only in the person's own fields.
  const searching = !!(req.q || req.city)
  const shards = await Promise.all((searching ? Object.keys(FIELD_BY_ID) : req.fields.map((f) => f.id)).map((id) => getShard(id)))
  for (const shard of shards) {
    if (!shard) continue
    for (const p of shard.programmes) {
      // Its best requested field decides; secondary fields count a little less.
      // A programme whose focus also covers another of your fields gets a bit
      // on top, so two masters in the same subject come apart by focus.
      let best = 0
      let bestField = ''
      const vs: number[] = []
      p.fields.forEach((fid, i) => {
        const s = scoreOf.get(fid)
        if (s === undefined) return
        const v = s * (i === 0 ? 1 : 0.85) * (0.85 + 0.15 * p.fieldConfidence)
        vs.push(v)
        if (v > best) {
          best = v
          bestField = fid
        }
      })
      vs.sort((a, b) => b - a)
      if (vs.length > 1) best = Math.min(99, best + 0.08 * vs[1])
      const prev = byId.get(p.id)
      if (prev && prev.match >= best) continue
      const fee = feeFor(p, req.prefs.origin)
      byId.set(p.id, {
        ...p,
        match: Math.round(best),
        matchedField: bestField || p.fields[0] || '',
        fee: fee ? { ...fee, eur: Math.round(fee.amount * (fx[fee.currency] ?? 1)) } : undefined,
        isNew: false,
      })
    }
  }

  // Whether a programme is new is decided once all programmes of the request are known: days of bulk imports do not count.
  const bulk = bulkDays([...byId.values()].map((p) => p.firstSeen))
  for (const p of byId.values()) p.isNew = isNewProgramme(p.firstSeen, cutoff, bulk)

  const levels = LEVELS_FOR[req.prefs.level]
  const q = req.q?.toLowerCase().trim()
  const onlyIds = req.ids ? new Set(req.ids) : null
  const base = [...byId.values()].filter((p) => {
    if (onlyIds && !onlyIds.has(p.id)) return false
    if (levels && !levels.includes(p.level)) return false
    if (req.prefs.institutionType && p.institutionType !== req.prefs.institutionType) return false
    if (req.prefs.countries.length && !req.prefs.countries.includes(p.country)) return false
    if (req.prefs.maxTuitionEur && p.fee && p.fee.eur > req.prefs.maxTuitionEur) return false
    if (req.prefs.englishOnly && !(p.languages ?? []).includes('en')) return false
    if (q && !`${p.name} ${p.institution} ${p.city ?? ''}`.toLowerCase().includes(q)) return false
    if (req.city && !cityMatches(p.city, req.city)) return false
    return true
  })
  if (req.topics) {
    for (const p of base) {
      const { hits, bonus } = topicBonus(p, req.topics)
      if (!hits.length) continue
      p.topicHits = hits
      p.topicBonus = Math.round(bonus * 10) / 10
      p.match = Math.min(100, Math.round(p.match + bonus))
    }
  }

  const facets: RankResult['facets'] = { countries: {}, levels: {}, fields: {} }
  for (const p of base) {
    facets.countries[p.country] = (facets.countries[p.country] ?? 0) + 1
    facets.levels[p.level] = (facets.levels[p.level] ?? 0) + 1
    facets.fields[p.matchedField] = (facets.fields[p.matchedField] ?? 0) + 1
  }
  const filtered = base.filter((p) => (!req.country || p.country === req.country) && (!req.level || req.level === 'any' || p.level === req.level))

  const sorters: Record<NonNullable<RankRequest['sort']>, (a: RankedProgramme, b: RankedProgramme) => number> = {
    match: (a, b) => b.match - a.match || (b.topicBonus ?? 0) - (a.topicBonus ?? 0) || (b.earnings?.median ?? 0) - (a.earnings?.median ?? 0) || a.name.localeCompare(b.name),
    cost: (a, b) => (a.fee?.eur ?? Infinity) - (b.fee?.eur ?? Infinity) || b.match - a.match,
    earnings: (a, b) => (b.earnings?.median ?? -1) - (a.earnings?.median ?? -1) || b.match - a.match,
    new: (a, b) => (b.firstSeen ?? '').localeCompare(a.firstSeen ?? '') || b.match - a.match,
  }
  filtered.sort(sorters[req.sort ?? 'match'])
  const ordered = (req.sort ?? 'match') === 'match' ? orderByNumber(filtered, (p) => p.match, orderedFieldIds(req.fields)) : filtered

  const pageSize = req.pageSize ?? 40
  const page = req.page ?? 0
  return {
    total: filtered.length,
    page,
    pageSize,
    items: ordered.slice(page * pageSize, (page + 1) * pageSize),
    facets,
    updated: meta?.updated,
    sample,
  }
}

/** What the free tier sees: how much there is, and a few examples. */
export async function teaser(req: RankRequest) {
  // Compute the actual best match with all fields before removing the paid
  // field. Otherwise a programme from field #2 can reveal programme #1.
  const best = await rank({ ...req, sort: 'match', page: 0, pageSize: 1 })
  // Readings can choose another programme within this field. Keep the entire
  // highest available field private, also when the first field has no results.
  const bestField = best.items[0]?.matchedField
  const fields = req.fields.filter((f) => f.id !== req.fields[0].id && f.id !== bestField)
  const full = await rank({ ...req, fields, sort: 'match', page: 0, pageSize: 4 })
  const { meta } = await getMeta()
  const programmeCountries = Object.keys(COUNTRIES).filter((c) => COUNTRIES[c].programmeData)
  return {
    total: full.total,
    facets: full.facets,
    samples: full.items.filter((p) => p.id !== best.items[0]?.id && !p.fields.includes(req.fields[0].id) && (!bestField || !p.fields.includes(bestField))).slice(0, 3),
    sample: full.sample,
    updated: full.updated,
    coverage: {
      programmeCountries,
      totals: meta?.totals,
      fields: fields.map((f) => ({ id: f.id, name: FIELD_BY_ID[f.id]?.name, total: Object.values(meta?.counts[f.id] ?? {}).reduce((s, x) => s + x, 0) })),
    },
  }
}
