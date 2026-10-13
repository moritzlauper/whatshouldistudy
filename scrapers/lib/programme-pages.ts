import { sameSite } from '../../lib/official-facts.ts'
import { officialPageOf } from '../../lib/official-pages.ts'
import { headingsOf, NOT_A_PROGRAMME, sitemapLocs, STUDY_PATH, verifiedProgrammeTitle } from '../../lib/page-match.ts'
import { fetchSite } from './site-fetch.ts'

export interface PageRow {
  id: string; name: string; level: string; country: string
  institutionUrl?: string; url?: string; source?: string
}
export interface PageIndex {
  pages: Record<string, { url: string; title: string; heading: string }>
  hosts: Record<string, { at: string; offset: number }>
  attempts: Record<string, string>
}
export const emptyPageIndex = (): PageIndex => ({ pages: {}, hosts: {}, attempts: {} })

export function isProgrammeUrl(url: string, institutionUrl?: string): boolean {
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return false
    const path = u.pathname.replace(/\/+$/, '')
    if (!path || /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/?|index\.(?:html?|php)|home)$/i.test(path)) return false
    if (institutionUrl && (u.href.replace(/\/+$/, '') === institutionUrl.replace(/\/+$/, '') || !sameSite(url, institutionUrl))) return false
    return true
  } catch { return false }
}

/** Explicit national programme records are authoritative even on a different host. */
export function registryPage(p: PageRow): string | undefined {
  try {
    const u = new URL(p.url ?? '')
    if (u.protocol !== 'https:') return undefined
    const valid =
      (p.country === 'GB' && p.source === 'uk-discover-uni' && u.hostname === 'discoveruni.gov.uk' && /^\/course-details\/[^/]+\/[^/]+\/[^/]+\/?$/.test(u.pathname)) ||
      (p.country === 'FR' && p.source === 'fr-parcoursup' && u.hostname === 'dossierappel.parcoursup.fr' && u.pathname === '/Candidats/public/fiches/afficherFicheFormation' && /^\d+$/.test(u.searchParams.get('g_ta_cod') ?? '')) ||
      (p.country === 'FI' && p.source === 'fi-opintopolku' && u.hostname === 'opintopolku.fi' && /^\/konfo\/(en|fi|sv)\/koulutus\/[\d.]+$/.test(u.pathname))
    return valid ? u.href : undefined
  } catch { return undefined }
}

export function programmePage(p: PageRow, index = emptyPageIndex()): string | undefined {
  const checked = officialPageOf(p)
  if (checked) return checked
  const found = index.pages[p.id]
  if (found && p.institutionUrl && isProgrammeUrl(found.url, p.institutionUrl) && verifiedProgrammeTitle(p, found.title, found.heading)) return found.url
  if (p.url && isProgrammeUrl(p.url, p.institutionUrl)) return p.url
  return registryPage(p)
}

type Reader = typeof fetchSite
const studyPage = (url: string, home: string) => {
  try {
    const path = decodeURIComponent(new URL(url).pathname)
    return isProgrammeUrl(url, home) && STUDY_PATH.test(path) && !NOT_A_PROGRAMME.test(path)
  } catch { return false }
}

/** Bounded sitemap traversal; all reads (including redirects) honour robots and pacing. */
export async function institutionPages(home: string, read: Reader = fetchSite): Promise<string[]> {
  const origin = new URL(home).origin
  const robots = await read(`${origin}/robots.txt`, 15_000)
  const declared = [...robots.text.matchAll(/^Sitemap:\s*(https?:\/\/\S+)/gim)].map((m) => m[1]).filter((u) => sameSite(u, home))
  const queue = [...new Set([...declared, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`])]
  const visited = new Set<string>(), pages = new Set<string>()
  while (queue.length && visited.size < 20) {
    const url = queue.shift()!
    if (visited.has(url)) continue
    visited.add(url)
    const res = await read(url, 15_000)
    if (res.status !== 200) continue
    const urls = sitemapLocs(res.text).filter((u) => sameSite(u, home))
    if (/<sitemapindex\b/i.test(res.text)) queue.push(...urls)
    else for (const u of urls) if (studyPage(u, home)) pages.add(u)
  }
  if (!pages.size) {
    const hubs = [home]
    for (let i = 0; i < hubs.length && i < 12; i++) {
      const res = await read(hubs[i], 15_000)
      if (res.status !== 200) continue
      for (const m of res.text.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
        try {
          const url = new URL(m[1].replace(/&amp;/g, '&'), hubs[i]).href
          if (studyPage(url, home) && !pages.has(url)) { pages.add(url); hubs.push(url) }
        } catch { /* Ignore malformed links. */ }
      }
    }
  }
  return [...pages].sort()
}

/** Only an unambiguous page with programme-name AND degree evidence is accepted. */
export async function discoverPages(rows: PageRow[], index: PageIndex, options: { maxHosts: number; maxPages: number; hosts?: string[] }, read: Reader = fetchSite) {
  const groups = new Map<string, PageRow[]>()
  for (const p of rows) {
    if (!p.institutionUrl || (programmePage(p, index) && !registryPage(p))) continue
    try {
      const host = new URL(p.institutionUrl).hostname.replace(/^www\./, '')
      if (options.hosts?.length && !options.hosts.includes(host)) continue
      groups.set(host, [...(groups.get(host) ?? []), p])
    } catch { /* Missing website remains unknown. */ }
  }
  const hosts = [...groups.keys()].sort((a, b) => (index.hosts[a]?.at ?? '').localeCompare(index.hosts[b]?.at ?? '') || a.localeCompare(b)).slice(0, options.maxHosts)
  let found = 0
  for (const host of hosts) {
    const programmes = [...new Map(groups.get(host)!.map((p) => [p.id, p])).values()]
    const home = programmes[0].institutionUrl!
    const pages = await institutionPages(home, read)
    const offset = (index.hosts[host]?.offset ?? 0) < pages.length ? index.hosts[host]?.offset ?? 0 : 0
    const matches = new Map<string, Array<{ url: string; title: string; heading: string }>>()
    for (const url of pages.slice(offset, offset + options.maxPages)) {
      const res = await read(url, 15_000)
      if (res.status !== 200) continue
      const heading = headingsOf(res.text)
      for (const p of programmes) if (verifiedProgrammeTitle(p, heading.title, heading.heading)) matches.set(p.id, [...(matches.get(p.id) ?? []), { url, ...heading }])
    }
    for (const [id, candidates] of matches) if (candidates.length === 1) { index.pages[id] = candidates[0]; found++ }
    index.hosts[host] = { at: new Date().toISOString(), offset: offset + options.maxPages >= pages.length ? 0 : offset + options.maxPages }
    console.log(`${host}: ${pages.length} candidate pages, ${matches.size} programme matches`)
  }
  return { hosts: hosts.length, found }
}
