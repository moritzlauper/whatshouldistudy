import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { pageText, robotsAllow, sameSite } from '../official-facts.ts'
import { findProgramme } from './programme.ts'
import { aiAllowed, aiSpend } from './ai-budget.ts'
import { redis } from './usage.ts'
import { RIASEC_KEYS, SUBJECT_KEYS } from '../taxonomy/fields.ts'
import { toFacts, type ProgrammeFacts } from '../engine/programme-fit.ts'
import type { Locale } from '../site/config.ts'

/**
 * What Claude reads about degree programmes: the official page and the focus
 * areas listed for each programme. No person is part of this. The comparison
 * with someone's answers happens in their browser (lib/engine/programme-fit.ts),
 * so nothing about the person goes to the AI. A reading is kept for a week per
 * programme and language, so a popular programme is read once, not per visitor.
 */

export interface FactsRequest {
  programmes: Array<{ id: string; field: string; country: string }>
  locale: Locale
  /** Read the pages again instead of using what is kept. */
  refresh?: boolean
}

export const MAX_PROGRAMMES = 5
const UA = 'Mozilla/5.0 (compatible; wasstudieren-bot/1.0; +https://wasstudieren.ch)'
// Per programme: enough for its structure and specialisations, not for a whole site.
const MAX_CHARS = 7000
const KEEP_SECONDS = 7 * 86400
const keepKey = (id: string, locale: string) => `wsis:facts:v1:${locale}:${id}`
/** Claude Haiku 5.5 list prices, in millionths of a dollar per token (prompts under 100K tokens). */
const MICRO_USD_IN = 0.1
const MICRO_USD_OUT = 0.5

const LANGUAGE: Record<Locale, string> = {
  en: 'English',
  'de-CH': 'Swiss Standard German (never «ß», always «ss»; quotes «»)',
  'de-DE': 'German',
  'de-AT': 'Austrian Standard German',
  'fr-CH': 'French',
  'it-CH': 'Italian',
}

const SCHEMA = {
  type: 'object',
  properties: {
    programmes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          riasec: {
            type: 'object',
            properties: Object.fromEntries(RIASEC_KEYS.map((k) => [k, { type: 'integer' }])),
            required: [...RIASEC_KEYS],
            additionalProperties: false,
          },
          subjects: { type: 'array', items: { type: 'string', enum: [...SUBJECT_KEYS] } },
          check: { type: 'string' },
          enough_info: { type: 'boolean' },
        },
        required: ['id', 'riasec', 'subjects', 'check', 'enough_info'],
        additionalProperties: false,
      },
    },
  },
  required: ['programmes'],
  additionalProperties: false,
}

const system = (locale: Locale) => `You describe degree programmes for a study-choice website, so that a school leaver can compare them. For each programme you get its name, institution, level, the focus areas listed for it and the text of its official web page (or "could not be read"). You know nothing about any person, and you must not guess one.

For each programme give:
- "riasec": six integers from 0 to 5, in the order R, I, A, S, E, C, for how strongly the programme's typical study and later work involves that kind of activity. R: practical, technical, hands-on, tools, lab or field work. I: research, analysis, theory, science, solving problems by reasoning. A: design, creative expression, language and media, music, art. S: teaching, helping, care, counselling, working with people. E: leading, persuading, starting projects, business, politics, sales. C: structured data, precision, documentation, administration, systems and rules. Judge the content, not the prestige. A programme that is clearly one thing scores high on that type and low on the others.
- "subjects": the school subjects from this list that the programme clearly relies on, the most important first; an empty list if none is clearly needed: ${SUBJECT_KEYS.join(', ')}. Use only these keys.
- "check": one sentence in ${LANGUAGE[locale]} on what the person should look into before deciding, for example admission requirements, the language of teaching, how much maths, or whether a track is really offered.
- "enough_info": false when the page and the focus areas say too little about the content to judge. Then give 0 for every type and an empty list of subjects.

Rules: base every statement on the page text or the listed focus areas. Write "check" in your own words and never copy sentences from the page.`

