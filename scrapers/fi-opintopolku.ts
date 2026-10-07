/**
 * Finland: every degree programme at universities (yliopisto) and universities
 * of applied sciences (ammattikorkeakoulu) from Opintopolku / Studyinfo.fi,
 * the national study portal of the Finnish National Agency for Education.
 * Its public search API lists the programmes; each programme's page gives the
 * offering institutions, the degree level and the field as a code of the
 * national classification 2016, which is ISCED-F 2013 («0220» = humanities).
 * Names and descriptions come in English where the institution wrote them.
 *
 * Licence: Opintopolku content is open data (CC BY 4.0, Opetushallitus).
 */
import { join } from 'node:path'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, cleanTitle, fieldsForIsced, fieldsForTitle, fetchRetry, isMain, log, sleep, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const API = 'https://opintopolku.fi/konfo-backend'
const PAGE = 100
const PARALLEL = 4

type Lang = 'fi' | 'sv' | 'en'
type Text = Partial<Record<Lang, string>>

export interface FiSearchHit {
  oid: string
  nimi?: Text
  koulutustyyppi?: string
}

export interface FiDetail {
  oid: string
  nimi?: Text
  koulutustyyppi?: string
  johtaaTutkintoon?: boolean
  kielivalinta?: string[]
  koulutukset?: Array<{ koodiUri: string; nimi?: Text }>
  tarjoajat?: Array<{ oid: string; nimi?: Text; paikkakunta?: { nimi?: Text } }>
  koulutuskoodienAlatJaAsteet?: Array<{ koulutusKoodiUri?: string; koulutusalaKoodiUrit?: string[]; koulutusasteKoodiUrit?: string[] }>
  metadata?: { kuvaus?: Text; luokittelutermit?: string[]; tutkintonimike?: Array<{ nimi?: Text }> }
}

const pick = (t: Text | undefined, ...order: Lang[]) => {
  for (const l of order) {
    const v = t?.[l]?.trim()
    if (v) return v
  }
  return ''
}

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

/** Degree level from the education level codes (6 = bachelor's, 7 = master's, 8 = doctorate). */
export function fiLevel(d: FiDetail): Level | null {
  const steps = new Set<string>()
  for (const a of d.koulutuskoodienAlatJaAsteet ?? []) {
    for (const u of a.koulutusasteKoodiUrit ?? []) {
      const m = /koulutusastetaso1_(\d)/.exec(u)
      if (m) steps.add(m[1])
    }
  }
  // Fall back to the first digit of the degree code (koulutus_750702 → 7).
  if (!steps.size) for (const k of d.koulutukset ?? []) steps.add(/koulutus_(\d)/.exec(k.koodiUri)?.[1] ?? '')
  if (steps.has('6') && steps.has('7')) return 'integrated'
  if (steps.has('8')) return 'doctorate'
  if (steps.has('7')) return 'master'
  if (steps.has('6')) return 'bachelor'
  return null
}

/** ISCED-F detailed field codes (koulutusalataso3_0220 → 0220). */
export function fiIsced(d: FiDetail): string[] {
  const out = new Set<string>()
  for (const a of d.koulutuskoodienAlatJaAsteet ?? []) {
    for (const u of a.koulutusalaKoodiUrit ?? []) {
      const m = /koulutusalataso3_(\d{4})/.exec(u)
      if (m) out.add(m[1])
    }
  }
  return [...out]
}

const YEARS: Record<Level, number> = { short: 2, bachelor: 3, master: 2, integrated: 5, doctorate: 4, professional: 6 }

