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
          c.instagram.push({ kind: topic ? 'topic' : 'search', text: v, label: topic ? v : `«${truncate(v, 140)}»`, weight: topic ? 3 : 0.6, time })
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
      c.tiktok.push({ kind: 'search', text: search, label: `«${truncate(search, 140)}»`, weight: 0.6, time })
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
      c.tiktok.push({ kind: 'comment', text: comment, label: `“${truncate(comment, 140)}”`, weight: 0.8, time })
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
    if (search) c.tiktok.push({ kind: 'search', text: search, label: `«${truncate(search, 140)}»`, weight: 0.6, time })
    else if (tag) c.tiktok.push({ kind: 'topic', text: tag, label: `#${tag}`, weight: 2, time, splitCamel: true })
    else if (user && following) c.tiktok.push({ kind: 'subscription', text: handleText(user), label: `@${user}`, group: user, weight: 1.5, time })
    else if (comment && comment.length >= 3) c.tiktok.push({ kind: 'comment', text: comment, label: `“${truncate(comment, 140)}”`, weight: 0.8, time })
  }
  const n = c.tiktok.length - before
  if (!n) return null
  bump(c.tiktokStats, 'entries', n)
  return `${name}: TikTok, ${n.toLocaleString('en-US')} entries`
}

// ── Instagram, HTML version ────────────────────────────────────────────────
// Meta's default download format. Each entry is a block of label/value table
// cells; the file path says what the file holds. Labels follow the account
// language, so they are matched loosely.

const decodeHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

const CAPTION = /caption|bildunterschrift|beschriftung|légende|didascalia|descripci|bijschrift|legenda/i
const USER_LABEL = /user ?name|benutzername|nom d.utilisateur|nome utente|nombre de usuario|gebruikersnaam/i
const COMMENT = /^(comment|kommentar|commentaire|commento|comentario|reactie)$/i
const URL_LABEL = /^(url|link)$/i
const TIME_LABEL = /^(time|zeit|date|datum|heure|ora|hora|tijd)$/i

/** «Label | value» pairs, in both layouts Meta uses. */
function igPairs(html: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const side = /<td class="[^"]*_a6_q[^"]*">([^<]+)<\/td><td class="[^"]*_a6_r[^"]*">([\s\S]*?)<\/td>/g
  const stacked = /<td colspan="2" class="[^"]*_a6_q[^"]*">([^<]+)<div><div>([\s\S]*?)<\/div><\/div><\/td>/g
  for (const m of html.matchAll(side)) out.push([decodeHtml(m[1]), decodeHtml(m[2])])
  for (const m of html.matchAll(stacked)) out.push([decodeHtml(m[1]), decodeHtml(m[2])])
  return out
}

function igHashtags(chunk: string): string[] {
  const i = chunk.search(/>\s*Hashtags\s*<\/h2>/i)
  if (i < 0) return []
  const rest = chunk.slice(i)
  const end = rest.slice(5).search(/<h2/)
  const part = end >= 0 ? rest.slice(0, end + 5) : rest
  return [...part.matchAll(/<div class="_a6-p">([^<]+)<\/div>/g)].map((m) => decodeHtml(m[1])).filter((x) => x && !/^name$/i.test(x))
}

type IgHtmlKind = 'follow' | 'like' | 'saved' | 'seen' | 'search' | 'profileSearch' | 'comment'

