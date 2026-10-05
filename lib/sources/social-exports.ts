import { truncate } from '../engine/text.ts'
import type { SignalItem } from '../engine/types.ts'

/**
 * Instagram and TikTok data downloads. Neither offers what someone follows,
 * likes or searches through an API, but both put it in the download a person
 * can request for their own account. We read the JSON version, recognise each
 * part by its keys (file names and labels are translated), and never read
 * direct messages.
 */

export interface SocialCollected {
  instagram: SignalItem[]
  instagramStats: Record<string, number>
  tiktok: SignalItem[]
  tiktokStats: Record<string, number>
}

export function newSocial(): SocialCollected {
  return { instagram: [], instagramStats: {}, tiktok: [], tiktokStats: {} }
}

const bump = (stats: Record<string, number>, key: string, n = 1) => (stats[key] = (stats[key] ?? 0) + n)

/** «natgeo_science» → «natgeo science», so the lexicon has words to match. */
const handleText = (u: string) => u.replace(/[._]+/g, ' ').trim()

// ── Instagram ──────────────────────────────────────────────────────────────

/** A label/value pair somewhere inside an entry. Older downloads use string_list_data and string_map_data, newer ones label_values. */
interface Leaf {
  label?: string
  value?: string
  href?: string
  timestamp?: number
}

function leaves(e: unknown, label?: string, out: Leaf[] = []): Leaf[] {
  if (Array.isArray(e)) {
    for (const x of e) leaves(x, label, out)
    return out
  }
  if (!e || typeof e !== 'object') return out
  const o = e as Record<string, unknown>
  if (typeof o.value === 'string' || typeof o.href === 'string' || typeof o.timestamp === 'number') {
    out.push({ label: typeof o.label === 'string' ? o.label : label, value: o.value as string | undefined, href: o.href as string | undefined, timestamp: o.timestamp as number | undefined })
  }
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') leaves(v, k === 'string_map_data' || k === 'string_list_data' || k === 'label_values' || k === 'dict' ? label : k, out)
  }
  return out
}

const USERNAME = /^[a-z0-9._]{2,30}$/i
const NOT_TEXT = /url|link|href|time|zeit|date|datum|heure|hora/i

function igUser(e: Record<string, unknown>, ls: Leaf[]): string | undefined {
  const byLabel = ls.find((l) => l.label && /user ?name|benutzer|utilisateur|usuario|author|autor|auteur|owner|inhaber/i.test(l.label) && l.value && USERNAME.test(l.value))
  if (byLabel) return byLabel.value
  if (typeof e.title === 'string' && USERNAME.test(e.title)) return e.title
  for (const l of ls) {
    const m = l.href ? /instagram\.com\/(?:_u\/)?([a-z0-9._]{2,30})\/?$/i.exec(l.href) : null
    if (m) return m[1]
  }
  return ls.find((l) => l.value && USERNAME.test(l.value) && !(l.label && NOT_TEXT.test(l.label)))?.value
}

/** The readable values of an entry: topic names, search terms. */
function igValues(e: Record<string, unknown>, ls: Leaf[]): string[] {
  const out = ls.filter((l) => l.value && !/^https?:/.test(l.value) && /\p{L}/u.test(l.value) && !(l.label && NOT_TEXT.test(l.label))).map((l) => l.value!)
  if (!out.length && typeof e.title === 'string' && /\p{L}/u.test(e.title)) out.push(e.title)
  return [...new Set(out)]
}

function igTime(e: Record<string, unknown>, ls: Leaf[]): number | undefined {
  const t = typeof e.timestamp === 'number' ? e.timestamp : ls.find((l) => l.timestamp)?.timestamp
  return t ? t * 1000 : undefined
}

type IgKind = 'topic' | 'follow' | 'like' | 'saved' | 'search' | 'profileSearch' | 'seen'

