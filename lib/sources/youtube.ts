import { accumulate } from '../engine/accumulate.ts'
import { genresToProfile } from '../engine/music.ts'
import { truncate } from '../engine/text.ts'
import type { SignalItem, SourceSummary } from '../engine/types.ts'
import { YOUTUBE_CATEGORIES } from '../taxonomy/known.ts'
import { ApiError, getJson } from './oauth.ts'
import type { Progress } from './oauth.ts'

/**
 * YouTube Data API v3 with the read-only scope. What the API exposes for your
 * own account: subscriptions (with the date you subscribed), liked videos (with
 * the date you liked them), your playlists and uploads, plus full metadata for
 * every channel and video (descriptions, tags, category, topic). Watch and
 * search history are not in the API; they come from Google Takeout instead.
 *
 * Quota: every list call costs 1 unit of the project's 10,000/day, so a full
 * scan of a heavy account is about 150-250 units.
 */

const API = 'https://www.googleapis.com/youtube/v3'
const MAX_SUBSCRIPTIONS = 2000
const MAX_LIKES = 3000
const MAX_PLAYLISTS = 25
const MAX_PLAYLIST_ITEMS = 200
const MAX_UPLOADS = 200

interface Page<T> {
  items?: T[]
  nextPageToken?: string
}

interface Snippet {
  title: string
  description?: string
  publishedAt?: string
  channelId?: string
  channelTitle?: string
  videoOwnerChannelTitle?: string
  videoOwnerChannelId?: string
  tags?: string[]
  categoryId?: string
  resourceId?: { channelId?: string; videoId?: string }
}

interface ChannelResource {
  id: string
  snippet?: Snippet
  contentDetails?: { relatedPlaylists?: { likes?: string; uploads?: string } }
  brandingSettings?: { channel?: { keywords?: string } }
  topicDetails?: { topicCategories?: string[] }
}

interface VideoResource {
  id: string
  snippet?: Snippet
  topicDetails?: { topicCategories?: string[] }
}

export interface ChannelInfo {
  title: string
  text: string
}

function topics(urls?: string[]): string[] {
  return (urls ?? []).map((u) => decodeURIComponent(u.split('/').pop() ?? '').replace(/_/g, ' '))
}

async function* paginate<T>(url: string, token: string, max: number): AsyncGenerator<T> {
  let pageToken = ''
  let n = 0
  do {
    const page = await getJson<Page<T>>(`${url}${pageToken ? `&pageToken=${pageToken}` : ''}`, token)
    for (const it of page.items ?? []) {
      yield it
      if (++n >= max) return
    }
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
}

/** Channel descriptions, keywords and topics, 50 per call. */
export async function fetchChannels(ids: string[], token: string, onProgress?: Progress): Promise<Map<string, ChannelInfo>> {
  const out = new Map<string, ChannelInfo>()
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const page = await getJson<Page<ChannelResource>>(
      `${API}/channels?part=snippet,brandingSettings,topicDetails&maxResults=50&id=${batch.join(',')}`,
      token,
    )
    for (const c of page.items ?? []) {
      const title = c.snippet?.title ?? ''
      out.set(c.id, {
        title,
        text: [
          title,
          truncate(c.snippet?.description ?? '', 700),
          c.brandingSettings?.channel?.keywords ?? '',
          topics(c.topicDetails?.topicCategories).join(' '),
        ].join(' \n '),
      })
    }
    onProgress?.('Reading channel details', out.size)
  }
  return out
}

async function fetchVideos(ids: string[], token: string, onProgress?: Progress): Promise<Map<string, VideoResource>> {
  const out = new Map<string, VideoResource>()
  for (let i = 0; i < ids.length; i += 50) {
    const page = await getJson<Page<VideoResource>>(
      `${API}/videos?part=snippet,topicDetails&maxResults=50&id=${ids.slice(i, i + 50).join(',')}`,
      token,
    )
    for (const v of page.items ?? []) out.set(v.id, v)
    onProgress?.('Reading video details', out.size)
  }
  return out
}

