import { FIELD_BY_ID } from '../taxonomy/fields.ts'
import { isStudyInfo } from './text.ts'
import type { SignalItem } from './types.ts'

export const CONTENT_SAMPLE = 240
/** The most titles one run classifies. */
export const CONTENT_MAX = 1000
/** Bump when contentPlan or the grouping changes: an unfinished run made with another version is not continued. */
export const CONTENT_RUN_VERSION = 2
/** An unfinished run is kept for this many days after its last saved group. */
export const CONTENT_PROGRESS_DAYS = 7
/** Titles per request: small enough to finish well inside the server's time limit, and one bad answer costs only its own group. */
export const CONTENT_BATCH = 10
/** Requests in flight at once. */
export const CONTENT_PARALLEL = 4

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

/**
 * An unfinished run, kept on this device so a reopened page can continue it. It holds the answers
 * the result keeps, and the time its plan was made, so the same plan can be rebuilt from it.
 */
export interface ContentProgress {
  version: number
  importId: string
  baseCollectedAt: string
  size: number
  now: number
  total: number
  savedAt: number
  /** Groups that were answered, by their place in the order. */
  done: number[]
  verdicts: ContentVerdict[]
}

/** Whether saved progress belongs to this import, is of this version, and is still recent enough to continue. */
export function isCurrentProgress(progress: ContentProgress, importId: string | undefined, baseCollectedAt: string | undefined, now = Date.now()): boolean {
  return progress.version === CONTENT_RUN_VERSION && progress.importId === importId && progress.baseCollectedAt === baseCollectedAt && now - progress.savedAt < CONTENT_PROGRESS_DAYS * 864e5
}

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

/**
 * Keeps every connection the model gave in the right form and drops only the part that breaks a rule:
 * an unknown, repeated or foreign id, an empty reason, an unknown field, a confidence outside 0 to 1.
 * Only connections of 0.6 or more count, at most three of them, the strongest first.
 */
export function contentVerdicts(raw: unknown, ids: ReadonlySet<string>): ContentVerdict[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: ContentVerdict[] = []
  for (const x of raw as Array<Record<string, unknown>>) {
    const rawId = x?.id
    const rawReason = x?.reason
    const id = typeof rawId === 'string' ? rawId : ''
    const reason = typeof rawReason === 'string' ? rawReason.trim() : ''
    if (!ids.has(id) || seen.has(id) || !reason) continue
    seen.add(id)
    const strongest: Record<string, number> = {}
    for (const f of Array.isArray(x.fields) ? (x.fields as Array<Record<string, unknown>>) : []) {
      const field = typeof f?.id === 'string' ? f.id : ''
      const confidence = f?.confidence
      if (!FIELD_BY_ID[field] || typeof confidence !== 'number' || !(confidence >= 0 && confidence <= 1) || confidence < .6) continue
      strongest[field] = Math.max(strongest[field] ?? 0, confidence)
    }
    out.push({ id, fields: Object.fromEntries(Object.entries(strongest).sort((a, b) => b[1] - a[1]).slice(0, 3)), reason })
  }
  return out
}

export interface BatchOptions {
  /** Titles per request; CONTENT_BATCH by default. */
  batch?: number
  /** Requests in flight at once; CONTENT_PARALLEL by default. */
  parallel?: number
  /** Tries per group, the first one included. */
  attempts?: number
  /** Wait before the next try in milliseconds, multiplied by the number of the try so far. */
  pause?: number
  /** Asked before each try; true stops the run. */
  stopped?: () => boolean
  /** Groups answered in an earlier run, by their place in the order; they are not sent again. */
  done?: ReadonlySet<number>
  /** Called once for each group that is answered, with its place and its answers. */
  onGroup?: (group: number, verdicts: ContentVerdict[]) => void
  onProgress?: (classified: number) => void
}

/**
 * Sends the titles in groups, a few at a time. A group that fails or answers nothing usable is tried
 * again; one that still fails is left out, so the others still count. A limit answer stops the run.
 */
export async function classifyInBatches(
  items: readonly ContentItem[],
  send: (group: ContentItem[]) => Promise<ContentVerdict[]>,
  options: BatchOptions = {},
): Promise<{ verdicts: ContentVerdict[]; limited: boolean }> {
  const size = options.batch ?? CONTENT_BATCH
  const parallel = options.parallel ?? CONTENT_PARALLEL
  const attempts = options.attempts ?? 3
  const pause = options.pause ?? 1500
  const stopped = () => options.stopped?.() ?? false
  const groups: ContentItem[][] = []
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size))
  const runGroup = async (group: ContentItem[]): Promise<ContentVerdict[] | 'limit' | null> => {
    for (let attempt = 1; attempt <= attempts && !stopped(); attempt++) {
      try {
        const answer = await send(group)
        if (answer.length) return answer
      } catch (e) {
        if (e instanceof Error && e.message === 'limit') return 'limit'
      }
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, pause * attempt))
    }
    return null
  }
  const queue = groups.map((_, i) => i).filter((i) => !options.done?.has(i))
  const verdicts: ContentVerdict[] = []
  let limited = false
  // Each worker takes the next group once its own one is answered, so progress is saved group by group.
  const worker = async () => {
    while (queue.length && !limited && !stopped()) {
      const index = queue.shift()!
      const answer = await runGroup(groups[index])
      if (answer === 'limit') limited = true
      else if (answer) {
        verdicts.push(...answer)
        options.onGroup?.(index, answer)
        options.onProgress?.(verdicts.length)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, worker))
  return { verdicts, limited }
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