/** One programme row per offering institution. */
export function parseFiDetail(d: FiDetail, fetchedAt: string): Programme[] {
  if (d.johtaaTutkintoon === false) return []
  const level = fiLevel(d)
  if (!level) return []
  const name = cleanTitle(pick(d.nimi, 'en', 'fi', 'sv'))
  if (!name) return []
  const nameFi = pick(d.nimi, 'fi', 'sv')
  const codes = fiIsced(d)
  const candidates = [...new Set(codes.flatMap(fieldsForIsced))]
  const byTitle = fieldsForTitle(`${name} ${nameFi}`, candidates)
  const fields = byTitle.fields.length ? byTitle.fields : candidates.slice(0, 2)
  if (!fields.length) return []
  const confidence = byTitle.fields.length && candidates.includes(byTitle.fields[0]) ? 1 : candidates.length ? 0.8 : byTitle.confidence
  // The first language the institution wrote it in is the language it is taught in, as a rule.
  const lang = (d.kielivalinta ?? []).filter((l) => l === 'fi' || l === 'sv' || l === 'en')
  const languages = lang.length ? [lang[0]] : undefined
  const english = languages?.[0] === 'en'
  const description = stripHtml(pick(d.metadata?.kuvaus, 'en', 'fi', 'sv')).slice(0, 420) || undefined
  const uas = d.koulutustyyppi === 'amk'
  const out: Programme[] = []
  for (const t of d.tarjoajat ?? []) {
    const institution = pick(t.nimi, 'en', 'fi', 'sv')
    if (!institution) continue
    out.push({
      id: programmeId(['fi', d.oid, t.oid]),
      name,
      institution,
      country: 'FI',
      city: pick(t.paikkakunta?.nimi, 'en', 'fi', 'sv') || undefined,
      level,
      fields: fields.slice(0, 3),
      fieldConfidence: Math.round(confidence * 100) / 100,
      languages,
      tuition: {
        currency: 'EUR',
        domestic: 0,
        eu: 0,
        // EU/EEA and Swiss citizens study for free; others pay for English-taught degrees.
        international: english && level !== 'doctorate' ? 12000 : undefined,
        estimated: true,
        note: 'Free for EU/EEA and Swiss citizens; non-EU fees for English-taught degrees are about €8,000–18,000 a year',
      },
      durationYears: YEARS[level],
      mode: 'full-time',
      url: `https://opintopolku.fi/konfo/${english ? 'en' : 'fi'}/koulutus/${d.oid}`,
      public: true,
      institutionType: uas ? 'fh' : 'uni',
      focus: (d.metadata?.luokittelutermit ?? []).map(cleanTitle).filter((x) => x.length >= 3 && x.length <= 60).slice(0, 8),
      description,
      source: 'fi-opintopolku',
      updated: fetchedAt,
    })
  }
  return out
}

async function json<T>(path: string): Promise<T> {
  return (await (await fetchRetry(API + path, { headers: { Accept: 'application/json' } })).json()) as T
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const oids: string[] = []
  for (const type of ['yo', 'amk']) {
    for (let page = 1; ; page++) {
      const r = await json<{ total: number; hits: FiSearchHit[] }>(`/search/koulutukset?koulutustyyppi=${type}&size=${PAGE}&page=${page}&lng=en`)
      oids.push(...r.hits.map((h) => h.oid))
      if (page === 1) log(`Opintopolku ${type}: ${r.total} programmes`)
      if (!r.hits.length || page * PAGE >= r.total) break
      await sleep(200)
    }
  }
  const unique = [...new Set(oids)]
  const programmes: Programme[] = []
  let failed = 0
  for (let i = 0; i < unique.length; i += PARALLEL) {
    const batch = await Promise.all(unique.slice(i, i + PARALLEL).map((oid) => json<FiDetail>(`/koulutus/${oid}`).catch(() => null)))
    for (const d of batch) {
      if (!d) failed++
      else programmes.push(...parseFiDetail(d, fetchedAt))
    }
    if (i % 400 === 0) log(`  ${Math.min(i + PARALLEL, unique.length)}/${unique.length}`)
    await sleep(100)
  }
  log(`Opintopolku: ${programmes.length} programme rows from ${unique.length} programmes (${failed} not readable)`)
  if (programmes.length < 500) throw new Error(`only ${programmes.length} programmes, the API may have changed`)
  const out: ScrapeOutput = { source: 'fi-opintopolku', fetchedAt, programmes }
  writeJson(join(OUT, 'fi-opintopolku.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