function igHtmlKind(path: string): IgHtmlKind | null {
  if (/threads\//.test(path)) return null
  if (/followers_and_following\/following\.html$/.test(path)) return 'follow'
  if (/likes\/liked_posts\.html$/.test(path)) return 'like'
  if (/saved\/saved_posts\.html$/.test(path)) return 'saved'
  if (/ads_and_topics\/(posts_viewed|videos_watched)\.html$/.test(path)) return 'seen'
  if (/recent_searches\/word_or_phrase_searches\.html$/.test(path)) return 'search'
  if (/recent_searches\/profile_searches\.html$/.test(path)) return 'profileSearch'
  if (/comments\/post_comments_\d+\.html$/.test(path)) return 'comment'
  return null
}

const POST_WEIGHT: Record<'like' | 'saved' | 'seen', number> = { like: 0.5, saved: 1, seen: 0.25 }

export function parseInstagramHtml(c: SocialCollected, path: string, html: string): string | null {
  const kind = igHtmlKind(path)
  if (!kind || !/uiBoxWhite|_a706/.test(html)) return null
  const name = path.split('/').pop() ?? path
  const main = html.slice(Math.max(0, html.indexOf('<main')))
  const before = c.instagram.length

  if (kind === 'follow') {
    const users = new Set([...main.matchAll(/href="https?:\/\/(?:www\.)?instagram\.com\/(?:_u\/)?([a-z0-9._]{2,30})\/?"/gi)].map((m) => m[1]))
    for (const u of users) c.instagram.push({ kind: 'subscription', text: handleText(u), label: `@${u}`, group: u, weight: 1.5 })
  } else if (kind === 'search' || kind === 'profileSearch' || kind === 'comment') {
    // One table per entry: the value, then its time.
    for (const table of main.split('<table').slice(1)) {
      const pairs = igPairs('<table' + table)
      const time = pairs.find(([l]) => TIME_LABEL.test(l))?.[1]
      const t = time ? Date.parse(time) : NaN
      const at = Number.isFinite(t) ? t : undefined
      for (const [label, value] of pairs) {
        if (!value || TIME_LABEL.test(label) || URL_LABEL.test(label)) continue
        if (kind === 'comment') {
          if (COMMENT.test(label) && value.length >= 3) c.instagram.push({ kind: 'comment', text: value, label: `“${truncate(value, 140)}”`, weight: 0.8, time: at })
        } else if (kind === 'profileSearch') {
          if (USERNAME.test(value)) c.instagram.push({ kind: 'search', text: handleText(value), label: `@${value}`, group: value, weight: 0.4, time: at })
        } else c.instagram.push({ kind: 'search', text: value, label: `«${truncate(value, 140)}»`, weight: 0.6, time: at })
      }
    }
  } else {
    // Posts: each entry ends with its date in a footer div.
    const parts = main.split(/<div class="_3-94 _a6-o">/)
    for (let i = 0; i < parts.length - 1; i++) {
      const chunk = parts[i]
      const date = decodeHtml(/^([^<]*)<\/div>/.exec(parts[i + 1])?.[1] ?? '')
      const t = Date.parse(date)
      const pairs = igPairs(chunk)
      const captions = [...new Set(pairs.filter(([l]) => CAPTION.test(l)).map(([, v]) => v).filter(Boolean))]
      const user = pairs.find(([l, v]) => USER_LABEL.test(l) && USERNAME.test(v))?.[1]
      const tags = igHashtags(chunk)
      const text = [captions.join(' '), tags.join(' '), user ? handleText(user) : ''].join(' \n ').trim()
      if (!text) continue
      const label = captions[0] ? truncate(captions[0], 140) : user ? `@${user}` : `#${tags[0]}`
      c.instagram.push({
        kind: kind === 'like' ? 'like' : kind === 'saved' ? 'saved' : 'watch',
        text,
        label,
        group: user,
        weight: POST_WEIGHT[kind],
        time: Number.isFinite(t) ? t : undefined,
        splitCamel: true,
      })
    }
  }

  const n = c.instagram.length - before
  if (!n) return null
  const stat = { follow: 'following', like: 'likes', saved: 'savedPosts', seen: 'seen', search: 'searches', profileSearch: 'profileSearches', comment: 'comments' }[kind]
  bump(c.instagramStats, stat, n)
  const label = { follow: 'accounts you follow', like: 'likes', saved: 'saved posts', seen: 'posts and videos seen', search: 'searches', profileSearch: 'profile searches', comment: 'comments' }[kind]
  return `${name}: Instagram, ${n.toLocaleString('en-US')} ${label}`
}
