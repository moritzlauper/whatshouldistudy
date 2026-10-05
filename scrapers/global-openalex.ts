/**
 * Worldwide: research profiles of universities from OpenAlex (CC0). For every
 * higher-education institution in ~65 countries, its main research topics with
 * publication counts. That tells us, for any country without programme-level
 * data, which universities are strong in a field, a good proxy for where
 * a field is taught seriously, especially at master's level.
 *
 * Optional: OPENALEX_API_KEY, OPENALEX_EMAIL (polite pool).
 */
import { join } from 'node:path'
import { COUNTRIES } from '../lib/countries.ts'
import type { ResearchInstitution } from '../lib/programmes.ts'
import { FIELDS } from '../lib/taxonomy/fields.ts'
import { OUT, getJson, isMain, log, sleep, writeJson } from './lib/common.ts'

const API = 'https://api.openalex.org/institutions'
const PER_COUNTRY = 600

export interface RawInstitution {
  id: string
  display_name: string
  country_code?: string
  homepage_url?: string | null
  works_count?: number
  geo?: { city?: string | null }
  topics?: Array<{ count: number; subfield?: { id: string }; field?: { id: string } }>
}

const lastNum = (id?: string) => Number((id ?? '').split('/').pop())

/** Per field, per country: institutions ranked by publications in the field's subfields. */
export function rankInstitutions(insts: RawInstitution[]): Record<string, Record<string, ResearchInstitution[]>> {
  const out: Record<string, Record<string, ResearchInstitution[]>> = {}
  const fieldCodes = FIELDS.map((f) => ({ id: f.id, sub: new Set(f.openalex.filter((x) => x >= 1000)), top: new Set(f.openalex.filter((x) => x < 100)) }))
  const byCountry = new Map<string, Array<{ inst: RawInstitution; scores: Map<string, number> }>>()
  for (const inst of insts) {
    const cc = inst.country_code?.toUpperCase()
    if (!cc || !inst.topics?.length) continue
    const scores = new Map<string, number>()
    for (const t of inst.topics) {
      const sub = lastNum(t.subfield?.id)
      const fld = lastNum(t.field?.id)
      for (const f of fieldCodes) {
        if (f.sub.has(sub) || f.top.has(fld)) scores.set(f.id, (scores.get(f.id) ?? 0) + t.count)
      }
    }
    const list = byCountry.get(cc) ?? []
    list.push({ inst, scores })
    byCountry.set(cc, list)
  }
  for (const f of FIELDS) {
    const perCountry: Record<string, ResearchInstitution[]> = {}
    for (const [cc, list] of byCountry) {
      const ranked = list
        .map(({ inst, scores }) => ({ inst, s: scores.get(f.id) ?? 0 }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 15)
      if (!ranked.length) continue
      const max = ranked[0].s
      perCountry[cc] = ranked.map(({ inst, s }) => ({
        id: inst.id.split('/').pop()!,
        name: inst.display_name,
        country: cc,
        city: inst.geo?.city ?? undefined,
        url: inst.homepage_url ?? undefined,
        strength: Math.round((s / max) * 100) / 100,
        works: s,
      }))
    }
    out[f.id] = perCountry
  }
  return out
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const key = process.env.OPENALEX_API_KEY
  const mail = process.env.OPENALEX_EMAIL
  const auth = `${key ? `&api_key=${key}` : ''}${mail ? `&mailto=${encodeURIComponent(mail)}` : ''}`
  const select = 'id,display_name,country_code,homepage_url,works_count,geo,topics'
  const all: RawInstitution[] = []
  const countries = (process.env.OPENALEX_COUNTRIES?.split(',') ?? Object.keys(COUNTRIES)).map((c) => c.trim().toUpperCase())
  for (const cc of countries) {
    let cursor = '*'
    let n = 0
    while (cursor && n < PER_COUNTRY) {
      const res = await getJson<{ results: RawInstitution[]; meta: { next_cursor: string | null } }>(
        `${API}?filter=country_code:${cc.toLowerCase()},type:education&sort=works_count:desc&per_page=200&select=${select}&cursor=${encodeURIComponent(cursor)}${auth}`,
      )
      all.push(...res.results)
      n += res.results.length
      cursor = res.results.length === 200 ? (res.meta.next_cursor ?? '') : ''
      await sleep(150)
    }
    log(`OpenAlex: ${cc} ${n} institutions`)
  }
  const ranked = rankInstitutions(all)
  writeJson(join(OUT, 'global-openalex.json'), { source: 'global-openalex', fetchedAt, institutions: all.length, byField: ranked })
  log(`OpenAlex: ${all.length} institutions ranked for ${Object.keys(ranked).length} fields`)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
