import { NextResponse } from 'next/server'
import { getDirectory, getResearch } from '@/lib/server/data.ts'
import { bearer, verifyToken } from '@/lib/server/token.ts'
import { FIELD_BY_ID } from '@/lib/taxonomy/fields.ts'

/**
 * Countries without programme-level data: universities strongest in the
 * person's fields (research profiles), plus the full list of universities.
 * Paid; the free tier gets counts only.
 */
export async function POST(req: Request) {
  const paid = !!verifyToken(bearer(req))
  const body = (await req.json().catch(() => null)) as { fields?: string[]; countries?: string[] } | null
  const fields = (body?.fields ?? []).filter((f) => FIELD_BY_ID[f]).slice(0, 6)
  const countries = (body?.countries ?? []).filter((c) => /^[A-Z]{2}$/.test(c)).slice(0, 40)
  if (!fields.length || !countries.length) return NextResponse.json({ error: 'Send fields and countries.' }, { status: 400 })

  const shards = await Promise.all(fields.map((f) => getResearch(f)))
  const byCountry: Record<string, { research: Record<string, unknown[]>; directory: number; universities?: unknown[] }> = {}
  for (const cc of countries) {
    const research: Record<string, unknown[]> = {}
    shards.forEach((s, i) => {
      const list = s?.byCountry[cc] ?? []
      if (list.length) research[fields[i]] = paid ? list : list.map(() => ({}))
    })
    const dir = await getDirectory(cc)
    byCountry[cc] = { research, directory: dir.length, universities: paid ? dir : undefined }
  }
  return NextResponse.json({ paid, byCountry })
}
