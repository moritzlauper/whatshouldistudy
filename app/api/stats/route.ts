import { NextResponse } from 'next/server'
import { getMeta, getStats } from '@/lib/server/data.ts'

/** Public aggregates: per-field programme counts and earnings, data freshness. */
export async function GET() {
  const [stats, { meta, sample }] = await Promise.all([getStats(), getMeta()])
  return NextResponse.json(
    { stats, sample, updated: meta?.updated, totals: meta?.totals, sources: meta?.sources },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  )
}