/** Top-level keys of the parts we read. Everything else (messages, ads shown, logins) is ignored. */
function igKind(key: string): IgKind | null {
  if (/^topics_|^inferred_data_/.test(key)) return 'topic'
  if (key === 'relationships_following') return 'follow'
  if (/^likes_media_likes/.test(key)) return 'like'
  if (/^saved_saved_media/.test(key)) return 'saved'
  if (/^searches_(keyword|hashtag)/.test(key)) return 'search'
  if (/^searches_user/.test(key)) return 'profileSearch'
  if (/^impressions_history_(posts_seen|videos_watched|chaining_seen)/.test(key)) return 'seen'
  return null
}

export function parseInstagram(c: SocialCollected, name: string, data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  let n = 0
  const parts: string[] = []
  for (const [key, list] of Object.entries(data as Record<string, unknown>)) {
    const kind = igKind(key)
    if (!kind || !Array.isArray(list)) continue
    let k = 0
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue
      const e = raw as Record<string, unknown>
      const ls = leaves(e)
      const time = igTime(e, ls)
      if (kind === 'topic' || kind === 'search') {
        for (const v of igValues(e, ls)) {
          const topic = kind === 'topic'
          c.instagram.push({ kind: topic ? 'topic' : 'search', text: v, label: topic ? v : `«${truncate(v, 60)}»`, weight: topic ? 3 : 0.6, time })
          k++
        }
        continue
      }
      const user = igUser(e, ls)
      if (!user) continue
      const text = handleText(user)
      if (kind === 'follow') c.instagram.push({ kind: 'subscription', text, label: `@${user}`, group: user, weight: 1.5, time })
      else if (kind === 'like') c.instagram.push({ kind: 'like', text, label: `@${user}`, group: user, weight: 0.4, time })
      else if (kind === 'saved') c.instagram.push({ kind: 'saved', text, label: `@${user}`, group: user, weight: 0.8, time })
      else if (kind === 'profileSearch') c.instagram.push({ kind: 'search', text, label: `@${user}`, group: user, weight: 0.4, time })
      else c.instagram.push({ kind: 'watch', text, label: `@${user}`, group: user, weight: 0.15, time })
      k++
    }
    if (k) {
      bump(c.instagramStats, IG_STAT[kind], k)
      parts.push(`${k.toLocaleString('en-US')} ${IG_LABEL[kind]}`)
      n += k
    }
  }
  return n ? `${name}: Instagram, ${parts.join(', ')}` : null
}

const IG_STAT: Record<IgKind, string> = {
  topic: 'topics',
  follow: 'following',
  like: 'likes',
  saved: 'savedPosts',
  search: 'searches',
  profileSearch: 'profileSearches',
  seen: 'seen',
}

const IG_LABEL: Record<IgKind, string> = {
  topic: 'topics',
  follow: 'accounts you follow',
  like: 'likes',
  saved: 'saved posts',
  search: 'searches',
  profileSearch: 'profile searches',
  seen: 'posts and videos seen',
}

// ── TikTok ─────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>

const str = (o: Obj, ...keys: string[]) => {
  for (const k of keys) if (typeof o[k] === 'string' && (o[k] as string).trim()) return (o[k] as string).trim()
  return undefined
}

function ttTime(o: Obj): number | undefined {
  const d = str(o, 'Date', 'date')
  if (!d) return undefined
  const t = Date.parse(d.replace(' ', 'T') + (/[zZ+]/.test(d.slice(10)) ? '' : 'Z'))
  return Number.isFinite(t) ? t : undefined
}

/**
 * user_data_tiktok.json, in its older («Activity») and newer («Your Activity»)
 * layout. We walk the tree and pick lists by the fields their entries carry.
 */
