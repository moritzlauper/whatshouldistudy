import { Unzip, UnzipInflate } from 'fflate'
import { accumulate } from '../engine/accumulate.ts'
import { truncate } from '../engine/text.ts'
import type { SignalItem, SourceSummary } from '../engine/types.ts'
import type { ChannelInfo } from './youtube.ts'
import type { Progress } from './oauth.ts'
import { newSocial, parseInstagram, parseInstagramHtml, parseTikTok, parseTikTokText } from './social-exports.ts'
import type { SocialCollected } from './social-exports.ts'

/**
 * Data exports the user downloads themselves and drops into the page:
 *
 * - Google Takeout (YouTube): the complete watch history and search history,
 *   subscriptions and your comments. This is the only way to get watch history,
 *   often tens of thousands of entries going back years. JSON or HTML.
 * - Google Takeout (My Activity → Search): your Google searches.
 * - Spotify "Account data" or "Extended streaming history": every song and
 *   podcast episode you played.
 * - Instagram and TikTok data downloads (JSON, or TikTok's TXT): topics,
 *   accounts you follow, likes, saved posts, searches, hashtags. Direct
 *   messages are skipped.
 *
 * Files are recognised by their content, not their (localised) names, and are
 * read in the browser. A whole Takeout .zip can be dropped as is; it is
 * streamed, and only the history files are decompressed.
 */

export interface ExportResult {
  summaries: SourceSummary[]
  /** Channel ids seen in the watch history, most watched first, for API enrichment. */
  topChannelIds: string[]
  recognised: string[]
  skipped: string[]
  /** Products listed in a Takeout archive that held no history we read (e.g. only «Search profile»). */
  takeoutProducts?: string[]
  /** Re-runs the analysis with channel descriptions fetched from the YouTube API. */
  rebuild: (channels: Map<string, ChannelInfo>) => ExportResult
}

interface Activity {
  header?: string
  title?: string
  titleUrl?: string
  subtitles?: Array<{ name?: string; url?: string }>
  time?: string
  products?: string[]
  details?: Array<{ name?: string }>
}

interface Collected {
  watch: SignalItem[]
  youtubeSearch: SignalItem[]
  googleSearch: SignalItem[]
  comments: SignalItem[]
  subscriptions: SignalItem[]
  music: SignalItem[]
  spotifyPodcasts: SignalItem[]
  spotifyTracks: Map<string, number>
  spotifyPlays: number
  channelCounts: Map<string, { name: string; n: number }>
  social: SocialCollected
  recognised: string[]
  skipped: string[]
  takeoutProducts?: string[]
}

const WATCH_PREFIX = /^(watched|vous avez regardé|has visto|hai guardato|assistiu a|bekeken|obejrzano|ha visto|se vio|visto)\s*:?\s+/i
const WATCH_SUFFIX = /\s+(angesehen|angeschaut|bekeken)$/i
const WANTED = /\.(json|html|csv|txt)$/i

function channelIdFromUrl(url?: string): string | undefined {
  const m = url ? /\/channel\/(UC[\w-]{20,})/.exec(url) : null
  return m?.[1]
}

function searchQuery(url?: string): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    return u.searchParams.get('search_query') ?? u.searchParams.get('q') ?? undefined
  } catch {
    return undefined
  }
}

function newCollected(): Collected {
  return {
    watch: [],
    youtubeSearch: [],
    googleSearch: [],
    comments: [],
    subscriptions: [],
    music: [],
    spotifyPodcasts: [],
    spotifyTracks: new Map(),
    spotifyPlays: 0,
    channelCounts: new Map(),
    social: newSocial(),
    recognised: [],
    skipped: [],
  }
}

function addActivity(c: Collected, a: Activity): 'watch' | 'search' | 'google' | null {
  const time = a.time ? Date.parse(a.time) : undefined
  const url = a.titleUrl ?? ''
  if (a.details?.some((d) => /ads/i.test(d.name ?? ''))) return null
  const isYouTube = /youtube\.com|youtu\.be/.test(url) || /youtube/i.test(a.header ?? '')

  if (isYouTube && /\/watch\?v=/.test(url)) {
    const title = (a.title ?? '').replace(WATCH_PREFIX, '').replace(WATCH_SUFFIX, '').trim()
    if (!title || title.startsWith('https://')) return null
    const channel = a.subtitles?.[0]?.name ?? ''
    const channelId = channelIdFromUrl(a.subtitles?.[0]?.url)
    const group = channelId ?? channel
    if (group) {
      const cc = c.channelCounts.get(group) ?? { name: channel, n: 0 }
      cc.n++
      c.channelCounts.set(group, cc)
    }
    const music = /music/i.test(a.header ?? '') || a.products?.some((p) => /music/i.test(p))
    ;(music ? c.music : c.watch).push({
      kind: 'watch',
      text: `${title} \n ${channel}`,
      label: channel || truncate(title, 70),
      group: group || undefined,
      weight: 0.3,
      time,
      isMusic: !!music,
      url,
    })
    return 'watch'
  }
  const q = searchQuery(url)
  // «Visited …» entries carry the visited page in q, not a search.
  if (!q || /^https?:/.test(q) || /\/url\?/.test(url)) return null
  if (isYouTube) {
    c.youtubeSearch.push({ kind: 'search', text: q, label: `«${truncate(q, 60)}»`, weight: 0.6, time })
    return 'search'
  }
  if (/google\./.test(url)) {
    c.googleSearch.push({ kind: 'google', text: q, label: `«${truncate(q, 60)}»`, weight: 0.4, time })
    return 'google'
  }
  return null
}