async function officialText(url: string | undefined, institutionUrl: string | undefined): Promise<string | null> {
  if (!url || !institutionUrl || !sameSite(url, institutionUrl)) return null
  try {
    const origin = new URL(url).origin
    const robots = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000), next: { revalidate: 86400 } })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '')
    if (!robotsAllow(robots, url)) return null
    // Kept by Next's fetch cache for a day, so a page popular with several people is read once.
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de-CH,de;q=0.9,fr;q=0.8,en;q=0.7' }, signal: AbortSignal.timeout(10_000), next: { revalidate: 86400 } })
    if (!res.ok) return null
    const text = pageText(await res.text()).slice(0, MAX_CHARS)
    return text.length >= 200 ? text : null
  } catch {
    return null
  }
}

async function readKept(id: string, locale: Locale): Promise<ProgrammeFacts | null> {
  try {
    const raw = await redis(['GET', keepKey(id, locale)])
    return typeof raw === 'string' ? (JSON.parse(raw) as ProgrammeFacts) : null
  } catch {
    return null
  }
}

async function keep(f: ProgrammeFacts, locale: Locale): Promise<void> {
  try {
    await redis(['SET', keepKey(f.id, locale), JSON.stringify(f), 'EX', KEEP_SECONDS])
  } catch {
    // Not kept: the next visitor reads the page again.
  }
}

/** What Claude read about the programmes asked for, in their order, and what the new reading cost. */
export async function programmeFacts(req: FactsRequest): Promise<{ items: ProgrammeFacts[]; costMicroUsd: number } | null> {
  const wanted = req.programmes.slice(0, MAX_PROGRAMMES)
  const known = new Map<string, ProgrammeFacts>()
  if (!req.refresh) {
    const kept = await Promise.all(wanted.map((x) => readKept(x.id, req.locale)))
    kept.forEach((f, i) => {
      if (f) known.set(wanted[i].id, f)
    })
  }
  const inOrder = () => wanted.flatMap((x) => {
    const f = known.get(x.id)
    return f ? [f] : []
  })
  const missing = wanted.filter((x) => !known.has(x.id))
  if (!missing.length) return { items: inOrder(), costMicroUsd: 0 }
  // Without a key, or with the day's budget used up, only what is kept can be shown.
  if (!process.env.ANTHROPIC_API_KEY || !(await aiAllowed('fit'))) return known.size ? { items: inOrder(), costMicroUsd: 0 } : null
  const found = (await Promise.all(missing.map((x) => findProgramme(x.country, x.field, x.id)))).flatMap((f) => (f ? [f.p] : []))
  if (!found.length) return known.size ? { items: inOrder(), costMicroUsd: 0 } : null
  const pages = await Promise.all(found.map((p) => officialText(p.url, p.institutionUrl)))

  const blocks = found.map((p, i) =>
    [
      `<programme id="${p.id}">`,
      `Name: ${p.name}`,
      `Institution: ${p.institution}${p.city ? `, ${p.city}` : ''}`,
      `Level: ${p.level}`,
      p.focus?.length ? `Listed focus areas: ${p.focus.join('; ')}` : '',
      p.languages?.length ? `Languages: ${p.languages.join(', ')}` : '',
      pages[i] ? `Official page text:\n${pages[i]}` : 'Official page: could not be read.',
      '</programme>',
    ]
      .filter(Boolean)
      .join('\n'),
  )
  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      // The cheapest current model: describing a handful of pages needs no more.
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: system(req.locale),
      messages: [{ role: 'user', content: `Programmes:\n${blocks.join('\n\n')}` }],
    })
    await aiSpend('fit', 'claude-haiku-5-5', response.usage)
    if (response.stop_reason !== 'end_turn') throw new Error(`stopped: ${response.stop_reason}`)
    const out = JSON.parse(response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')) as { programmes?: unknown[] }
    const allowed = new Set(found.map((p) => p.id))
    for (const raw of out.programmes ?? []) {
      const f = toFacts(raw, allowed)
      if (!f) continue
      known.set(f.id, f)
      await keep(f, req.locale)
    }
    const costMicroUsd = Math.ceil(response.usage.input_tokens * MICRO_USD_IN + response.usage.output_tokens * MICRO_USD_OUT)
    return { items: inOrder(), costMicroUsd }
  } catch (e) {
    console.error(`programme facts: ${(e as Error).message}`)
    return known.size ? { items: inOrder(), costMicroUsd: 0 } : null
  }
}