export function parseTikTok(c: SocialCollected, name: string, data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const top = Object.keys(data as Obj)
  if (!top.some((k) => /activity|profile|comment|video|tiktok/i.test(k))) return null
  const before = c.tiktok.length
  let watched = 0
  let liked = 0
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      for (const it of node) if (it && typeof it === 'object' && !Array.isArray(it)) take(it as Obj, path)
      return
    }
    if (!node || typeof node !== 'object') return
    for (const [k, v] of Object.entries(node as Obj)) {
      // Direct messages stay unread.
      if (/message|chat|direct/i.test(k)) continue
      walk(v, `${path}/${k}`)
    }
  }
  const take = (o: Obj, path: string) => {
    const time = ttTime(o)
    const search = str(o, 'SearchTerm', 'searchTerm', 'Search Term')
    if (search) {
      c.tiktok.push({ kind: 'search', text: search, label: `«${truncate(search, 60)}»`, weight: 0.6, time })
      return
    }
    const hashtag = str(o, 'HashtagName', 'hashtagName') ?? (/hashtag/i.test(path) ? /\/tag\/([^/?#]+)/.exec(str(o, 'Link', 'link') ?? '')?.[1] : undefined)
    if (hashtag) {
      const tag = decodeURIComponent(hashtag).replace(/^#/, '')
      c.tiktok.push({ kind: 'topic', text: tag, label: `#${tag}`, weight: 2, time, splitCamel: true })
      return
    }
    const user = str(o, 'UserName', 'username', 'userName')
    // Who you follow, not who follows you.
    if (user && /following/i.test(path)) {
      c.tiktok.push({ kind: 'subscription', text: handleText(user), label: `@${user}`, group: user, weight: 1.5, time })
      return
    }
    const comment = str(o, 'Comment', 'comment')
    if (comment && comment.length >= 3) {
      c.tiktok.push({ kind: 'comment', text: comment, label: `“${truncate(comment, 60)}”`, weight: 0.8, time })
      return
    }
    if (str(o, 'Link', 'link', 'VideoLink')) {
      if (/like|favorite/i.test(path)) liked++
      else if (/brows|watch/i.test(path)) watched++
    }
  }
  walk(data, '')
  const items = c.tiktok.length - before
  if (!items && !watched && !liked) return null
  bump(c.tiktokStats, 'entries', items)
  if (watched) bump(c.tiktokStats, 'watchedVideos', watched)
  if (liked) bump(c.tiktokStats, 'likes', liked)
  const counts = (kind: string) => c.tiktok.slice(before).filter((x) => x.kind === kind).length
  const parts = [
    [counts('search'), 'searches'],
    [counts('subscription'), 'accounts you follow'],
    [counts('topic'), 'hashtags'],
    [counts('comment'), 'comments'],
    [watched, 'videos watched'],
  ]
    .filter(([n]) => n)
    .map(([n, l]) => `${(n as number).toLocaleString('en-US')} ${l}`)
  return `${name}: TikTok, ${parts.join(', ')}`
}

/** TikTok's TXT download: «Search Term: …», «Username: …», «Comment: …» lines. */
export function parseTikTokText(c: SocialCollected, name: string, text: string): string | null {
  const blocks = text.split(/\r?\n\s*\r?\n/)
  const before = c.tiktok.length
  const following = /follow/i.test(name) && !/follower/i.test(name)
  for (const b of blocks) {
    const date = /^Date:\s*(.+)$/im.exec(b)?.[1]
    const time = date ? ttTime({ Date: date }) : undefined
    const search = /^Search Term:\s*(.+)$/im.exec(b)?.[1]?.trim()
    const user = /^User ?name:\s*(.+)$/im.exec(b)?.[1]?.trim()
    const comment = /^Comment:\s*(.+)$/im.exec(b)?.[1]?.trim()
    const tag = /^Hashtag Name:\s*(.+)$/im.exec(b)?.[1]?.trim()
    if (search) c.tiktok.push({ kind: 'search', text: search, label: `«${truncate(search, 60)}»`, weight: 0.6, time })
    else if (tag) c.tiktok.push({ kind: 'topic', text: tag, label: `#${tag}`, weight: 2, time, splitCamel: true })
    else if (user && following) c.tiktok.push({ kind: 'subscription', text: handleText(user), label: `@${user}`, group: user, weight: 1.5, time })
    else if (comment && comment.length >= 3) c.tiktok.push({ kind: 'comment', text: comment, label: `“${truncate(comment, 60)}”`, weight: 0.8, time })
  }
  const n = c.tiktok.length - before
  if (!n) return null
  bump(c.tiktokStats, 'entries', n)
  return `${name}: TikTok, ${n.toLocaleString('en-US')} entries`
}
