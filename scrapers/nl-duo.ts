/**
 * Netherlands: every accredited degree programme at research universities
 * (WO) and universities of applied sciences (HBO), from DUO's «HO
 * Opleidingsoverzicht» (onderwijsdata.duo.nl, licence CC BY). One row per
 * programme as offered: institution, place, study form (full-time, part-time,
 * dual), language of instruction, credits, the English name and the
 * programme's own website. The registry has no subject codes, so the field
 * comes from the English and Dutch names.
 */
import { join } from 'node:path'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, cleanTitle, csvObjects, fetchRetry, fieldsForTitle, getJson, isMain, log, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const PACKAGE = 'https://onderwijsdata.duo.nl/api/3/action/package_show?id=7c0686f4-b5c2-418e-8e44-7be0057d8084'
const FALLBACK = 'https://onderwijsdata.duo.nl/dataset/7c0686f4-b5c2-418e-8e44-7be0057d8084/resource/ffffa7ad-e6a2-4ba7-9fc2-a09df4128555/download/ho_opleidingsoverzicht.csv'

/** GRAAD → our level; postgraduate courses and the rest are no degree programmes here. */
export function nlLevel(graad: string): Level | null {
  if (graad === 'BACHELOR') return 'bachelor'
  if (graad === 'MASTER') return 'master'
  if (graad === 'ASSOCIATE_DEGREE') return 'short'
  return null
}

const BARE: Record<string, string> = { sport: 'sports-science', dans: 'performing-arts', dance: 'performing-arts' }

const LANG: Record<string, string> = { NLD: 'nl', ENG: 'en', DEU: 'de', FRA: 'fr' }
const MODE: Record<string, 'full-time' | 'part-time'> = { VOLTIJD: 'full-time', DEELTIJD: 'part-time', DUAAL: 'part-time' }

/** «2015-09-01» still current on `today`: empty means open-ended. */
const running = (end: string | undefined, today: string) => !end || end > today

/** «M Finance», «B Food Commerce VT»: the registry's short prefixes for degree and study form go. */
export const tidy = (s: string) =>
  cleanTitle(s)
    .replace(/^(?:B|M|AD|Ad)\s+(?=\p{Lu})/u, '')
    .replace(/\s+(?:VT|DT|DU)$/, '')
    .trim()

const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase()) : s)

/**
 * Programmes from the registry's rows. A programme offered full-time and
 * part-time at the same place is one row with mode «both»; at two places, two.
 */
export function parseDuo(rows: Array<Record<string, string>>, fetchedAt: string, today = fetchedAt.slice(0, 10)): { programmes: Programme[]; unclassified: number; examples: string[] } {
  const groups = new Map<string, Array<Record<string, string>>>()
  for (const r of rows) {
    // Rows without a provider describe the programme only, not where it is offered.
    if (!r.ONDERWIJSAANBIEDER_NAAM || !r.AANGEBODEN_OPLEIDINGCODE) continue
    if (!nlLevel(r.GRAAD)) continue
    if (!running(r.EINDDATUM, today) || !running(r.AANGEBODEN_OPLEIDING_EINDDATUM, today) || !running(r.LAATSTE_INSTROOMDATUM, today)) continue
    const key = [r.ERKENDEOPLEIDINGSCODE || r.OPLEIDINGSEENHEIDCODE, r.ONDERWIJSAANBIEDERID, r.ONDERWIJSLOCATIEPLAATS.toLowerCase()].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  const programmes: Programme[] = []
  let unclassified = 0
  // A sample of what found no field, for the run log.
  const examples: string[] = []
  for (const [key, rs] of groups) {
    const r = rs[0]
    const dutch = tidy(r.NAAM_LANG)
    const english = tidy(r.EIGENNAAM_ENGELS || r.INTERNATIONALE_NAAM)
    const name = english || dutch
    if (!name) continue
    // Single-word titles the lexicon keeps weak on purpose (it reads video titles too).
    const bare = BARE[(english || dutch).toLowerCase()]
    const { fields, confidence } = bare ? { fields: [bare], confidence: 0.7 } : fieldsForTitle(`${english} ${dutch}`)
    if (!fields.length) {
      unclassified++
      if (examples.length < 60) examples.push(`${english} ${dutch}`)
      continue
    }
    const level = nlLevel(r.GRAAD)!
    const ects = Number(r.STUDIELAST) || undefined
    const modes = new Set(rs.map((x) => MODE[x.VORM]).filter(Boolean))
    const langs = [...new Set(rs.map((x) => LANG[x.VOERTAAL]).filter(Boolean))]
    const site = rs.map((x) => x.WEBSITE).find((u) => /^https?:\/\//.test(u))
    const hbo = /^HBO/.test(r.NIVEAU)
    programmes.push({
      id: programmeId(['nl', ...key.split('|')]),
      name,
      institution: r.ONDERWIJSAANBIEDER_NAAM,
      country: 'NL',
      city: r.ONDERWIJSLOCATIEPLAATS ? titleCase(r.ONDERWIJSLOCATIEPLAATS) : undefined,
      level,
      fields,
      fieldConfidence: Math.round(confidence * 100) / 100,
      languages: langs.length ? langs : undefined,
      tuition: {
        currency: 'EUR',
        domestic: 2601,
        eu: 2601,
        estimated: true,
        note: 'Statutory fee 2025/26 (wettelijk collegegeld) for EU/EEA and Swiss students; others pay the institutional fee, often €9,000–20,000 a year',
      },
      durationYears: ects ? Math.round((ects / 60) * 2) / 2 : undefined,
      ects,
      mode: modes.size > 1 ? 'both' : [...modes][0],
      url: site,
      institutionType: hbo ? 'fh' : 'uni',
      // The Dutch name next to the English one, so the programme is found by both.
      focus: english && dutch && english.toLowerCase() !== dutch.toLowerCase() ? [dutch] : undefined,
      source: 'nl-duo',
      updated: fetchedAt,
    })
  }
  return { programmes, unclassified, examples }
}

async function main() {
  const fetchedAt = new Date().toISOString()
  let url = FALLBACK
  try {
    const pkg = await getJson<{ result: { resources: Array<{ name: string; url: string; format: string }> } }>(PACKAGE)
    url = pkg.result.resources.find((r) => /csv/i.test(r.format) && /opleidingsoverzicht/i.test(r.name))?.url ?? FALLBACK
  } catch (e) {
    log(`DUO: dataset lookup failed (${(e as Error).message}), using the known file`)
  }
  const rows = csvObjects(await (await fetchRetry(url)).text())
  log(`DUO: ${rows.length} rows`)
  const { programmes, unclassified, examples } = parseDuo(rows, fetchedAt)
  const byLevel: Record<string, number> = {}
  for (const p of programmes) byLevel[p.level] = (byLevel[p.level] ?? 0) + 1
  log(`DUO: ${programmes.length} programmes ${JSON.stringify(byLevel)}, ${unclassified} without a field`)
  if (examples.length) log(`  without a field, e.g.: ${examples.join(' · ')}`)
  if (programmes.length < 1500) throw new Error(`only ${programmes.length} programmes, the file may have changed`)
  const out: ScrapeOutput = { source: 'nl-duo', fetchedAt, programmes }
  writeJson(join(OUT, 'nl-duo.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
