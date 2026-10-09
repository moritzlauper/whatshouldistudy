import 'server-only'
import { readFile } from 'node:fs/promises'
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'
import { join } from 'node:path'
import type { CatalogueShard, DataMeta, FieldStat, ProgrammeShard, ResearchShard } from '../programmes.ts'
import type { DirectoryEntry } from '../../scrapers/global-directory.ts'

/**
 * Where the programme database comes from, in order:
 * 1. WSIS_DATA_URL, e.g. https://raw.githubusercontent.com/<owner>/<repo>/whatshouldistudy-data
 * 2. The data branch of the repository Vercel deploys from (VERCEL_GIT_REPO_*),
 *    so moving the project to another repository needs no configuration.
 * 3. The bundled demo dataset in data/sample.
 */

const SAMPLE_DIR = join(process.cwd(), 'data', 'sample')
const TTL = 6 * 3600 * 1000

function remoteBase(): string | null {
  if (process.env.WSIS_DATA_URL) return process.env.WSIS_DATA_URL.replace(/\/$/, '')
  const owner = process.env.VERCEL_GIT_REPO_OWNER
  const slug = process.env.VERCEL_GIT_REPO_SLUG
  if (owner && slug) return `https://raw.githubusercontent.com/${owner}/${slug}/whatshouldistudy-data`
  return null
}

const cache = new Map<string, { at: number; value: unknown; sample: boolean }>()

/**
 * Programme shards and catalogues exceed the 2 MB limit of Next's fetch cache,
 * and an uncached fetch() would turn the cached pages that read them dynamic
 * (a 500 at runtime). They are fetched outside Next's fetch and kept in the
 * in-memory cache above instead.
 */
function getUntracked(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = (url.startsWith('https:') ? httpsGet : httpGet)(url, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(30_000, () => req.destroy(new Error(`timeout ${url}`)))
  })
}

/** One file from the data branch; a server error counts as a failure, a 404 as an answer. */
async function fetchRemote<T>(url: string, big: boolean): Promise<{ status: number; value?: T }> {
  if (big) {
    const res = await getUntracked(url)
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
    return { status: res.status, value: res.status === 200 ? (JSON.parse(res.body) as T) : undefined }
  }
  const res = await fetch(url, { next: { revalidate: TTL / 1000 } })
  if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
  return { status: res.status, value: res.ok ? ((await res.json()) as T) : undefined }
}

async function load<T>(path: string): Promise<{ value: T | null; sample: boolean }> {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < TTL) return { value: hit.value as T, sample: hit.sample }
  const base = remoteBase()
  if (base) {
    const big = path.startsWith('programmes/') || path.startsWith('catalogue/')
    let res: { status: number; value?: T } | undefined
    let error: unknown
    for (let attempt = 0; attempt < 3 && !res; attempt++) {
      try {
        res = await fetchRemote<T>(`${base}/${path}`, big)
      } catch (e) {
        error = e
        await new Promise((ok) => setTimeout(ok, 500 * 2 ** attempt))
      }
    }
    // Unreachable data must not quietly become the demo data: the error keeps the previous page or deployment.
    if (!res) throw new Error(`Data: ${path} unreachable (${(error as Error).message})`)
    if (res.value !== undefined) {
      cache.set(path, { at: Date.now(), value: res.value, sample: false })
      return { value: res.value, sample: false }
    }
    if (res.status === 404) {
      // The data branch exists but doesn't have this file (e.g. no research for a field).
      const meta = cache.get('meta.json')
      if (meta && !meta.sample) {
        cache.set(path, { at: Date.now(), value: null, sample: false })
        return { value: null, sample: false }
      }
    }
  }
  try {
    const value = JSON.parse(await readFile(join(SAMPLE_DIR, path), 'utf8')) as T
    cache.set(path, { at: Date.now(), value, sample: true })
    return { value, sample: true }
  } catch {
    cache.set(path, { at: Date.now(), value: null, sample: true })
    return { value: null, sample: true }
  }
}

export async function getMeta(): Promise<{ meta: DataMeta | null; sample: boolean }> {
  const { value, sample } = await load<DataMeta>('meta.json')
  return { meta: value, sample }
}

export async function getStats(): Promise<Record<string, FieldStat>> {
  return (await load<Record<string, FieldStat>>('stats.json')).value ?? {}
}

export async function getShard(field: string): Promise<ProgrammeShard | null> {
  if (!/^[a-z-]+$/.test(field)) return null
  return (await load<ProgrammeShard>(`programmes/${field}.json`)).value
}

export async function getResearch(field: string): Promise<ResearchShard | null> {
  if (!/^[a-z-]+$/.test(field)) return null
  return (await load<ResearchShard>(`research/${field}.json`)).value
}

export async function getDirectory(country: string): Promise<DirectoryEntry[]> {
  if (!/^[A-Z]{2}$/.test(country)) return []
  return (await load<DirectoryEntry[]>(`directory/${country}.json`)).value ?? []
}

/** The free catalogue of a country's programmes; null before the data run that adds it. */
export async function getCatalogue(country: string): Promise<CatalogueShard | null> {
  if (!/^[A-Z]{2}$/.test(country)) return null
  // With meta.json from the data branch in the cache, a missing catalogue there is null, not the demo data.
  await getMeta()
  return (await load<CatalogueShard>(`catalogue/${country}.json`)).value
}
