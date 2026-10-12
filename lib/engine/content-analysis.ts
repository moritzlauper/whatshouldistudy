import { FIELD_BY_ID } from '../taxonomy/fields.ts'
import { exactBatch } from '../ai-batch.ts'
import { isStudyInfo } from './text.ts'
import type { SignalItem } from './types.ts'

export const CONTENT_SAMPLE = 240
/** The most titles one run classifies; their ids have up to four digits. */
export const CONTENT_MAX = 2000
export const CONTENT_BATCH = 40

/** Only user-supplied export titles. No API metadata, URLs, account IDs or dates. */
export interface ContentItem {
  id: string
  kind: 'watch' | 'subscription' | 'channel'
  title: string
  channel: string
  context: string[]
}

export interface ContentMeaning {
  fields: Record<string, number>
  reason: string
}

export interface ContentVerdict extends ContentMeaning { id: string }

const clean = (text: string) => text.replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '').trim().slice(0, 240)
const keyOf = (it: SignalItem) => `${it.kind}\n${it.text}`
const groupOf = (it: SignalItem) => it.group ?? it.label

/** A bounded, channel-balanced sample of up to `size` titles; repetition and dates remain in the browser. */
export function contentPlan(items: readonly SignalItem[], now = Date.now(), size = CONTENT_SAMPLE) {
  const eligible = items.filter((it) => (it.kind === 'watch' || it.kind === 'subscription') && !it.isMusic &&
    !(it.studyInfo ?? isStudyInfo(it.text, it.kind)) && (!it.time || now - it.time < 6 * 365.25 * 864e5))
  const seen = new Set<string>()
  const unique = [...eligible].sort((a, b) => (b.time ?? 0) - (a.time ?? 0)).filter((it) => {
    const key = keyOf(it)
    if (seen.has(key) || !clean(it.text.split('\n')[0])) return false
    seen.add(key)
    return true
  })
  const groups = new Map<string, SignalItem[]>()
  for (const it of unique.filter((it) => it.kind === 'watch')) {
    const group = groupOf(it)
    const list = groups.get(group) ?? []
    list.push(it)
    groups.set(group, list)
  }
  const subscriptions = unique.filter((it) => it.kind === 'subscription')
    .sort((a, b) => (groups.get(groupOf(b))?.length ?? 0) - (groups.get(groupOf(a))?.length ?? 0))
    .slice(0, 60)
  const subscribedGroups = new Set(subscriptions.map(groupOf))
  // A channel record supplies context, never an invented watch or subscription.
  const channels: SignalItem[] = [...groups].filter(([group, list]) => list.length >= 2 && clean(list[0].text.split('\n')[1] ?? '') && !subscribedGroups.has(group))
    .sort((a, b) => b[1].length - a[1].length).slice(0, 60)
    .map(([group, list]) => ({ kind: 'channel', group, text: list[0].text.split('\n')[1] ?? list[0].label, label: list[0].label, weight: 0 }))
  const selected: SignalItem[] = []
  const watchLimit = size - subscriptions.length - channels.length
  for (let round = 0; selected.length < watchLimit; round++) {
    let added = false
    for (const list of groups.values()) {
      if (list[round]) { selected.push(list[round]); added = true }
      if (selected.length >= watchLimit) break
    }
    if (!added) break
  }
  selected.push(...subscriptions, ...channels)
  const sample: ContentItem[] = selected.map((it, i) => ({
    id: String(i), kind: it.kind as ContentItem['kind'],
    title: clean(it.text.split('\n')[0]),
    channel: clean(it.kind === 'watch' ? it.text.split('\n')[1] ?? it.label : it.label),
    context: (groups.get(groupOf(it)) ?? []).filter((other) => other !== it).slice(0, 4).map((other) => clean(other.text.split('\n')[0])),
  }))
  return {
    items: sample,
    eligible: unique.length + channels.length,
    apply(verdicts: ContentVerdict[]): SignalItem[] {
      const validated = contentVerdicts(verdicts.map((v) => ({ ...v, fields: Object.entries(v.fields).map(([id, confidence]) => ({ id, confidence })) })), new Set(sample.map((x) => x.id)))
      const meanings = new Map(validated.map((v) => [keyOf(selected[Number(v.id)]), { fields: v.fields, reason: v.reason }]))
      const channelMeanings = new Map(validated.filter((v) => ['subscription', 'channel'].includes(selected[Number(v.id)].kind))
        .map((v) => [groupOf(selected[Number(v.id)]), { fields: v.fields, reason: v.reason }]))
      return items.map((it) => meanings.has(keyOf(it)) ? { ...it, meaning: meanings.get(keyOf(it))! }
        : it.kind === 'watch' && channelMeanings.has(groupOf(it)) ? { ...it, contextMeaning: channelMeanings.get(groupOf(it))! } : it)
    },
  }
}

/** Reject malformed batches; keep only confident connections to known fields. */
export function contentVerdicts(raw: unknown, ids: ReadonlySet<string>): ContentVerdict[] {
  return exactBatch(raw, ids).map((x) => {
    if (!Array.isArray(x.fields) || x.fields.length > 3 || typeof x.reason !== 'string' || !x.reason.trim()) throw new Error('Invalid content classification')
    const fields: Record<string, number> = {}
    for (const f of x.fields) {
      if (!f || typeof f.id !== 'string' || !FIELD_BY_ID[f.id] || typeof f.confidence !== 'number' || !Number.isFinite(f.confidence) || f.confidence < 0 || f.confidence > 1) throw new Error('Invalid subject connection')
      if (f.confidence >= .6) fields[f.id] = Math.max(fields[f.id] ?? 0, f.confidence)
    }
    return { id: x.id as string, fields, reason: x.reason.trim() }
  })
}

/** Construct an allowlisted request instead of forwarding an uploaded object. */
export function contentRequest(raw: unknown): ContentItem[] | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > CONTENT_BATCH) return null
  const out: ContentItem[] = []
  for (const x of raw) {
    if (!x || typeof x.id !== 'string' || !/^\d{1,4}$/.test(x.id) || !['watch', 'subscription', 'channel'].includes(x.kind) || typeof x.title !== 'string' || typeof x.channel !== 'string' || !Array.isArray(x.context) || x.context.length > 4 || x.context.some((t: unknown) => typeof t !== 'string')) return null
    const title = clean(x.title)
    if (!title) return null
    out.push({ id: x.id, kind: x.kind, title, channel: clean(x.channel), context: x.context.map(clean) })
  }
  return new Set(out.map((x) => x.id)).size === out.length ? out : null
}