function parseActivityJson(c: Collected, name: string, data: unknown): boolean {
  if (!Array.isArray(data) || !data.length || typeof data[0] !== 'object') return false
  const first = data[0] as Record<string, unknown>
  // Spotify extended streaming history.
  if ('ts' in first && ('master_metadata_track_name' in first || 'episode_name' in first)) {
    for (const e of data as Array<Record<string, string | number | null>>) addSpotifyPlay(c, e)
    c.recognised.push(`${name}: Spotify streaming history`)
    return true
  }
  // Spotify account data: StreamingHistory_music_*.json / _podcast_*.json.
  if ('endTime' in first && ('trackName' in first || 'episodeName' in first)) {
    for (const e of data as Array<Record<string, string | number>>) addSpotifyPlay(c, e)
    c.recognised.push(`${name}: Spotify listening history`)
    return true
  }
  if (!('title' in first) && !('titleUrl' in first) && !('header' in first)) return false
  let watch = 0
  let search = 0
  let google = 0
  for (const a of data as Activity[]) {
    const kind = addActivity(c, a)
    if (kind === 'watch') watch++
    else if (kind === 'search') search++
    else if (kind === 'google') google++
  }
  if (!watch && !search && !google) return false
  const parts = [
    watch && `${watch.toLocaleString('en-US')} watched videos`,
    search && `${search.toLocaleString('en-US')} YouTube searches`,
    google && `${google.toLocaleString('en-US')} Google searches`,
  ].filter(Boolean)
  c.recognised.push(`${name}: ${parts.join(', ')}`)
  return true
}

function addSpotifyPlay(c: Collected, e: Record<string, string | number | null>) {
  c.spotifyPlays++
  const ms = Number(e.ms_played ?? e.msPlayed ?? 0)
  const time = Date.parse(String(e.ts ?? e.endTime ?? '').replace(' ', 'T'))
  const episode = (e.episode_name ?? e.episodeName) as string | null
  const show = (e.episode_show_name ?? e.podcastName) as string | null
  if (episode && show) {
    if (ms < 60_000) return
    c.spotifyPodcasts.push({
      kind: 'podcast',
      text: `${episode} \n ${show}`,
      label: show,
      group: show,
      weight: 0.6,
      time: Number.isFinite(time) ? time : undefined,
    })
    return
  }
  const artist = (e.master_metadata_album_artist_name ?? e.artistName) as string | null
  if (artist && ms >= 30_000) c.spotifyTracks.set(artist, (c.spotifyTracks.get(artist) ?? 0) + 1)
}

