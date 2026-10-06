import { truncate } from '../engine/text.ts'
import type { SignalItem } from '../engine/types.ts'
import { KNOWN_SUBREDDITS } from '../taxonomy/known.ts'

/**
 * Reddit's data export (Settings → Request your data): a ZIP of CSV files.
 * Reddit is closing its public API (no new apps after 31 October 2026, off
 * in March 2027), so the export is the way in: communities you joined,
 * upvoted and saved posts, your own posts and comments. Votes and saves carry
 * no title, but the permalink does (/r/AskSociology/comments/abc/why_do_people/).
 *
 * Direct messages and chats (messages.csv, chat_history.csv …) are never read.
 */

/** Files with private messages: skipped by name, before they are even unpacked. */
export const REDDIT_PRIVATE = /(^|\/)(messages|messages_archive|message_headers|chat_history|chat_\w+)\.csv$/i

/** Communities we don't read at all. */
const NSFW = /nsfw|gonewild|onlyfans|nude|nudes|xxx|hentai|rule34|r34|porn(?!.*(map|earth|space|city|architecture|food|history|cabin|sky))|sex(?!.*(education|ed\b))|milf|boobs|thick/i

export interface RedditStats {
  communities?: number
  upvoted?: number
  saved?: number
  posts?: number
  comments?: number
}

const hints = (sub: string) => KNOWN_SUBREDDITS[sub.toLowerCase()]

/** «r/AskSociology» and «why do people …» from a permalink. */
export function fromPermalink(url: string): { sub?: string; title?: string } {
  const m = /\/r\/([\w-]+)\/comments\/\w+\/([^/?#]*)/.exec(url)
  if (!m) return { sub: /\/r\/([\w-]+)/.exec(url)?.[1] }
  const title = decodeURIComponent(m[2]).replace(/_/g, ' ').trim()
  return { sub: m[1], title: title || undefined }
}

const time = (s?: string) => {
  if (!s) return undefined
  const t = Date.parse(s.replace(' UTC', 'Z').replace(' ', 'T'))
  return Number.isFinite(t) ? t : undefined
}

/**
 * Items from one CSV of the export, or null when it isn't one of Reddit's.
 * `header` is lower-case; rows are the CSV body.
 */
export function readRedditCsv(name: string, header: string[], rows: string[][], stats: RedditStats): SignalItem[] | null {
  if (REDDIT_PRIVATE.test(name) || header.includes('from') || header.includes('thread_id')) return null
  const col = (h: string) => header.indexOf(h)
  const items: SignalItem[] = []
  const short = name.split('/').pop()?.toLowerCase() ?? ''

  // subscribed_subreddits.csv: one column, «subreddit».
  if (header.length <= 2 && col('subreddit') >= 0 && col('permalink') < 0) {
    const i = col('subreddit')
    for (const r of rows) {
      const sub = (r[i] ?? '').trim()
      if (!sub || NSFW.test(sub)) continue
      items.push({ kind: 'subreddit', text: sub, label: `r/${sub}`, group: sub.toLowerCase(), weight: 3, splitCamel: true, fieldHints: hints(sub), learningPrior: 0.4, url: `https://www.reddit.com/r/${sub}` })
    }
    stats.communities = (stats.communities ?? 0) + items.length
    return items
  }

  const p = col('permalink')
  if (p < 0) return null
  const sub = col('subreddit')
  const title = col('title')
  const body = col('body')
  const date = col('date')
  const direction = col('direction')

  // posts.csv and comments.csv: what you wrote, with a date.
  if (sub >= 0 && body >= 0) {
    const isPost = title >= 0
    for (const r of rows) {
      const s = r[sub] ?? fromPermalink(r[p] ?? '').sub ?? ''
      if (NSFW.test(s)) continue
      const t = isPost ? (r[title] ?? '') : (fromPermalink(r[p] ?? '').title ?? '')
      const b = r[body] ?? ''
      if (!t && b.length < 3) continue
      items.push({
        kind: isPost ? 'post' : 'comment',
        text: `${t} \n ${truncate(b, 400)} \n ${s}`,
        label: isPost ? `${truncate(t || b, 140)} · r/${s}` : `“${truncate(b, 140)}” · r/${s}`,
        group: s.toLowerCase() || undefined,
        weight: isPost ? 2 : 0.8,
        time: time(r[date]),
        fieldHints: hints(s),
        url: r[p] || undefined,
      })
    }
    if (isPost) stats.posts = (stats.posts ?? 0) + items.length
    else stats.comments = (stats.comments ?? 0) + items.length
    return items
  }

  // post_votes.csv, comment_votes.csv, saved_posts.csv, saved_comments.csv: only a permalink.
  const saved = /saved/.test(short)
  const onComment = /comment/.test(short)
  if (!saved && direction < 0) return null
  for (const r of rows) {
    if (direction >= 0 && r[direction] !== 'up') continue
    const { sub: s, title: t } = fromPermalink(r[p] ?? '')
    if (!s || !t || NSFW.test(s)) continue
    items.push({
      kind: saved ? 'saved' : 'upvote',
      text: `${t} \n ${s}`,
      label: `${truncate(t, 140)} · r/${s}`,
      group: s.toLowerCase(),
      // A vote on a comment says less about the thread's topic than one on the post.
      weight: saved ? 1.2 : onComment ? 0.3 : 0.6,
      fieldHints: hints(s),
      url: r[p] || undefined,
    })
  }
  if (saved) stats.saved = (stats.saved ?? 0) + items.length
  else stats.upvoted = (stats.upvoted ?? 0) + items.length
  return items
}
