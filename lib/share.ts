/**
 * Shareable results without a server: the aggregated result (fields,
 * percentages, profile, timeline) goes compressed into the URL fragment,
 * which browsers never send to a server. Nothing personal goes in: no video
 * titles, searches, channels or topics, only what the report computes.
 */
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import type { FieldMatch, Preferences, Results } from './engine/types.ts'

export interface Snapshot {
  v: 1
  /** Date the result was shared (YYYY-MM-DD). */
  at: string
  prefs: Pick<Preferences, 'countries' | 'level'>
  results: Results
  /** Unlock token of a paid report, so place 1 shows for the recipient too. */
  token?: string
}

const r = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d

function slim(m: FieldMatch): FieldMatch {
  return {
    id: m.id,
    match: r(m.match, 4),
    score: m.score,
    components: Object.fromEntries(Object.entries(m.components).map(([k, v]) => [k, r(v ?? 0)])),
    reasons: m.reasons,
    evidence: [],
    terms: [],
    sources: [],
    contributions: m.contributions?.map((c) => ({ key: c.key, share: r(c.share) })),
  }
}

function toB64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function encodeSnapshot(results: Results, prefs: Preferences, token?: string | null): string {
  const lean: Results = {
    ...results,
    fields: results.fields.slice(0, 12).map(slim),
    hidden: results.hidden.map(slim),
    sources: results.sources.map((s) => ({ id: s.id, label: '', dataPoints: s.dataPoints })),
    riasec: { ...results.riasec, profile: results.riasec.profile.map((x) => r(x)) as Results['riasec']['profile'] },
    big5: results.big5 ? { ...results.big5, z: Object.fromEntries(Object.entries(results.big5.z).map(([k, v]) => [k, r(v)])) as NonNullable<Results['big5']>['z'] } : undefined,
  }
  const snap: Snapshot = { v: 1, at: new Date().toISOString().slice(0, 10), prefs: { countries: prefs.countries, level: prefs.level }, results: lean, ...(token ? { token } : {}) }
  return toB64Url(deflateSync(strToU8(JSON.stringify(snap)), { level: 9 }))
}

export function decodeSnapshot(s: string): Snapshot | null {
  try {
    const snap = JSON.parse(strFromU8(inflateSync(fromB64Url(s)))) as Snapshot
    if (snap?.v !== 1 || !Array.isArray(snap.results?.fields) || !snap.results.fields.length) return null
    return snap
  } catch {
    return null
  }
}

/** The fragment parameter holding a shared result, if the page was opened from a link. */
export function sharedParam(hash: string): string | null {
  return /(?:^#|&)s=([A-Za-z0-9_-]+)/.exec(hash)?.[1] ?? null
}
