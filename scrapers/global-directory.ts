/**
 * Worldwide directory of universities (Hipo university-domains-list, MIT):
 * ~10,000 institutions in ~200 countries with their websites. The fallback
 * for countries where we have neither programme data nor research profiles:
 * at least a list of universities and a direct search into their programmes.
 */
import { join } from 'node:path'
import { OUT, getJson, isMain, log, writeJson } from './lib/common.ts'

const URL = 'https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json'

export interface RawUniversity {
  name: string
  alpha_two_code: string
  country?: string
  web_pages?: string[]
  domains?: string[]
  'state-province'?: string | null
}

export interface DirectoryEntry {
  name: string
  url?: string
  domain?: string
  region?: string
}

export function buildDirectory(raw: RawUniversity[]): Record<string, DirectoryEntry[]> {
  const out: Record<string, DirectoryEntry[]> = {}
  const seen = new Set<string>()
  for (const u of raw) {
    const cc = u.alpha_two_code?.toUpperCase()
    if (!cc || !u.name) continue
    const key = `${cc}|${u.name.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    ;(out[cc] ??= []).push({
      name: u.name.trim(),
      url: u.web_pages?.[0],
      domain: u.domains?.[0],
      region: u['state-province'] ?? undefined,
    })
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const raw = await getJson<RawUniversity[]>(URL)
  const byCountry = buildDirectory(raw)
  log(`Directory: ${raw.length} universities in ${Object.keys(byCountry).length} countries`)
  writeJson(join(OUT, 'global-directory.json'), { source: 'global-directory', fetchedAt, byCountry })
}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