/** Takeout's HTML version of the same activity log. */
function parseActivityHtml(c: Collected, name: string, html: string): boolean {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const cells = doc.querySelectorAll('.content-cell')
  let n = 0
  for (const cell of cells) {
    const links = cell.querySelectorAll('a')
    if (!links.length) continue
    const first = links[0] as HTMLAnchorElement
    const second = links[1] as HTMLAnchorElement | undefined
    // The date is the last text line of the cell.
    const lines = (cell as HTMLElement).innerText?.split('\n') ?? cell.textContent?.split('\n') ?? []
    const last = lines.filter((l) => l.trim()).pop() ?? ''
    const parsed = Date.parse(last.replace(/\s[A-Z]{2,5}$/, '').replace(/ /g, ' '))
    // The URL tells YouTube from Google search (My Activity), so no header is assumed.
    const kind = addActivity(c, {
      title: first.textContent ?? '',
      titleUrl: first.href,
      subtitles: second ? [{ name: second.textContent ?? '', url: second.href }] : [],
      time: Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined,
    })
    if (kind) n++
  }
  if (!n) return false
  c.recognised.push(`${name}: ${n.toLocaleString('en-US')} activity entries`)
  return true
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  row.push(field)
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

function parseCsvFile(c: Collected, name: string, text: string): boolean {
  const rows = parseCsv(text.replace(/^﻿/, ''))
  if (rows.length < 2) return false
  const header = rows[0].map((h) => h.toLowerCase())
  const body = rows.slice(1)
  // Subscriptions: one column holds channel URLs.
  const urlCol = header.findIndex((_, i) => body.slice(0, 5).some((r) => /youtube\.com\/channel\/UC/.test(r[i] ?? '')))
  if (urlCol >= 0 && header.length <= 4) {
    const idCol = header.findIndex((_, i) => body.slice(0, 5).every((r) => /^UC[\w-]{20,}$/.test(r[i] ?? '')))
    const titleCol = header.findIndex((_, i) => i !== urlCol && i !== idCol)
    for (const r of body) {
      const id = (idCol >= 0 ? r[idCol] : channelIdFromUrl(r[urlCol])) ?? ''
      const title = r[titleCol] ?? ''
      if (!id && !title) continue
      c.subscriptions.push({ kind: 'subscription', text: title, label: title, group: id || title, weight: 3, learningPrior: 0.4 })
    }
    c.recognised.push(`${name}: ${body.length} subscriptions`)
    return true
  }
  // Comments: a column with comment text (newer exports wrap it as {"text":"..."}).
  if (header.some((h) => /comment|kommentar|commentaire|comentario|commento/.test(h))) {
    let textCol = header.findIndex((h) => /text/.test(h))
    if (textCol < 0) {
      let best = -1
      let bestLen = 0
      header.forEach((_, i) => {
        const len = body.slice(0, 50).reduce((s, r) => s + (r[i]?.length ?? 0), 0)
        if (len > bestLen) {
          bestLen = len
          best = i
        }
      })
      textCol = best
    }
    const timeCol = header.findIndex((h) => /time|zeit|date|fecha/.test(h))
    let n = 0
    for (const r of body) {
      const raw = r[textCol] ?? ''
      const parts = [...raw.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\n/g, ' ').replace(/\\"/g, '"'))
      const text = parts.length ? parts.join('') : raw
      if (text.trim().length < 3) continue
      const t = timeCol >= 0 ? Date.parse(r[timeCol]) : NaN
      c.comments.push({
        kind: 'comment',
        text,
        label: `Your comment: "${truncate(text, 60)}"`,
        weight: 0.8,
        time: Number.isFinite(t) ? t : undefined,
      })
      n++
    }
    if (n) c.recognised.push(`${name}: ${n} comments you wrote`)
    return n > 0
  }
  return false
}

async function readEntry(c: Collected, name: string, text: string): Promise<void> {
  const short = name.split('/').pop() ?? name
  try {
    if (/\.json$/i.test(name)) {
      const data = JSON.parse(text) as unknown
      if (parseActivityJson(c, short, data)) return
      const social = parseInstagram(c.social, short, data) ?? parseTikTok(c.social, short, data)
      if (social) c.recognised.push(social)
      else c.skipped.push(short)
    } else if (/\.txt$/i.test(name)) {
      const social = parseTikTokText(c.social, short, text)
      if (social) c.recognised.push(social)
      else c.skipped.push(short)
    } else if (/\.html$/i.test(name)) {
      // Takeout's table of contents: remember which products the archive holds.
      if (/archive_browser\.html$/i.test(name)) {
        const block = text.slice(text.search(/Products in Archive|Produkte im Archiv/i))
        const products = [...block.matchAll(/id="service-tile-[^"]+"[\s\S]*?alt="([^"]+)"/g)].map((m) => m[1].trim())
        c.takeoutProducts = products.length ? [...new Set(products)] : ['?']
        return
      }
      if (/content-cell/.test(text)) {
        if (!parseActivityHtml(c, short, text)) c.skipped.push(short)
        return
      }
      const social = parseInstagramHtml(c.social, name, text)
      if (social) c.recognised.push(social)
      else c.skipped.push(short)
    } else if (/\.csv$/i.test(name)) {
      if (!parseCsvFile(c, short, text)) c.skipped.push(short)
    }
  } catch {
    c.skipped.push(short)
  }
}

async function readZip(c: Collected, file: File, onProgress: Progress): Promise<void> {
  const pending: Array<Promise<void>> = []
  const unzip = new Unzip()
  unzip.register(UnzipInflate)
  unzip.onfile = (f) => {
    // Takeout puts everything else (videos, photos) in the same archive; skip it.
    if (!WANTED.test(f.name) || (f.originalSize ?? 0) > 400e6) return
    if (/\/(videos?|fotos?|photos?)\//i.test(f.name) && !/history|verlauf|historique|historial|cronologia/i.test(f.name)) return
    // Instagram and TikTok downloads: direct messages stay unread.
    if (/(^|\/)(messages|inbox|message_requests|direct_messages?)\//i.test(f.name)) return
    const chunks: Uint8Array[] = []
    pending.push(
      new Promise<void>((resolve) => {
        f.ondata = (err, data, final) => {
          if (err) {
            c.skipped.push(f.name)
            resolve()
            return
          }
          chunks.push(data)
          if (final) {
            const text = new TextDecoder().decode(concat(chunks))
            void readEntry(c, f.name, text).then(resolve)
          }
        }
      }),
    )
    f.start()
  }
  const reader = file.stream().getReader()
  let read = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    unzip.push(value)
    read += value.length
    onProgress(`Unpacking ${file.name}`, Math.round((read / file.size) * 100))
  }
  unzip.push(new Uint8Array(0), true)
  await Promise.all(pending)
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((s, x) => s + x.length, 0))
  let o = 0
  for (const ch of chunks) {
    out.set(ch, o)
    o += ch.length
  }
  return out
}

export async function readExports(files: File[], onProgress: Progress = () => {}): Promise<ExportResult> {
  const c = newCollected()
  for (const file of files) {
    onProgress(`Reading ${file.name}`)
    if (/\.zip$/i.test(file.name)) await readZip(c, file, onProgress)
    else if (WANTED.test(file.name)) await readEntry(c, file.name, await file.text())
    else c.skipped.push(file.name)
  }
  return buildSummaries(c)
}

function buildSummaries(c: Collected, channels?: Map<string, ChannelInfo>): ExportResult {
  const summaries: SourceSummary[] = []
  // Google searches (My Activity) are their own source, so the two downloads don't overwrite each other.
  // Subscriptions in Takeout carry no date and can be years old; with a real
  // watch history, what someone watches now leads.
  const subscriptions = c.watch.length >= 200 ? c.subscriptions.map((x) => ({ ...x, weight: 1 })) : c.subscriptions
  const youtubeItems = [...c.watch, ...c.music, ...c.youtubeSearch, ...c.comments, ...subscriptions]
  if (youtubeItems.length) {
    const groupText = new Map<string, string>()
    if (channels) for (const [id, ch] of channels) groupText.set(id, ch.text)
    summaries.push(
      accumulate(youtubeItems, {
        source: 'takeout',
        label: 'Google Takeout',
        groupText,
        stats: {
          watchedVideos: c.watch.length,
          musicPlays: c.music.length,
          youtubeSearches: c.youtubeSearch.length,
          comments: c.comments.length,
          subscriptions: c.subscriptions.length,
          channels: c.channelCounts.size,
        },
        maker: 0,
      }),
    )
  }
  if (c.googleSearch.length) {
    summaries.push(accumulate(c.googleSearch, { source: 'google-search', label: 'Google searches', stats: { googleSearches: c.googleSearch.length } }))
  }
  if (c.spotifyPlays) {
    const artists = c.spotifyTracks.size
    summaries.push(
      accumulate(c.spotifyPodcasts, {
        source: 'spotify-export',
        label: 'Spotify data export',
        stats: { plays: c.spotifyPlays, podcastEpisodes: c.spotifyPodcasts.length, artists },
        dataPoints: c.spotifyPlays,
      }),
    )
  }
  const ig = c.social
  if (ig.instagram.length) {
    summaries.push(accumulate(ig.instagram, { source: 'instagram', label: 'Instagram', stats: ig.instagramStats }))
  }
  if (ig.tiktok.length) {
    summaries.push(
      accumulate(ig.tiktok, {
        source: 'tiktok',
        label: 'TikTok',
        stats: ig.tiktokStats,
        dataPoints: ig.tiktok.length + (ig.tiktokStats.watchedVideos ?? 0) + (ig.tiktokStats.likes ?? 0),
      }),
    )
  }
  const topChannelIds = [...c.channelCounts.entries()]
    .filter(([id]) => id.startsWith('UC'))
    .sort((a, b) => b[1].n - a[1].n)
    .map(([id]) => id)
  return {
    summaries,
    topChannelIds,
    recognised: c.recognised,
    skipped: c.skipped,
    takeoutProducts: c.takeoutProducts,
    rebuild: (ch) => buildSummaries(c, ch),
  }
}

/** Test hook: parse already-loaded file contents. */
export async function readTexts(entries: Array<{ name: string; text: string }>): Promise<ExportResult> {
  const c = newCollected()
  for (const e of entries) await readEntry(c, e.name, e.text)
  return buildSummaries(c)
}
