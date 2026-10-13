import 'server-only'
import { readFile } from 'node:fs/promises'
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'
import { join } from 'node:path'
import { JOB_SOURCES } from '../work/sources.ts'
import { isCurrentJob, jobUrl, SECTORS } from '../work/types.ts'
import type { JobsData } from '../work/types.ts'

function validate(value: unknown): JobsData {
  const data = value as JobsData
  if (!data || data.version !== 1 || !Array.isArray(data.jobs) || data.jobs.length > 25_000 || !Array.isArray(data.sources)) throw new Error('Invalid jobs dataset')
  const ids = new Set(JOB_SOURCES.map((s) => s.id))
  for (const j of data.jobs) {
    if (!ids.has(j.sourceId) || typeof j.title !== 'string' || typeof j.company !== 'string' || typeof j.city !== 'string' || typeof j.id !== 'string' || j.country !== 'CH' || !jobUrl(j.url) || !Array.isArray(j.occupationIds) || !j.occupationIds.every((id) => typeof id === 'string') || !['onsite', 'hybrid', 'remote', 'unknown'].includes(j.workplace) || !['training', 'junior', 'experienced', 'unknown'].includes(j.entry) || (j.sector !== undefined && !SECTORS.includes(j.sector))) throw new Error('Invalid job')
  }
  return { ...data, jobs: data.jobs.filter((j) => isCurrentJob(j)) }
}

const TTL = 3600_000
const MAX_BYTES = 20_000_000
let cached: { url: string; at: number; data: JobsData } | undefined
let pending: { url: string; value: Promise<JobsData> } | undefined

/** Like the larger programme shards, this file can exceed Next's 2 MB fetch
 * cache limit. Use a bounded native request and a shared hourly memory cache. */
function loadRemote(url: string): Promise<JobsData> {
  if (cached?.url === url && Date.now() - cached.at < TTL) return Promise.resolve(cached.data)
  if (pending?.url === url) return pending.value
  const value = new Promise<JobsData>((resolve, reject) => {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol)) { reject(new Error('Invalid jobs URL')); return }
    const request = (parsed.protocol === 'https:' ? httpsGet : httpGet)(parsed, (response) => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error('Jobs unavailable')); return }
      const chunks: Buffer[] = []
      let bytes = 0
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > MAX_BYTES) { request.destroy(new Error('Jobs too large')); return }
        chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => {
        try { resolve(validate(JSON.parse(Buffer.concat(chunks).toString('utf8')))) } catch (error) { reject(error) }
      })
    })
    request.on('error', reject)
    request.setTimeout(15_000, () => request.destroy(new Error('Jobs timeout')))
  }).then((data) => {
    cached = { url, at: Date.now(), data }
    return data
  }).finally(() => { pending = undefined })
  pending = { url, value }
  return value
}

/** Public job facts only. No profile is received and no paid dataset is read. */
export async function getJobs(): Promise<{ data: JobsData; unavailable: boolean }> {
  const owner = process.env.VERCEL_GIT_REPO_OWNER
  const repo = process.env.VERCEL_GIT_REPO_SLUG
  const remote = process.env.WSIS_JOBS_URL || (owner && repo ? `https://raw.githubusercontent.com/${owner}/${repo}/whatshouldistudy-jobs/jobs.json` : '')
  let unavailable = false
  if (remote) {
    try {
      const data = await loadRemote(remote)
      return { data: { ...data, jobs: data.jobs.filter((job) => isCurrentJob(job)) }, unavailable: false }
    } catch {
      unavailable = true
      if (cached?.url === remote) return { data: { ...cached.data, jobs: cached.data.jobs.filter((job) => isCurrentJob(job)) }, unavailable }
    }
  }
  try {
    return { data: validate(JSON.parse(await readFile(join(process.cwd(), 'data/jobs/current.json'), 'utf8'))), unavailable }
  } catch {
    return { data: { version: 1, generatedAt: '', jobs: [], sources: [] }, unavailable: true }
  }
}
