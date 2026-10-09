import 'server-only'
import { readFile } from 'node:fs/promises'
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

async function load<T>(path: string): Promise<{ value: T | null; sample: boolean }> {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < TTL) return { value: hit.value as T, sample: hit.sample }
  const base = remoteBase()
  if (base) {
    try {
      // Programme shards and catalogues can exceed the 2 MB limit of Next's
      // fetch cache; they live in the in-memory cache above instead.
      const big = path.startsWith('programmes/') || path.startsWith('catalogue/')
      const res = await fetch(`${base}/${path}`, big ? { cache: 'no-store' } : { next: { revalidate: TTL / 1000 } })
      if (res.ok) {
        const value = (await res.json()) as T
        cache.set(path, { at: Date.now(), value, sample: false })
        return { value, sample: false }
      }
      if (res.status === 404) {
        // The data branch exists but doesn't have this file (e.g. no research for a field).
        const meta = cache.get('meta.json')
        if (meta && !meta.sample) {
          cache.set(path, { at: Date.now(), value: null, sample: false })
          return { value: null, sample: false }
        }
      }
    } catch {
      // fall through to the sample
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
