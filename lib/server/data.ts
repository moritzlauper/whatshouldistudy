import 'server-only'
import { readFile } from 'node:fs/promises'
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'
import { join } from 'node:path'
import { DataCache } from './data-cache.ts'
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

type Loaded<T> = { value: T | null; sample: boolean }
// A warm function must not retain every field and country a crawler visits.
// Parsed objects use more memory than their JSON; this caps retained source
// bytes at 32 MiB, not the function's total RSS.
const cache = new DataCache<Loaded<unknown>>(32 * 1024 * 1024, TTL)
const pending = new Map<string, Promise<Loaded<unknown>>>()

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
async function fetchRemote<T>(url: string, big: boolean): Promise<{ status: number; value?: T; bytes: number }> {
  if (big) {
    const res = await getUntracked(url)
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
    return { status: res.status, value: res.status === 200 ? (JSON.parse(res.body) as T) : undefined, bytes: Buffer.byteLength(res.body) }
  }
  const res = await fetch(url, { next: { revalidate: TTL / 1000 } })
  if (res.status >= 500) throw new Error(`HTTP ${res.status}`)
  const body = res.ok ? await res.text() : ''
  return { status: res.status, value: res.ok ? (JSON.parse(body) as T) : undefined, bytes: Buffer.byteLength(body) }
}

async function load<T>(path: string): Promise<Loaded<T>> {
  const hit = cache.get(path)
  if (hit) return hit as Loaded<T>
  const underway = pending.get(path)
  if (underway) return underway as Promise<Loaded<T>>
  // Metadata, the page and concurrent requests share one download and parse.
  const promise = loadFresh<T>(path).finally(() => pending.delete(path))
  pending.set(path, promise)
  return promise
}

async function loadFresh<T>(path: string): Promise<Loaded<T>> {
  const base = remoteBase()
  if (base) {
    const big = path.startsWith('programmes/') || path.startsWith('catalogue/')
    let res: { status: number; value?: T; bytes: number } | undefined
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
      cache.set(path, { value: res.value, sample: false }, res.bytes)
      return { value: res.value, sample: false }
    }
    if (res.status === 404) {
      // The data branch exists but doesn't have this file (e.g. no research for a field).
      const meta = path === 'meta.json' ? undefined : await getMeta()
      if (meta && !meta.sample) {
        cache.set(path, { value: null, sample: false }, 0)
        return { value: null, sample: false }
      }
    }
  }
  try {
    const body = await readFile(join(SAMPLE_DIR, path), 'utf8')
    const value = JSON.parse(body) as T
    cache.set(path, { value, sample: true }, Buffer.byteLength(body))
    return { value, sample: true }
  } catch {
    cache.set(path, { value: null, sample: true }, 0)
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
