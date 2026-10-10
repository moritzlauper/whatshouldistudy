import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { unstable_cache } from 'next/cache'
import { pageText, robotsAllow, sameSite, verified } from '../official-facts.ts'
import type { OfficialFacts, Raw } from '../official-facts.ts'

export type { OfficialFacts }

/**
 * Facts about one programme, read from its official page when a programme
 * page is rendered (no batch job), then cached for 30 days. Claude only sorts
 * what the page states into fixed categories: names of specialisations and a
 * few yes/no facts. No sentences of the page are kept or shown, and every
 * entry needs a short quote that occurs word for word on the page, so a
 * category the page does not state stays empty instead of being guessed.
 * Without ANTHROPIC_API_KEY, or where the page cannot be read, nothing.
 */

const UA = 'Mozilla/5.0 (compatible; wasstudieren-bot/1.0; +https://wasstudieren.ch)'
// Enough for a programme page; longer pages are mostly navigation and footer.
const MAX_CHARS = 40_000

const claim = { type: 'object', properties: { value: { type: 'boolean' }, quote: { type: 'string' } }, required: ['value', 'quote'], additionalProperties: false }

const SCHEMA = {
  type: 'object',
  properties: {
    specialisations: { type: 'array', items: { type: 'string' } },
    free_choice: claim,
    part_time: claim,
    start_autumn: claim,
    start_spring: claim,
    internship: claim,
    degree: { type: 'string' },
  },
  required: ['specialisations', 'free_choice', 'part_time', 'start_autumn', 'start_spring', 'internship', 'degree'],
  additionalProperties: false,
}

const SYSTEM = `You read the official web page of one university degree programme and fill in a fixed form with facts the page states explicitly about this programme. Never guess, never infer from what is usual, and never use outside knowledge.

- specialisations: the names of the programme's specialisations, majors, profiles, tracks or focus areas (German pages: Vertiefungen, Schwerpunkte, Profile, Majors, Studienrichtungen), copied exactly as written on the page, names only, no descriptions. Leave out minors offered to other programmes, single modules and courses, and links to other programmes. Empty if the page lists none.
- free_choice: true only if the page says there are no fixed specialisations and students put together their own focus from the modules.
- part_time: true only if the page says the programme can be studied part-time.
- start_autumn / start_spring: true only if the page says the programme can be started in the autumn (Herbstsemester, September) / spring (Frühjahrssemester, February) semester.
- internship: true only if the page says an internship or practical semester is part of the programme.
- degree: the exact degree title as written on the page (e.g. "Master of Science UZH in Psychologie"), or "" if the page does not name one.

For every true value, quote: a short passage of 3 to 12 words copied character for character from the page that states it. For every false value, quote: "".`

const client = () =>
  process.env.ANTHROPIC_API_KEY
    ? new Anthropic({
        // Next's fetch cache, so a rendered page stays static and a repeat costs nothing.
        fetch: (url, init) => fetch(url, { ...init, cache: 'force-cache' }),
      })
    : null

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de-CH,de;q=0.9,fr;q=0.8,en;q=0.7' }, signal: AbortSignal.timeout(10_000), cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.text()
}

// Throws on any failure, so a failed attempt is never cached.
async function run(url: string): Promise<OfficialFacts> {
  const c = client()
  if (!c) throw new Error('ANTHROPIC_API_KEY is not set')
  const origin = new URL(url).origin
  const robots = await fetchText(`${origin}/robots.txt`).catch(() => '')
  if (!robotsAllow(robots, url)) throw new Error(`robots.txt disallows ${url}`)
  const text = pageText(await fetchText(url)).slice(0, MAX_CHARS)
  if (text.length < 200) throw new Error(`no text on ${url}`)
  const response = await c.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Page: ${url}\n\n${text}` }],
  })
  if (response.stop_reason !== 'end_turn') throw new Error(`stopped: ${response.stop_reason}`)
  const out = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
  return verified(JSON.parse(out) as Raw, text)
}

const cached = unstable_cache(run, ['programme-official-facts-v1'], { revalidate: 30 * 86400 })

/** Facts from the programme's official page, or null where there are none to show. */
export async function officialFacts(url: string | undefined, institutionUrl: string | undefined): Promise<OfficialFacts | null> {
  if (!url || !institutionUrl || !process.env.ANTHROPIC_API_KEY || !sameSite(url, institutionUrl)) return null
  try {
    const f = await cached(url)
    return f.specialisations.length || f.freeChoice || f.partTime || f.start.length || f.internship || f.degree ? f : null
  } catch (e) {
    console.error(`official facts: ${(e as Error).message}`)
    return null
  }
}