export async function collectYouTube(token: string, onProgress: Progress = () => {}): Promise<SourceSummary> {
  const items: SignalItem[] = []
  const notes: string[] = []
  const stats: Record<string, number> = {}
  const groupText = new Map<string, string>()
  const genres = new Map<string, number>()

  const me = await getJson<Page<ChannelResource>>(`${API}/channels?part=snippet,contentDetails&mine=true`, token)
  const own = me.items?.[0]
  const likesPlaylist = own?.contentDetails?.relatedPlaylists?.likes
  const uploadsPlaylist = own?.contentDetails?.relatedPlaylists?.uploads

  // Subscriptions: deliberate, long-term choices.
  onProgress('Reading your subscriptions', 0)
  const subs: Array<{ id: string; title: string; description: string; time?: number }> = []
  for await (const s of paginate<{ snippet: Snippet }>(
    `${API}/subscriptions?part=snippet&mine=true&maxResults=50&order=alphabetical`,
    token,
    MAX_SUBSCRIPTIONS,
  )) {
    const id = s.snippet.resourceId?.channelId
    if (!id) continue
    subs.push({
      id,
      title: s.snippet.title,
      description: s.snippet.description ?? '',
      time: s.snippet.publishedAt ? Date.parse(s.snippet.publishedAt) : undefined,
    })
    if (subs.length % 50 === 0) onProgress('Reading your subscriptions', subs.length)
  }
  stats.subscriptions = subs.length

  // Liked videos, with the time you liked them.
  onProgress('Reading your liked videos', 0)
  const liked: Array<{ videoId: string; time?: number; title: string; channelId?: string; channelTitle?: string }> = []
  if (likesPlaylist) {
    try {
      for await (const it of paginate<{ snippet: Snippet; contentDetails?: { videoId?: string } }>(
        `${API}/playlistItems?part=snippet,contentDetails&playlistId=${likesPlaylist}&maxResults=50`,
        token,
        MAX_LIKES,
      )) {
        const videoId = it.contentDetails?.videoId ?? it.snippet.resourceId?.videoId
        if (!videoId) continue
        liked.push({
          videoId,
          time: it.snippet.publishedAt ? Date.parse(it.snippet.publishedAt) : undefined,
          title: it.snippet.title,
          channelId: it.snippet.videoOwnerChannelId,
          channelTitle: it.snippet.videoOwnerChannelTitle,
        })
        if (liked.length % 100 === 0) onProgress('Reading your liked videos', liked.length)
      }
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 404) throw e
    }
  }
  if (!liked.length) {
    // Some accounts hide the likes playlist; myRating still works.
    for await (const v of paginate<VideoResource>(
      `${API}/videos?part=snippet,topicDetails&myRating=like&maxResults=50`,
      token,
      MAX_LIKES,
    )) {
      liked.push({ videoId: v.id, title: v.snippet?.title ?? '', channelId: v.snippet?.channelId, channelTitle: v.snippet?.channelTitle })
    }
  }
  stats.likedVideos = liked.length

  // Full metadata (tags, category, topics) for liked videos.
  let details = new Map<string, VideoResource>()
  try {
    details = await fetchVideos(
      liked.map((l) => l.videoId),
      token,
      onProgress,
    )
  } catch (e) {
    if (e instanceof ApiError && e.reason === 'quotaExceeded') notes.push('YouTube quota reached; some video details were skipped.')
    else throw e
  }

  // Channel context for subscriptions and the channels you like most.
  const subIds = new Set(subs.map((s) => s.id))
  const likedChannelCounts = new Map<string, number>()
  for (const l of liked) if (l.channelId && !subIds.has(l.channelId)) likedChannelCounts.set(l.channelId, (likedChannelCounts.get(l.channelId) ?? 0) + 1)
  const extraChannels = [...likedChannelCounts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 150)
    .map(([id]) => id)
  let channels = new Map<string, ChannelInfo>()
  try {
    channels = await fetchChannels([...subIds, ...extraChannels], token, onProgress)
  } catch (e) {
    if (e instanceof ApiError && e.reason === 'quotaExceeded') notes.push('YouTube quota reached; some channel details were skipped.')
    else throw e
  }
  for (const [id, c] of channels) groupText.set(id, c.text)

  for (const s of subs) {
    items.push({
      kind: 'subscription',
      text: channels.get(s.id)?.text ?? `${s.title} ${truncate(s.description, 500)}`,
      label: s.title,
      group: s.id,
      weight: 3,
      time: s.time,
      learningPrior: 0.4,
      url: `https://www.youtube.com/channel/${s.id}`,
    })
  }

  let musicLikes = 0
  for (const l of liked) {
    const d = details.get(l.videoId)
    const cat = d?.snippet?.categoryId
    const catInfo = cat ? YOUTUBE_CATEGORIES[cat] : undefined
    const topicNames = topics(d?.topicDetails?.topicCategories)
    const isMusic = !!catInfo?.music
    if (isMusic) {
      musicLikes++
      for (const t of topicNames) if (/music|jazz|rock|pop|hip hop|reggae|soul|blues|country|electronic|classical|metal|punk|folk|r&b|rhythm/i.test(t)) genres.set(t, (genres.get(t) ?? 0) + 1)
    }
    items.push({
      kind: 'like',
      text: [
        d?.snippet?.title ?? l.title,
        (d?.snippet?.tags ?? []).slice(0, 15).join(' '),
        truncate(d?.snippet?.description ?? '', 300),
        topicNames.join(' '),
        l.channelTitle ?? '',
      ].join(' \n '),
      label: l.channelTitle ? `${truncate(l.title, 70)} (${l.channelTitle})` : truncate(l.title, 80),
      group: l.channelId,
      weight: 1.5,
      time: l.time,
      learningPrior: catInfo?.learning ?? 0.3,
      isMusic,
      url: `https://www.youtube.com/watch?v=${l.videoId}`,
    })
  }
  stats.musicLikes = musicLikes

  // Your own playlists: curation effort.
  onProgress('Reading your playlists', 0)
  let playlistCount = 0
  let playlistItems = 0
  try {
    for await (const pl of paginate<{ id: string; snippet: Snippet }>(
      `${API}/playlists?part=snippet&mine=true&maxResults=50`,
      token,
      MAX_PLAYLISTS,
    )) {
      playlistCount++
      for await (const it of paginate<{ snippet: Snippet }>(
        `${API}/playlistItems?part=snippet&playlistId=${pl.id}&maxResults=50`,
        token,
        MAX_PLAYLIST_ITEMS,
      )) {
        playlistItems++
        items.push({
          kind: 'playlist',
          text: `${it.snippet.title} ${it.snippet.videoOwnerChannelTitle ?? ''} ${pl.snippet.title}`,
          label: `Playlist "${truncate(pl.snippet.title, 40)}": ${truncate(it.snippet.title, 60)}`,
          group: it.snippet.videoOwnerChannelId,
          weight: 1,
          time: it.snippet.publishedAt ? Date.parse(it.snippet.publishedAt) : undefined,
        })
      }
      onProgress('Reading your playlists', playlistItems)
    }
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    notes.push('Some playlists could not be read.')
  }
  stats.playlists = playlistCount
  stats.playlistItems = playlistItems

  // Your own uploads: you make things.
  let uploads = 0
  if (uploadsPlaylist) {
    try {
      for await (const it of paginate<{ snippet: Snippet }>(
        `${API}/playlistItems?part=snippet&playlistId=${uploadsPlaylist}&maxResults=50`,
        token,
        MAX_UPLOADS,
      )) {
        uploads++
        items.push({
          kind: 'upload',
          text: `${it.snippet.title} ${truncate(it.snippet.description ?? '', 300)}`,
          label: `Your video: ${truncate(it.snippet.title, 70)}`,
          weight: 4,
          time: it.snippet.publishedAt ? Date.parse(it.snippet.publishedAt) : undefined,
        })
      }
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
    }
  }
  stats.uploads = uploads

  onProgress('Analysing', items.length)
  return accumulate(items, {
    source: 'youtube',
    label: 'YouTube account',
    groupText,
    stats,
    notes,
    maker: uploads,
    music: genres.size >= 3 ? genresToProfile(genres, 0) : undefined,
    dataPoints: items.length + channels.size,
  })
}
