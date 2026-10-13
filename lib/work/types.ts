export type Workplace = 'onsite' | 'hybrid' | 'remote' | 'unknown'
export type Entry = 'training' | 'junior' | 'experienced' | 'unknown'
export const SECTORS = ['finance', 'health', 'technology', 'retail', 'industry', 'transport', 'public', 'hospitality'] as const
export type Sector = (typeof SECTORS)[number]

export interface WorkPreferences {
  city: string
  workplace: Workplace | 'any'
  sector: Sector | 'any'
  entry: Entry | 'any'
}

export const DEFAULT_WORK_PREFERENCES: WorkPreferences = { city: '', workplace: 'any', sector: 'any', entry: 'any' }

export interface Job {
  id: string
  sourceId: string
  title: string
  company: string
  city: string
  country: 'CH'
  url: string
  workplace: Workplace
  entry: Entry
  sector?: Sector
  employment?: string
  department?: string
  postedAt?: string
  validThrough?: string
  checkedAt: string
  occupationIds: string[]
}

export interface JobSource {
  id: string
  name: string
  url: string
  sector?: Sector
  format?: 'prospective' | 'sbb'
  feedUrl?: string
}

export interface SourceRun {
  id: string
  ok: boolean
  checkedAt: string
  count: number
  error?: string
}

export interface JobsData {
  version: 1
  generatedAt: string
  jobs: Job[]
  sources: SourceRun[]
}

/** A stale scrape is never presented as a current opening. */
export const JOB_MAX_AGE_DAYS = 7

export function isCurrentJob(job: Job, now = Date.now()): boolean {
  const checked = Date.parse(job.checkedAt)
  const expires = job.validThrough ? Date.parse(job.validThrough) : Infinity
  return Number.isFinite(checked) && checked <= now + 60_000 && now - checked < JOB_MAX_AGE_DAYS * 86400_000 && expires > now
}

/** Only public advert paths on verified employer hosts. */
export function jobUrl(value: string): string | null {
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' || u.port || u.username || u.password) return null
    const uuid = '[\\da-f]{8}(?:-[\\da-f]{4}){3}-[\\da-f]{12}'
    const paths: Record<string, RegExp> = {
      'jobs.smartrecruiters.com': /^\/[A-Za-z0-9]+\/\d+(?:-[^/]*)?$/,
      'jobs.admin.ch': new RegExp(`^/offene-stellen/[^/]+/${uuid}$`, 'i'),
      'jobs.coopjobs.ch': new RegExp(`^/(?:offene-stellen|postes-vacantes|posti-vacanti)/[^/]+/${uuid}$`, 'i'),
      'jobs.fust.ch': new RegExp(`^/(?:offene-stellen|postes-vacants|posti-vacanti)/[^/]+/${uuid}$`, 'i'),
      'jobs.transgourmet.ch': new RegExp(`^/(?:offene-stellen|postes-vacantes|posti-vacanti)/[^/]+/${uuid}$`, 'i'),
      'jobs.sbb.ch': new RegExp(`^/v2/offene-stellen/[^/]+/${uuid}$`, 'i'),
    }
    if (!paths[u.hostname]?.test(u.pathname)) return null
    return `${u.origin}${u.pathname}`
  } catch { return null }
}
