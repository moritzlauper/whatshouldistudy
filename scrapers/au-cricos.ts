/**
 * Australia: CRICOS, the Commonwealth Register of Institutions and Courses for
 * Overseas Students (Department of Education, data.gov.au, CC BY 2.5 AU).
 * Every course an international student can enrol in, with its level, the
 * field of education (ASCED, «090701 - Psychology»), duration, language and
 * the full tuition fee for international students. Course locations give the
 * city. Only current bachelor's, master's and doctoral degrees are kept.
 *
 * The resource ids change with each monthly export, so the CSV links are read
 * from the dataset on every run.
 */
import { join } from 'node:path'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, cleanTitle, csvObjects, fetchRetry, fieldsForTitle, getJson, isMain, log, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const PACKAGE = 'https://data.gov.au/data/api/3/action/package_show?id=cricos'

/** CRICOS course level → our level; null for everything that isn't a degree. */
export function auLevel(level: string): Level | null {
  const l = level.toLowerCase()
  if (/doctoral/.test(l)) return 'doctorate'
  if (/masters.*extended/.test(l)) return 'professional'
  if (/masters/.test(l)) return 'master'
  if (/bachelor/.test(l)) return 'bachelor'
  if (/associate degree/.test(l)) return 'short'
  return null
}

const money = (s?: string) => {
  const n = Number((s ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** «090701 - Psychology» → «Psychology». */
const fieldName = (s?: string) => (s ?? '').replace(/^\d+\s*-\s*/, '').trim()

const STATES: Record<string, string> = {
  ACT: 'Australian Capital Territory', NSW: 'New South Wales', NT: 'Northern Territory', QLD: 'Queensland', SA: 'South Australia', TAS: 'Tasmania', VIC: 'Victoria', WA: 'Western Australia',
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

export interface AuTables {
  courses: Array<Record<string, string>>
  institutions: Array<Record<string, string>>
  courseLocations: Array<Record<string, string>>
}

export function parseCricos(t: AuTables, fetchedAt: string): { programmes: Programme[]; unclassified: number } {
  const inst = new Map(t.institutions.map((i) => [i['CRICOS Provider Code'], i]))
  const where = new Map<string, { city: string; state: string }>()
  for (const l of t.courseLocations) {
    const key = `${l['CRICOS Provider Code']}|${l['CRICOS Course Code']}`
    if (!where.has(key) && l['Location City']) where.set(key, { city: titleCase(l['Location City']), state: l['Location State'] })
  }
  const programmes: Programme[] = []
  let unclassified = 0
  for (const c of t.courses) {
    if (/^yes$/i.test(c['Expired'] ?? '')) continue
    const level = auLevel(c['Course Level'] ?? '')
    if (!level) continue
    const name = cleanTitle(c['Course Name'] ?? '')
    if (!name) continue
    // The detailed field of education names the subject in plain English; the title decides between two.
    const foe = [c['Field of Education 1 Detailed Field'], c['Field of Education 2 Detailed Field']].map(fieldName).filter(Boolean)
    const fromField = fieldsForTitle(foe.join(' '))
    const { fields, confidence } = fieldsForTitle(`${name} ${foe.join(' ')}`, fromField.fields)
    if (!fields.length) {
      unclassified++
      continue
    }
    const provider = c['CRICOS Provider Code']
    const i = inst.get(provider)
    const loc = where.get(`${provider}|${c['CRICOS Course Code']}`)
    const weeks = Number(c['Duration (Weeks)']) || 0
    const years = weeks ? Math.round((weeks / 52) * 2) / 2 : undefined
    const total = money(c['Tuition Fee'])
    const perYear = total && years ? Math.round(total / Math.max(1, years)) : undefined
    const site = (i?.['Website'] ?? '').trim()
    programmes.push({
      id: programmeId(['au', provider, c['CRICOS Course Code']]),
      name,
      institution: (i?.['Trading Name'] || c['Institution Name'] || '').replace(/\s*\([^)]*\)\s*$/, '').trim(),
      country: 'AU',
      city: loc?.city,
      region: loc ? (STATES[loc.state] ?? loc.state) : undefined,
      level,
      fields,
      fieldConfidence: Math.round(Math.max(confidence, fromField.fields.includes(fields[0]) ? 0.9 : 0) * 100) / 100,
      languages: /english/i.test(c['Course Language'] ?? '') ? ['en'] : undefined,
      tuition: perYear ? { currency: 'AUD', international: perYear, note: 'Tuition for international students, per year (CRICOS)' } : undefined,
      durationYears: years,
      mode: 'full-time',
      institutionUrl: site ? (/^https?:\/\//.test(site) ? site : `https://${site}`) : undefined,
      public: i ? /government/i.test(i['Institution Type'] ?? '') : undefined,
      source: 'au-cricos',
      updated: fetchedAt,
    })
  }
  return { programmes, unclassified }
}

async function csv(url: string): Promise<Array<Record<string, string>>> {
  const text = await (await fetchRetry(url)).text()
  return csvObjects(text.replace(/^﻿/, ''))
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const pkg = await getJson<{ result: { resources: Array<{ name: string; url: string; format: string }> } }>(PACKAGE)
  const find = (re: RegExp) => {
    const r = pkg.result.resources.find((x) => /csv/i.test(x.format) && re.test(x.name))
    if (!r) throw new Error(`CRICOS: no resource matching ${re}`)
    return r.url
  }
  const [courses, institutions, courseLocations] = await Promise.all([csv(find(/^CRICOS Courses/i)), csv(find(/^CRICOS Institutions/i)), csv(find(/^CRICOS Course Locations/i))])
  log(`CRICOS: ${courses.length} courses, ${institutions.length} institutions, ${courseLocations.length} course locations`)
  const { programmes, unclassified } = parseCricos({ courses, institutions, courseLocations }, fetchedAt)
  log(`CRICOS: ${programmes.length} degrees, ${unclassified} without a field`)
  if (programmes.length < 2000) throw new Error(`only ${programmes.length} degrees, the export may have changed`)
  const out: ScrapeOutput = { source: 'au-cricos', fetchedAt, programmes }
  writeJson(join(OUT, 'au-cricos.json'), out)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
