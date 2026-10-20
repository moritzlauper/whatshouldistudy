import { timingSafeEqual } from 'node:crypto'
import { validParticipant } from '@/lib/paywall-experiment.ts'
import { SITES } from '@/lib/site/config.ts'
import type { SiteId } from '@/lib/site/config.ts'
import { enrolPaywall, readPaywallReport, withdrawPaywall } from '@/lib/server/paywall-experiment.ts'
import { usageConfigured } from '@/lib/server/usage.ts'

const headers = { 'Cache-Control': 'private, no-store' }
async function input(req: Request) {
  if (req.headers.get('sec-fetch-site') === 'cross-site' || !req.headers.get('content-type')?.startsWith('application/json')) return null
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) return null
  const reader = req.body?.getReader()
  if (!reader) return null
  let body = ''
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      body += decoder.decode(value, { stream: true })
      if (body.length > 256) { await reader.cancel(); return null }
    }
    const v = JSON.parse(body + decoder.decode())
    if (!v || Object.keys(v).some(k => !['id', 'site'].includes(k)) || !validParticipant(v.id) || !Object.hasOwn(SITES, v.site)) return null
    return { id: v.id as string, site: v.site as SiteId }
  } catch { return null }
}

export async function POST(req: Request) {
  const v = await input(req)
  if (!v) return Response.json({ error: 'Invalid experiment request' }, { status: 400, headers })
  try {
    return Response.json({ assignment: await enrolPaywall(v.site, v.id) }, { headers })
  } catch {
    return Response.json({ error: 'Experiment unavailable' }, { status: 503, headers })
  }
}

export async function DELETE(req: Request) {
  const v = await input(req)
  if (!v) return new Response(null, { status: 400, headers })
  try {
    await withdrawPaywall(v.site, v.id)
    return new Response(null, { status: 204, headers })
  } catch { return new Response(null, { status: 503, headers }) }
}

export async function GET(req: Request) {
  const secret = process.env.USAGE_ADMIN_TOKEN
  const have = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret ?? ''}`)
  if (!secret || have.length !== want.length || !timingSafeEqual(have, want)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
  if (!usageConfigured()) return Response.json({ error: 'Experiment storage unavailable' }, { status: 503, headers })
  try { return Response.json(await readPaywallReport(), { headers }) }
  catch { return Response.json({ error: 'Experiment storage unavailable' }, { status: 503, headers }) }
}
