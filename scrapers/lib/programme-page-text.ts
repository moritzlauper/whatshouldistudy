import { pageText } from '../../lib/official-facts.ts'
import { fetchSite } from './site-fetch.ts'
import { headingsOf, verifiedProgrammeTitle } from '../../lib/page-match.ts'

/** Studyinfo's HTML is a JS shell. Read the same public education record instead. */
export async function programmePageText(url: string, read: typeof fetchSite = fetchSite, discovered?: { name: string; level: string }): Promise<{ status: number; text: string }> {
  const u = new URL(url)
  const oid = u.hostname === 'opintopolku.fi' && /^\/konfo\/(?:en|fi|sv)\/koulutus\/([\d.]+)$/.exec(u.pathname)?.[1]
  if (oid) {
    const res = await read(`https://opintopolku.fi/konfo-backend/koulutus/${oid}`, 15_000)
    if (res.status !== 200) return { status: res.status, text: '' }
    try {
      const record = JSON.parse(res.text)
      if (record.oid !== oid) return { status: 422, text: '' }
      // Only source-authored programme fields; no navigation or unrelated recommendations.
      const content = [record.nimi, record.metadata?.kuvaus, record.metadata?.tutkintonimike, record.metadata?.luokittelutermit]
      const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []
      return { status: 200, text: pageText(strings(content).join('\n')) }
    } catch { return { status: 422, text: '' } }
  }
  const res = await read(url, 15_000)
  if (res.status === 200 && discovered) {
    const { title, heading } = headingsOf(res.text)
    if (!verifiedProgrammeTitle(discovered, title, heading)) return { status: 422, text: '' }
  }
  return { status: res.status, text: res.status === 200 ? pageText(res.text) : '' }
}
