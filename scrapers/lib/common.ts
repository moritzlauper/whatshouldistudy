import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIELDS } from '../../lib/taxonomy/fields.ts'
import { classify } from '../../lib/engine/classifier.ts'
import type { Programme } from '../../lib/programmes.ts'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const OUT = join(ROOT, 'scrapers', 'out')
export const FIXTURES = join(ROOT, 'scrapers', 'fixtures')

const UA = 'whatshouldistudy-data/1.0 (+https://github.com; open data aggregation)'

export function log(...args: unknown[]) {
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args)
}

/** fetch with retries and backoff; throws on final failure. */
export async function fetchRetry(url: string, init: RequestInit = {}, tries = 4): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } })
      if (res.ok) return res
      if (res.status === 429 || res.status >= 500) {
        // Some APIs answer an hourly limit with retry-after: 3600; don't sit on that.
        const wait = Math.min(Number(res.headers.get('retry-after')) || 2 ** i * 2, 60)
        log(`HTTP ${res.status} for ${redact(url)}, retrying in ${wait}s`)
        await sleep(wait * 1000)
        lastErr = new Error(`HTTP ${res.status}`)
        continue
      }
      throw new Error(`HTTP ${res.status} for ${redact(url)}: ${(await res.text()).slice(0, 300)}`)
    } catch (e) {
      lastErr = e
      if (i < tries - 1) await sleep(2 ** i * 2000)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  return (await (await fetchRetry(url, init)).json()) as T
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Keeps API keys out of logs. */
export function redact(url: string): string {
  return url.replace(/(api_key|apikey|key|token)=[^&]+/gi, '$1=***')
}

export function writeJson(path: string, data: unknown, pretty = false) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, pretty ? 2 : 0))
}

export function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export function isMain(metaUrl: string): boolean {
  return process.argv[1] === fileURLToPath(metaUrl)
}

export interface ScrapeOutput {
  source: string
  fetchedAt: string
  programmes: Programme[]
  notes?: string[]
}

/** RFC 4180 CSV (quoted fields, doubled quotes, CRLF). */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  row.push(field)
  if (row.length > 1 || row[0] !== '') rows.push(row)
  return rows
}

/** CSV rows as objects keyed by upper-cased header. */
export function csvObjects(text: string, delimiter = ','): Array<Record<string, string>> {
  const rows = parseCsv(text, delimiter)
  const header = (rows[0] ?? []).map((h) => h.trim().toUpperCase())
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

// ── Field assignment ────────────────────────────────────────────────────────

const CIP_INDEX: Array<{ prefix: string; fields: string[] }> = (() => {
  const map = new Map<string, string[]>()
  for (const f of FIELDS) {
    for (const code of f.cip) {
      const key = code.replace('.', '')
      const list = map.get(key) ?? []
      list.push(f.id)
      map.set(key, list)
    }
  }
  // Longest prefix first.
  return [...map.entries()].map(([prefix, fields]) => ({ prefix, fields })).sort((a, b) => b.prefix.length - a.prefix.length)
})()

/** Fields for a CIP code given as "1107", "11.07" or "11.0701". */
export function fieldsForCip(code: string): string[] {
  const c = code.replace('.', '')
  for (const { prefix, fields } of CIP_INDEX) if (c.startsWith(prefix)) return fields
  return []
}

const CAH_INDEX: Array<{ prefix: string; fields: string[] }> = (() => {
  const map = new Map<string, string[]>()
  for (const f of FIELDS) {
    for (const code of f.cah) {
      const list = map.get(code) ?? []
      list.push(f.id)
      map.set(code, list)
    }
  }
  return [...map.entries()].map(([prefix, fields]) => ({ prefix, fields })).sort((a, b) => b.prefix.length - a.prefix.length)
})()

export function fieldsForCah(code: string): string[] {
  for (const { prefix, fields } of CAH_INDEX) if (code.startsWith(prefix)) return fields
  return []
}

/**
 * Fields for a programme title. Candidates from an official code (if any)
 * get a boost; the title decides between them and can add a second field
 * ("Computer Science with Artificial Intelligence").
 */
export function fieldsForTitle(title: string, candidates: string[] = []): { fields: string[]; confidence: number } {
  const c = classify(title)
  const scored = FIELDS.map((f, i) => ({ id: f.id, raw: c.raw[i] + (candidates.includes(f.id) ? 2 : 0) }))
    .filter((x) => x.raw > 0)
    .sort((a, b) => b.raw - a.raw)
  if (!scored.length) return { fields: [], confidence: 0 }
  const best = scored[0].raw
  const fields = scored.filter((x) => x.raw >= best * 0.6 && x.raw >= 1.5).slice(0, 3).map((x) => x.id)
  if (!fields.length) return { fields: [], confidence: 0 }
  const confidence = Math.min(1, best / 4) * (candidates.includes(fields[0]) ? 1 : 0.85)
  return { fields, confidence: Math.round(confidence * 100) / 100 }
}

export function cleanTitle(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\.$/, '').trim()
}
