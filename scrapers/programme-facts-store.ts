/**
 * Moves the facts database between this job and the site. The readings are kept
 * privately on the site (lib/facts-store.ts). This job reaches them through
 * /api/facts/ingest with the token GitHub Actions issues for the run, so no
 * database secret is needed here. Needs ACTIONS_ID_TOKEN_REQUEST_URL and
 * ACTIONS_ID_TOKEN_REQUEST_TOKEN, which a workflow with `id-token: write` gets.
 *
 *   node scrapers/programme-facts-store.ts ping --country CH        waits until the site stores readings
 *   node scrapers/programme-facts-store.ts pull --country CH --out <file>
 *   node scrapers/programme-facts-store.ts push --country CH --in <file>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { log, sleep } from './lib/common.ts'
import type { StoredFact } from './lib/facts.ts'

const AUDIENCE = 'wasstudieren-facts'
const PART = 100

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const endpoint = () => {
  const site = (process.env.WSIS_SITE_URL || 'https://wasstudieren.ch').replace(/\/$/, '')
  const base = (process.env.WSIS_BASE_PATH || '').replace(/\/$/, '')
  return `${site}${base}/api/facts/ingest`
}

/** A token for this run, which the site checks against the workflow. A new one for each call. */
async function identity(): Promise<string> {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
  const bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  if (!url || !bearer) throw new Error('No GitHub Actions identity here: this must run in a workflow with `id-token: write`.')
  const res = await fetch(`${url}&audience=${encodeURIComponent(AUDIENCE)}`, { headers: { Authorization: `Bearer ${bearer}` } })
  if (!res.ok) throw new Error(`identity token: HTTP ${res.status}`)
  return ((await res.json()) as { value: string }).value
}

async function post(token: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> }
}

/** A missing or refused identity throws here, so it is never mistaken for a site that is not up yet. */
async function ingest(body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  return post(await identity(), body)
}

async function must(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { status, json } = await ingest(body)
  if (status !== 200) throw new Error(`the site answered ${status}: ${json.error ?? 'no reason given'}`)
  return json
}

/** Waits until the site answers with its store. A new deployment may still be starting, so this waits up to 20 minutes. */
async function ping(country: string) {
  let unconfigured = 0
  for (let attempt = 1; attempt <= 40; attempt++) {
    const token = await identity()
    const reply: { status: number; json: Record<string, unknown> } = await post(token, { action: 'ping', country }).catch((e: Error) => ({
      status: 0,
      json: { error: e.message },
    }))
    const { status, json } = reply
    if (status === 200 && json.storage === true) return log(`the site's store answers (attempt ${attempt})`)
    if (status === 401) throw new Error(`the site does not accept this run: ${json.error}`)
    if (status === 503 && String(json.error).includes('not configured') && ++unconfigured >= 3) throw new Error('the site has no store configured (FACTS_REDIS_* or USAGE_*)')
    log(`no store answer yet (attempt ${attempt}, HTTP ${status || 'no response'}): ${json.error ?? 'waiting'}`)
    await sleep(30_000)
  }
  throw new Error('the site did not answer within 20 minutes')
}

async function main() {
  const [mode] = process.argv.slice(2)
  const country = arg('--country', 'CH')
  if (mode === 'ping') return ping(country)
  if (mode === 'pull') {
    const out = arg('--out', '')
    if (!out) throw new Error('usage: pull --country CH --out <file>')
    const { programmes } = (await must({ action: 'read', country })) as { programmes: Record<string, StoredFact> }
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, `${JSON.stringify({ country, programmes })}\n`)
    log(`${country}: ${Object.keys(programmes).length} readings stored`)
  } else if (mode === 'push') {
    const file = arg('--in', '')
    if (!file) throw new Error('usage: push --country CH --in <file>')
    const data = JSON.parse(readFileSync(file, 'utf8')) as { country?: string; programmes?: Record<string, StoredFact> }
    if (data.country && data.country !== country) throw new Error(`${file} holds ${data.country}, not ${country}`)
    const list = Object.values(data.programmes ?? {})
    if (!list.length) throw new Error(`nothing to store for ${country}: the stored readings are kept`)
    await must({ action: 'begin', country })
    for (let i = 0; i < list.length; i += PART) await must({ action: 'part', country, programmes: list.slice(i, i + PART) })
    const done = await must({ action: 'commit', country })
    log(`${country}: ${done.stored} readings stored`)
  } else {
    throw new Error('usage: node scrapers/programme-facts-store.ts ping|pull|push --country CH')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
