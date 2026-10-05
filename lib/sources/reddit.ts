import { accumulate } from '../engine/accumulate.ts'
import { truncate } from '../engine/text.ts'
import type { SignalItem, SourceSummary } from '../engine/types.ts'
import { KNOWN_SUBREDDITS } from '../taxonomy/known.ts'
import { getJson } from './oauth.ts'
import type { Progress } from './oauth.ts'

/**
 * Reddit: the communities you joined are one of the clearest interest signals
 * there is (r/AskHistorians, r/learnprogramming, r/medicalschool). Saved and
 * upvoted posts and your own posts and comments add detail. NSFW communities
 * and posts are skipped entirely.
 */

const API = 'https://oauth.reddit.com'

interface Listing<T> {
  data: { children: Array<{ kind: string; data: T }>; after: string | null }
}

interface Subreddit {
  display_name: string
  title?: string
  public_description?: string
  over18?: boolean
  subscribers?: number
}

interface Thing {
  subreddit?: string
  title?: string
  selftext?: string
  body?: string
  link_title?: string
  over_18?: boolean
  created_utc?: number
  permalink?: string
}

async function list<T>(path: string, token: string, max: number): Promise<T[]> {
  const out: T[] = []
  let after: string | null = ''
  while (after !== null && out.length < max) {
    const sep = path.includes('?') ? '&' : '?'
    const page: Listing<T> = await getJson<Listing<T>>(`${API}${path}${sep}limit=100&raw_json=1${after ? `&after=${after}` : ''}`, token)
    out.push(...page.data.children.map((c) => c.data))
    after = page.data.after
  }
  return out.slice(0, max)
}

export async function collectReddit(token: string, onProgress: Progress = () => {}): Promise<SourceSummary> {
  const items: SignalItem[] = []
  const groupText = new Map<string, string>()
  const stats: Record<string, number> = {}

  onProgress('Reading your communities')
  const me = await getJson<{ name: string }>(`${API}/api/v1/me`, token)
  const subs = (await list<Subreddit>('/subreddits/mine/subscriber', token, 1000)).filter((s) => !s.over18)
  for (const s of subs) {
    const name = s.display_name.toLowerCase()
    const text = `${s.display_name} \n ${s.title ?? ''} \n ${truncate(s.public_description ?? '', 400)}`
    groupText.set(name, text)
    items.push({
      kind: 'subreddit',
      text,
      label: `r/${s.display_name}`,
      group: name,
      weight: 3,
      splitCamel: true,
      fieldHints: KNOWN_SUBREDDITS[name],
      learningPrior: 0.4,
      url: `https://www.reddit.com/r/${s.display_name}`,
    })
  }
  stats.communities = subs.length

  const fromThings = (things: Thing[], kind: string, weight: number, prefix: string) => {
    let n = 0
    for (const t of things) {
      if (t.over_18) continue
      const sub = (t.subreddit ?? '').toLowerCase()
      const title = t.title ?? t.link_title ?? ''
      const body = t.selftext ?? t.body ?? ''
      items.push({
        kind,
        text: `${title} \n ${truncate(body, 400)} \n ${t.subreddit ?? ''}`,
        label: `${prefix} in r/${t.subreddit}: ${truncate(title || body, 60)}`,
        group: sub || undefined,
        weight,
        time: t.created_utc ? t.created_utc * 1000 : undefined,
        fieldHints: KNOWN_SUBREDDITS[sub],
        url: t.permalink ? `https://www.reddit.com${t.permalink}` : undefined,
      })
      n++
    }
    return n
  }

  onProgress('Reading saved and upvoted posts')
  const safe = async <T,>(p: Promise<T[]>) => p.catch(() => [] as T[])
  stats.saved = fromThings(await safe(list<Thing>(`/user/${me.name}/saved`, token, 500)), 'saved', 1.2, 'Saved')
  stats.upvoted = fromThings(await safe(list<Thing>(`/user/${me.name}/upvoted`, token, 1000)), 'upvote', 0.6, 'Upvoted')
  onProgress('Reading your posts and comments')
  stats.posts = fromThings(await safe(list<Thing>(`/user/${me.name}/submitted`, token, 500)), 'post', 2, 'Your post')
  stats.comments = fromThings(await safe(list<Thing>(`/user/${me.name}/comments`, token, 1000)), 'comment', 0.8, 'Your comment')

  onProgress('Analysing', items.length)
  return accumulate(items, {
    source: 'reddit',
    label: 'Reddit account',
    groupText,
    stats,
    maker: stats.posts > 20 ? 1 : 0,
  })
}
