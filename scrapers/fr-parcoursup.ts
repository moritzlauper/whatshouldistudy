/**
 * France: Parcoursup open data from the Ministry of Higher Education
 * (data.enseignementsup-recherche.gouv.fr, Licence Ouverte 2.0). Every
 * first-year programme in the national admissions platform: licences, BUT,
 * BTS, CPGE, engineering and business schools, nursing, PASS/L.AS, with
 * capacity, selectivity and admission rate.
 *
 * Primary dataset is the current offer ("cartographie des formations"); the
 * admissions dataset of the last session is the fallback. Column names are
 * read defensively because they have changed between yearly releases.
 */
import { join } from 'node:path'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme, Tuition } from '../lib/programmes.ts'
import { OUT, cleanTitle, fieldsForTitle, getJson, isMain, log, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const HOST = 'https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets'
const DATASETS = ['fr-esr-cartographie_formations_parcoursup', 'fr-esr-parcoursup']

type Rec = Record<string, unknown>

/** First non-empty value of the given columns; the cartographie stores many as arrays. */
const pick = (r: Rec, keys: string[]): string | undefined => {
  for (const k of keys) {
    let v = r[k]
    if (Array.isArray(v)) v = v.find((x) => typeof x === 'string' && x.trim())
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return undefined
}

const num = (r: Rec, keys: string[]): number | undefined => {
  for (const k of keys) {
    const v = r[k]
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/** Level and typical duration from the programme name. */
export function frenchLevel(name: string): { level: Level; years?: number } | null {
  const n = name.toLowerCase()
  if (/^bts|brevet de technicien|^dts|^dma/.test(n)) return { level: 'short', years: 2 }
  if (/^cpge|classe préparatoire|classe preparatoire/.test(n)) return { level: 'short', years: 2 }
  if (/^dut|^deust/.test(n)) return { level: 'short', years: 2 }
  if (/^[ée]tudes de sant[ée].*\bdts\b|\bdts\b/.test(n)) return { level: 'short', years: 3 }
  if (/mise [àa] niveau|classe de mise/.test(n)) return { level: 'short', years: 1 }
  if (/^formations d.architecture|dipl[oô]me d.[ée]tudes en architecture/.test(n)) return { level: 'bachelor', years: 3 }
  if (/^but|bachelor universitaire de technologie/.test(n)) return { level: 'bachelor', years: 3 }
  if (/^licence|^l\.as|^las\b|^pass|parcours d.acc[eè]s sp[ée]cifique sant[ée]|licence acc[eè]s sant[ée]/.test(n)) return { level: 'bachelor', years: 3 }
  if (/^dn made|diplôme national des métiers d.art|^dnmade/.test(n)) return { level: 'bachelor', years: 3 }
  if (/infirmier|ifsi|ergoth[ée]rap|psychomotric|p[ée]dicure|manipulateur|audioprothes|orthopt|^dees|^deass|[ée]ducateur|assistant de service social/.test(n)) return { level: 'bachelor', years: 3 }
  if (/ing[ée]nieur|^cycle pr[ée]paratoire int[ée]gr[ée]/.test(n)) return { level: 'integrated', years: 5 }
  if (/^bachelor|[ée]cole de commerce|management|^dcg|dipl[oô]me vis[ée]/.test(n)) return { level: 'bachelor', years: 3 }
  if (/sciences po|^iep/.test(n)) return { level: 'integrated', years: 5 }
  if (/^dcca|^deca|^dnsp|^dma|^dnat/.test(n)) return { level: 'bachelor', years: 3 }
  return null
}

/** Statutory fees 2025/26 (arrêté du 19 avril 2019, indexed). */
function tuitionFor(level: Level, name: string, isPublic: boolean | undefined): Tuition | undefined {
  const n = name.toLowerCase()
  if (isPublic === false) return { currency: 'EUR', estimated: true, note: 'Private institution: fees vary, often €3,000–€15,000 per year' }
  if (isPublic === undefined) return undefined
  if (/^bts|^cpge|classe pr[ée]paratoire|^dn made|^dts/.test(n)) return { currency: 'EUR', domestic: 0, eu: 0, international: 0, note: 'Free at public lycées (CVEC €105 aside)' }
  if (level === 'bachelor' || level === 'short')
    return { currency: 'EUR', domestic: 178, eu: 178, international: 2895, note: 'Many universities waive the higher non-EU fee' }
  if (level === 'integrated' && /ing[ée]nieur/.test(n)) return { currency: 'EUR', domestic: 618, eu: 618, international: 2895, estimated: true, note: 'Public engineering school' }
  return { currency: 'EUR', domestic: 178, eu: 178, international: 2895, estimated: true }
}

/** Level from anywhere in the text, for names that don't start with the type. */
function frenchLevelLoose(text: string): { level: Level; years?: number } | null {
  const t = text.toLowerCase()
  if (/\bbts\b|brevet de technicien/.test(t)) return { level: 'short', years: 2 }
  if (/\bcpge\b|classe pr[ée]paratoire/.test(t)) return { level: 'short', years: 2 }
  if (/\bbut\b|bachelor universitaire de technologie/.test(t)) return { level: 'bachelor', years: 3 }
  if (/\blicence\b|\bl\.as\b|\bpass\b/.test(t)) return { level: 'bachelor', years: 3 }
  if (/ing[ée]nieur/.test(t)) return { level: 'integrated', years: 5 }
  if (/\bbachelor\b|\bdn made\b|dipl[oô]me d.[ée]tat|\bdeust\b|\bdcg\b/.test(t)) return { level: 'bachelor', years: 3 }
  if (/certificat de sp[ée]cialisation|mention compl[ée]mentaire|\bcs\b|\bmc\b/.test(t)) return { level: 'short', years: 1 }
  if (/formation d.[ée]cole|[ée]cole/.test(t)) return { level: 'bachelor', years: 3 }
  return null
}

export const samples = { noLevel: [] as string[], noField: [] as string[] }

export function parseRecords(records: Rec[], fetchedAt: string): { programmes: Programme[]; unclassified: number } {
  const programmes: Programme[] = []
  let unclassified = 0
  const seen = new Set<string>()
  for (const r of records) {
    // Cartographie: tf = type of programme, nm/nmc = name, fl = specialisation.
    // Admissions dataset: fili, lib_for_voe_ins, form_lib_voe_acc.
    const fili = pick(r, ['fili', 'tf', 'fil_lib_voe_acc', 'type_formation']) ?? ''
    const rawName =
      pick(r, ['nm', 'lib_for_voe_ins', 'libelle_formation', 'nmc']) ??
      [pick(r, ['fil_lib_voe_acc']), pick(r, ['form_lib_voe_acc'])].filter(Boolean).join(' - ')
    const spec = pick(r, ['fl', 'form_lib_voe_acc', 'detail_forma', 'lib_comp_voe_ins']) ?? ''
    // Some names omit the type ("Informatique"); prefix it so the level shows.
    const name = cleanTitle(rawName && fili && !rawName.toLowerCase().includes(fili.toLowerCase().slice(0, 4)) ? `${fili} - ${rawName}` : rawName || [fili, spec].filter(Boolean).join(' - '))
    const institution = pick(r, ['etab_nom', 'g_ea_lib_vx', 'etablissement', 'lib_etab'])
    if (!name || !institution) continue
    const all = [fili, name, spec, pick(r, ['nmc']) ?? ''].join(' ')
    const level = frenchLevel(fili) ?? frenchLevel(name) ?? frenchLevelLoose(all)
    if (!level) {
      unclassified++
      if (samples.noLevel.length < 8) samples.noLevel.push(`${fili} | ${name}`)
      continue
    }
    const detail = [spec, pick(r, ['nmc']) ?? ''].join(' ')
    let { fields, confidence } = fieldsForTitle(`${name} ${detail}`)
    if (!fields.length) {
      // Families whose names don't say the subject.
      const f = `${name} ${fili}`.toLowerCase()
      if (/infirmier|ifsi/.test(f)) fields = ['nursing']
      else if (/[ée]ducateur|assistant de service social|efts|deass|dees/.test(f)) fields = ['social-work']
      else if (/pass|acc[eè]s sant[ée]|l\.as/.test(f)) fields = ['medicine']
      else if (/[ée]cole de commerce|management|commerce/.test(f)) fields = ['business-management']
      else if (/sciences po|iep/.test(f)) fields = ['political-science']
      // Generalist engineering schools: specialisation comes later.
      else if (/ing[ée]nieur/.test(f)) fields = ['mechanical-engineering', 'electrical-engineering', 'industrial-engineering']
      confidence = fields.length ? (fields.length > 1 ? 0.4 : 0.6) : 0
    }
    if (!fields.length) {
      unclassified++
      if (samples.noField.length < 12) samples.noField.push(`${fili} | ${name} | ${spec}`)
      continue
    }
    const uai = pick(r, ['etab_uai', 'cod_uai', 'uai'])
    const code = pick(r, ['cod_aff_form', 'cod_form', 'gti', 'gta']) ?? name
    const id = programmeId(['fr', uai ?? institution, code, name])
    if (seen.has(id)) continue
    seen.add(id)
    const contract = (pick(r, ['contrat_etab', 'tc', 'statut', 'secteur']) ?? '').toLowerCase()
    const isPublic = contract ? contract.includes('public') : undefined
    const capacity = num(r, ['capa_fin', 'capacite'])
    const rate = num(r, ['taux_acces_ens', 'taux_acces'])
    const selective = pick(r, ['select_form'])
    programmes.push({
      id,
      name,
      institution,
      country: 'FR',
      city: pick(r, ['commune', 'ville_etab', 'ville', 'lib_com']),
      region: pick(r, ['region', 'region_etab_aff', 'reg_nom']),
      level: level.level,
      fields,
      fieldConfidence: confidence,
      languages: ['fr'],
      tuition: tuitionFor(level.level, name, isPublic),
      durationYears: level.years,
      mode: /apprentissage/i.test(`${name} ${pick(r, ['app']) ?? ''}`) ? 'both' : 'full-time',
      url: pick(r, ['fiche', 'lien_form_psup', 'lien_formation']),
      institutionUrl: pick(r, ['etab_url', 'url_etab']),
      admissionRate: rate !== undefined ? rate / 100 : undefined,
      selective: selective ? /^formation s[ée]lective/i.test(selective) : undefined,
      capacity,
      public: isPublic,
      source: 'fr-parcoursup',
      updated: fetchedAt,
    })
  }
  return { programmes, unclassified }
}

async function exportDataset(id: string): Promise<Rec[]> {
  // Latest year only, when the dataset has several.
  let refine = ''
  for (const yearField of ['annee', 'session']) {
    try {
      const g = await getJson<{ results: Array<Record<string, unknown>> }>(
        `${HOST}/${id}/records?select=${yearField}&group_by=${yearField}&order_by=${yearField}%20desc&limit=1`,
      )
      const latest = g.results[0]?.[yearField]
      if (latest) {
        refine = `&refine=${yearField}:${encodeURIComponent(`"${String(latest)}"`)}`
        log(`FR: ${id} latest ${yearField} = ${latest}`)
        break
      }
    } catch {
      // field doesn't exist in this dataset
    }
  }
  return getJson<Rec[]>(`${HOST}/${id}/exports/json?limit=-1${refine}`)
}

async function main() {
  const fetchedAt = new Date().toISOString()
  let records: Rec[] = []
  let used = ''
  for (const id of DATASETS) {
    try {
      records = await exportDataset(id)
      used = id
      if (records.length) break
    } catch (e) {
      log(`FR: ${id} failed: ${(e as Error).message}`)
    }
  }
  if (!records.length) throw new Error('No Parcoursup dataset could be read')
  log(`FR: ${records.length} records from ${used}; columns: ${Object.keys(records[0]).join(', ')}`)
  for (const r of records.slice(0, 3)) log(`FR sample: ${JSON.stringify(r).slice(0, 600)}`)
  const { programmes, unclassified } = parseRecords(records, fetchedAt)
  log(`FR: ${programmes.length} programmes, ${unclassified} unclassified`)
  log(`FR without level: ${samples.noLevel.join(' || ')}`)
  log(`FR without field: ${samples.noField.join(' || ')}`)
  const out: ScrapeOutput = { source: 'fr-parcoursup', fetchedAt, programmes, notes: [`dataset ${used}`, `${unclassified} unclassified`] }
  writeJson(join(OUT, 'fr-parcoursup.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
