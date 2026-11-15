import 'server-only'
import { POSTS } from '../../content/blog/index.ts'
import { mergePosts } from '../blog.ts'
import type { Post } from '../blog-check.ts'
import { getUntracked } from './data.ts'

/**
 * The blog posts: those in content/blog plus those the blog Action publishes on
 * the branch «whatshouldistudy-blog» (posts.json, every post in one array). A
 * post there needs no deployment, so the ISR cache of the programme pages
 * survives it; the data branch can't hold the posts, every data run replaces it.
 *
 * Read at most once an hour per function instance, outside Next's fetch cache
 * so the pages stay static. When the branch can't be read: the posts read
 * last, else those in the repo, and another try after five minutes.
 */

const BRANCH = 'whatshouldistudy-blog'
const TTL = 3600 * 1000
const RETRY = 5 * 60 * 1000

function blogUrl(): string | null {
  if (process.env.WSIS_BLOG_URL) return process.env.WSIS_BLOG_URL
  const owner = process.env.VERCEL_GIT_REPO_OWNER
  const slug = process.env.VERCEL_GIT_REPO_SLUG
  return owner && slug ? `https://raw.githubusercontent.com/${owner}/${slug}/${BRANCH}/posts.json` : null
}

let last: { at: number; posts: Post[] } | null = null
let pending: Promise<Post[]> | null = null

export async function blogPosts(): Promise<Post[]> {
  if (last && Date.now() - last.at < TTL) return last.posts
  const url = blogUrl()
  if (!url) return POSTS
  pending ??= (async () => {
    try {
      const res = await getUntracked(url)
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
      const published: unknown = JSON.parse(res.body)
      if (!Array.isArray(published)) throw new Error('posts.json is not a list')
      last = { at: Date.now(), posts: mergePosts(POSTS, published) }
    } catch (e) {
      console.warn(`Blog: ${url} unreadable (${(e as Error).message})`)
      last = { at: Date.now() - TTL + RETRY, posts: last?.posts ?? POSTS }
    }
    return last.posts
  })().finally(() => {
    pending = null
  })
  return pending
}
