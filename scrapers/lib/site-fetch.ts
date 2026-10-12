import { robotsAllow, sameSite } from '../../lib/official-facts.ts'

type Page = { status: number; text: string }
const UA = 'Mozilla/5.0 (compatible; wasstudieren-bot/1.0; +https://wasstudieren.ch)'

/** Every request, including robots, sitemaps and redirects, uses the same paced reader. */
export function siteReader(pause = 1500, request: typeof fetch = fetch) {
  let queue = Promise.resolve()
  let last = 0
  const rules = new Map<string, Promise<string>>()
  const raw = async (url: string, timeout: number, init: RequestInit) => {
    const before = queue
    let release!: () => void
    queue = new Promise<void>((resolve) => { release = resolve })
    await before
    try {
      const wait = last + pause - Date.now()
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      last = Date.now()
      return await request(url, { ...init, headers: { 'User-Agent': UA, 'Accept-Language': 'de-CH,de;q=0.9,fr;q=0.8,it;q=0.7,en;q=0.6', ...Object.fromEntries(new Headers(init.headers)) }, redirect: 'manual', signal: AbortSignal.timeout(timeout) })
    } finally { release() }
  }
  const read = async (url: string, timeout = 30_000, initial = url, redirects = 0, robots = false, init: RequestInit = {}): Promise<Page> => {
    try {
      if (!sameSite(initial, url) || redirects > 5) return { status: 403, text: '' }
      const origin = new URL(url).origin
      if (!robots && new URL(url).pathname !== '/robots.txt') {
        if (!rules.has(origin)) rules.set(origin, read(`${origin}/robots.txt`, timeout, `${origin}/robots.txt`, 0, true).then((r) => r.status === 200 ? r.text : r.status === 404 ? '' : 'User-agent: *\nDisallow: /'))
        if (!robotsAllow(await rules.get(origin)!, url)) return { status: 403, text: '' }
      }
      const response = await raw(url, timeout, init)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        const next = response.status === 303 || ([301, 302].includes(response.status) && init.method === 'POST') ? { ...init, method: 'GET', body: undefined } : init
        return location ? read(new URL(location, url).href, timeout, initial, redirects + 1, robots, next) : { status: response.status, text: '' }
      }
      return { status: response.status, text: response.ok ? await response.text() : '' }
    } catch { return { status: 0, text: '' } }
  }
  return (url: string, timeout = 30_000, init: RequestInit = {}) => read(url, timeout, url, 0, false, init)
}

export const fetchSite = siteReader()
