import { accumulate } from '../engine/accumulate.ts'
import { genresToProfile } from '../engine/music.ts'
import { truncate } from '../engine/text.ts'
import type { SignalItem, SourceSummary } from '../engine/types.ts'
import { getJson } from './oauth.ts'
import type { Progress } from './oauth.ts'

/**
 * Spotify Web API. Two kinds of signal:
 * - Podcasts, saved episodes and audiobooks are about topics: they run through
 *   the same field matcher as videos and say a lot ("Freakonomics", "Huberman
 *   Lab", "Lex Fridman").
 * - Music (top and followed artists with their genres) feeds the music-taste
 *   profile, a weak personality signal; it never counts as interest in a field.
 *
 * Note: apps in Spotify's development mode only work for up to 25 allow-listed
 * users; going public needs Spotify's extended quota approval.
 */

const API = 'https://api.spotify.com/v1'

interface Paged<T> {
  items: T[]
  next: string | null
}

interface Artist {
  id: string
  name: string
  genres?: string[]
}

interface Show {
  id: string
  name: string
  description?: string
  publisher?: string
}

async function all<T>(url: string, token: string, max: number): Promise<T[]> {
  const out: T[] = []
  let next: string | null = url
  while (next && out.length < max) {
    const page: Paged<T> = await getJson<Paged<T>>(next, token)
    out.push(...page.items)
    next = page.next
  }
  return out.slice(0, max)
}

export async function collectSpotify(token: string, onProgress: Progress = () => {}): Promise<SourceSummary> {
  const items: SignalItem[] = []
  const stats: Record<string, number> = {}
  const genres = new Map<string, number>()
  const artists = new Map<string, Artist>()

  onProgress('Reading your top artists')
  const ranges: Array<[string, number]> = [
    ['long_term', 3],
    ['medium_term', 2],
    ['short_term', 1],
  ]
  for (const [range, w] of ranges) {
    const top = await getJson<Paged<Artist>>(`${API}/me/top/artists?time_range=${range}&limit=50`, token)
    top.items.forEach((a, i) => {
      artists.set(a.id, a)
      // Higher-ranked artists and longer time ranges count more.
      const rankWeight = w * (1 - i / 75)
      for (const g of a.genres ?? []) genres.set(g, (genres.get(g) ?? 0) + rankWeight)
    })
  }

  onProgress('Reading artists you follow')
  let followed: Artist[] = []
  try {
    let next: string | null = `${API}/me/following?type=artist&limit=50`
    while (next && followed.length < 500) {
      const page: { artists: Paged<Artist> & { cursors?: { after?: string } } } = await getJson(next, token)
      followed = followed.concat(page.artists.items)
      next = page.artists.next
    }
  } catch {
    // optional
  }
  for (const a of followed) {
    artists.set(a.id, a)
    for (const g of a.genres ?? []) genres.set(g, (genres.get(g) ?? 0) + 1)
  }

  onProgress('Reading your top tracks')
  const tracks = await getJson<Paged<{ id: string }>>(`${API}/me/top/tracks?time_range=long_term&limit=50`, token)
  const recent = await getJson<Paged<unknown>>(`${API}/me/player/recently-played?limit=50`, token)
  stats.topArtists = artists.size
  stats.followedArtists = followed.length
  stats.topTracks = tracks.items.length
  stats.recentPlays = recent.items.length

  onProgress('Reading your podcasts')
  const shows = await all<{ added_at: string; show: Show }>(`${API}/me/shows?limit=50`, token, 300)
  for (const s of shows) {
    items.push({
      kind: 'podcast',
      text: `${s.show.name} \n ${s.show.publisher ?? ''} \n ${truncate(s.show.description ?? '', 600)}`,
      label: s.show.name,
      group: s.show.id,
      weight: 3,
      time: Date.parse(s.added_at),
      learningPrior: 0.5,
      url: `https://open.spotify.com/show/${s.show.id}`,
    })
  }
  stats.savedPodcasts = shows.length

  const episodes = await all<{ added_at: string; episode: { name: string; description?: string; show?: Show } }>(
    `${API}/me/episodes?limit=50`,
    token,
    500,
  )
  for (const e of episodes) {
    items.push({
      kind: 'episode',
      text: `${e.episode.name} \n ${e.episode.show?.name ?? ''} \n ${truncate(e.episode.description ?? '', 300)}`,
      label: e.episode.show?.name ? `${truncate(e.episode.name, 60)} (${e.episode.show.name})` : truncate(e.episode.name, 80),
      group: e.episode.show?.id,
      weight: 1.2,
      time: Date.parse(e.added_at),
      learningPrior: 0.5,
    })
  }
  stats.savedEpisodes = episodes.length

  onProgress('Reading your audiobooks')
  try {
    const books = await all<{ name: string; description?: string; authors?: Array<{ name: string }> }>(
      `${API}/me/audiobooks?limit=50`,
      token,
      200,
    )
    for (const b of books) {
      items.push({
        kind: 'book',
        text: `${b.name} \n ${truncate(b.description ?? '', 500)}`,
        label: `Audiobook: ${truncate(b.name, 70)}`,
        weight: 2,
        learningPrior: 0.5,
      })
    }
    stats.audiobooks = books.length
  } catch {
    // Audiobooks aren't available in every market.
  }

  try {
    const playlists = await all<{ name: string; description?: string; owner?: { id?: string } }>(`${API}/me/playlists?limit=50`, token, 200)
    for (const p of playlists) {
      // Playlist names say little ("chill", "gym"), but "study: organic chemistry" says a lot.
      items.push({ kind: 'playlist', text: `${p.name} ${p.description ?? ''}`, label: `Playlist "${truncate(p.name, 50)}"`, weight: 0.5 })
    }
    stats.playlists = playlists.length
  } catch {
    // optional
  }

  const music = genres.size ? genresToProfile(genres, artists.size) : undefined
  onProgress('Analysing', items.length)
  return accumulate(items, {
    source: 'spotify',
    label: 'Spotify account',
    stats,
    music,
    dataPoints: items.length + artists.size + tracks.items.length + recent.items.length,
    notes: genres.size ? undefined : ['Spotify did not return genres for your artists, so music taste was skipped.'],
  })
}
