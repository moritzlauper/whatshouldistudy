import { NextResponse } from 'next/server'
import { actionsKeys, checkActionsToken } from '@/lib/actions-oidc.ts'
import { FACTS_COUNTRIES } from '@/lib/engine/programme-fit.ts'
import { beginFacts, command, commitFacts, partFacts, readFacts, storeConfig, validStoredFact } from '@/lib/facts-store.ts'
import { forgetCountry } from '@/lib/server/facts-db.ts'
import type { StoredFact } from '@/scrapers/lib/facts.ts'

export const maxDuration = 60
const PART_MAX = 100

/**
 * The job's door to the facts database (scrapers/programme-facts-store.ts). Only a
 * run of the facts workflow on main gets through, checked by its GitHub Actions
 * token (lib/actions-oidc.ts). Every other request gets 401 and no readings.
 */
export async function POST(req: Request) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  let claims = null
  try {
    claims = token ? checkActionsToken(token, await actionsKeys()) : null
  } catch {
    return NextResponse.json({ error: 'Keys unavailable.' }, { status: 503 })
  }
  if (!claims) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  const cfg = storeConfig()
  if (!cfg) return NextResponse.json({ error: 'Storage not configured.' }, { status: 503 })
  const body = (await req.json().catch(() => null)) as { action?: string; country?: string; programmes?: unknown[] } | null
  if (body?.action === 'ping') {
    try {
      return NextResponse.json({ ok: true, storage: (await command(cfg, ['PING'])) === 'PONG' })
    } catch {
      return NextResponse.json({ error: 'Storage unavailable.' }, { status: 503 })
    }
  }
  const country = typeof body?.country === 'string' ? body.country : ''
  if (!(FACTS_COUNTRIES as readonly string[]).includes(country)) return NextResponse.json({ error: 'No readings for this country.' }, { status: 400 })
  try {
    if (body?.action === 'read') return NextResponse.json({ programmes: await readFacts(cfg, country) }, { headers: { 'Cache-Control': 'no-store' } })
    if (body?.action === 'begin') {
      await beginFacts(cfg, country)
      return NextResponse.json({ ok: true })
    }
    if (body?.action === 'part') {
      const items = Array.isArray(body.programmes) ? body.programmes.map(validStoredFact) : []
      if (!items.length || items.length > PART_MAX || items.some((f) => !f)) return NextResponse.json({ error: 'Invalid readings.' }, { status: 400 })
      await partFacts(cfg, country, items as StoredFact[])
      return NextResponse.json({ ok: true })
    }
    if (body?.action === 'commit') {
      const stored = await commitFacts(cfg, country)
      forgetCountry(country)
      return NextResponse.json({ stored })
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (e) {
    const message = (e as Error).message
    if (message.includes('no readings')) return NextResponse.json({ error: 'No readings to store.' }, { status: 409 })
    console.error(`facts ingest: ${message}`)
    return NextResponse.json({ error: 'Storage unavailable.' }, { status: 503 })
  }
}
