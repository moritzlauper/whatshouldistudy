/**
 * Switzerland: median income one year after graduating, from the BFS graduate
 * survey (Befragung der Hochschulabsolventinnen und -absolventen, EHA). The
 * table «Standardisiertes Bruttoerwerbseinkommen der Hochschulabsolvent/-innen
 * ein Jahr nach Studienabschluss» is an .xlsx with one sheet per breakdown; we
 * read the two by subject and sex (universities by subject group, FH and PH by
 * subject area) and take the median for people working in Switzerland.
 *
 * opendata.swiss finds the current release; the known one is the fallback.
 * Open use, source must be credited: «Quelle: BFS».
 */
import { join } from 'node:path'
import { FH_NAMES, UH_NAMES } from '../lib/ch-salary.ts'
import type { ChSalaryTable } from '../lib/ch-salary.ts'
import { OUT, fetchRetry, getJson, isMain, log, writeJson } from './lib/common.ts'
import { readXlsx } from './lib/xlsx.ts'
import type { Sheet } from './lib/xlsx.ts'

const CKAN = 'https://ckan.opendata.swiss/api/3/action'
const FALLBACK = 'https://dam-api.bfs.admin.ch/hub/api/dam/assets/36732661/master'

interface Row {
  labels: string[]
  median?: number
}

/** Data rows of a BFS table, with labels carried down and the «Schweiz» median. */
function tableRows(sheet: Sheet): Row[] {
  const rows = sheet.rows
  const head = rows.slice(0, 12)
  const medianRow = head.findIndex((r) => r.some((c) => /^(m[ée]diane?|mediana)$/i.test(c)))
  if (medianRow < 0) return []
  const swissCol = head.flatMap((r) => r.map((c, i) => (/^(schweiz|suisse|svizzera)$/i.test(c) ? i : -1))).find((i) => i >= 0) ?? 0
  const medianCol = rows[medianRow].findIndex((c, i) => i >= swissCol && /^(m[ée]diane?|mediana)$/i.test(c))
  const firstMetric = rows[medianRow].findIndex((c) => /quartil|m[ée]dian/i.test(c))
  if (medianCol < 0 || firstMetric < 1) return []
  const out: Row[] = []
  const carry: string[] = []
  for (const r of rows.slice(medianRow + 1)) {
    const v = r[medianCol] ?? ''
    if (!v || !/^[\d.]+$|^\*+$|^\.$/.test(v)) continue
    for (let i = 0; i < firstMetric; i++) {
      if (r[i]) {
        carry[i] = r[i]
        carry.length = i + 1
      }
    }
    const n = Number(v)
    out.push({ labels: carry.slice(0, firstMetric), median: /^[\d.]+$/.test(v) && n > 1000 ? Math.round(n) : undefined })
  }
  return out
}

const LEVEL: Array<[RegExp, 'bachelor' | 'master' | 'doctorate' | 'diploma']> = [
  [/^bachelor/i, 'bachelor'],
  [/^master/i, 'master'],
  [/^(doktorat|doctorat|dottorato)/i, 'doctorate'],
  [/(lehrdiplom|dipl[ôo]me d.enseignement|diploma d.insegnamento)/i, 'diploma'],
]

export function parseSalaryWorkbook(sheets: Sheet[], fetchedAt: string, url: string): ChSalaryTable {
  const t: ChSalaryTable = { fetchedAt, url, uh: {}, fh: {} }
  const title = (s: Sheet) => s.rows[0]?.[0] ?? ''
  const bySex = sheets.filter((s) => /(sexe|geschlecht|sesso)/i.test(title(s)))
  const uhSheet = bySex.find((s) => /\b(HEU|UH|SUP|universit)/i.test(title(s)) && !/\b(HES|FH)\b/.test(title(s)))
  const fhSheet = bySex.find((s) => /\b(HES|FH|SUP)\b/.test(title(s)) && /\b(HEP|PH|ASP)\b/.test(title(s)))
  t.year = /\b(20\d\d)\b/.exec([uhSheet, fhSheet].map((s) => s?.rows[1]?.[0] ?? '').join(' '))?.[1]
  for (const [sheet, kind] of [
    [uhSheet, 'uh'],
    [fhSheet, 'fh'],
  ] as const) {
    if (!sheet) {
      log(`CH salaries: no ${kind} sheet found`)
      continue
    }
    log(`CH salaries: ${kind} from «${title(sheet).slice(0, 90)}…»`)
    for (const row of tableRows(sheet)) {
      row.labels = row.labels.map((l) => (l ?? '').replace(/\s+/g, ' ').trim())
      const sex = row.labels.at(-1) ?? ''
      if (!/^total$/i.test(sex) || !row.median) continue
      const level = LEVEL.find(([re]) => row.labels.some((l) => re.test(l)))?.[1]
      const names = kind === 'uh' ? UH_NAMES : FH_NAMES
      const key = row.labels.slice(0, -1).map((l) => names.find(([, re]) => re.test(l))?.[0]).find(Boolean)
      if (!level || !key) continue
      const bucket = ((t[kind] as Record<string, Record<string, number>>)[key] ??= {})
      bucket[level] = row.median
    }
  }
  return t
}

async function findAsset(): Promise<string> {
  try {
    const q = encodeURIComponent('Standardisiertes Bruttoerwerbseinkommen Hochschulabsolvent ein Jahr nach Studienabschluss')
    const r = await getJson<{ result: { results: Array<{ title?: Record<string, string>; resources?: Array<{ format?: string; url?: string; download_url?: string }> }> } }>(
      `${CKAN}/package_search?q=${q}&rows=10`,
    )
    for (const p of r.result.results) {
      if (!/bruttoerwerbseinkommen.*ein jahr nach/i.test(p.title?.de ?? '')) continue
      const res = p.resources?.find((x) => /xls/i.test(x.format ?? '') && /dam-api/.test(x.download_url ?? x.url ?? ''))
      if (res) return res.download_url ?? res.url!
    }
  } catch (e) {
    log(`CH salaries: opendata.swiss search failed (${(e as Error).message}), using the known release`)
  }
  return FALLBACK
}

async function main() {
  const url = await findAsset()
  log(`CH salaries: ${url}`)
  const data = new Uint8Array(await (await fetchRetry(url)).arrayBuffer())
  const table = parseSalaryWorkbook(readXlsx(data), new Date().toISOString(), url)
  const n = Object.keys(table.uh).length + Object.keys(table.fh).length
  log(`CH salaries: year ${table.year}, ${Object.keys(table.uh).length} university groups, ${Object.keys(table.fh).length} FH/PH areas`)
  log(JSON.stringify(table))
  if (n < 8) throw new Error(`only ${n} groups recognised, the table layout may have changed`)
  writeJson(join(OUT, 'ch-salaries.json'), table, true)
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
