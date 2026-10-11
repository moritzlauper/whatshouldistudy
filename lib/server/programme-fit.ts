import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { pageText, robotsAllow, sameSite } from '../official-facts.ts'
import { findProgramme } from './programme.ts'
import { aiAllowed, aiSpend } from './ai-budget.ts'
import type { Locale } from '../site/config.ts'

/**
 * The paid AI comparison: a person's profile against a few programmes they
 * picked, each read from its official page at that moment. The answer is a
 * new, personal assessment ("fits you because its neuropsychology track
 * matches your investigative profile"), not a copy of the page: nothing of the
 * page is shown, and nothing is stored or published.
 */

export interface FitProfile {
  /** Holland code and the six values in 0..1, R I A S E C. */
  riasec?: { code: string; profile: number[] }
  /** Big Five z-scores, when the personality part was answered. */
  big5?: Record<string, number>
  /** Labels in the page's language: liked subjects, important priorities, best fields. */
  subjects?: string[]
  values?: string[]
  fields?: string[]
}

export interface FitRequest {
  programmes: Array<{ id: string; field: string; country: string }>
  profile: FitProfile
  locale: Locale
}

export interface ProgrammeFit {
  id: string
  /** 1 (little in common) .. 5 (very close). */
  fit: number
  /** 0..100, finer than `fit`, so programmes in the same field come apart. */
  score: number
  reasons: string[]
  /** What to look into before deciding. */
  check: string
  /** The official page could not be read or says too little; the rating is a neutral 3. */
  thin: boolean
}

export const MAX_PROGRAMMES = 5
const UA = 'Mozilla/5.0 (compatible; wasstudieren-bot/1.0; +https://wasstudieren.ch)'
// Per programme: enough for its structure and specialisations, not for a whole site.
const MAX_CHARS = 7000

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
          fit: { type: 'integer' },
          score: { type: 'integer' },
          reasons: { type: 'array', items: { type: 'string' } },
          check: { type: 'string' },
          enough_info: { type: 'boolean' },
        },
        required: ['id', 'fit', 'score', 'reasons', 'check', 'enough_info'],
        additionalProperties: false,
      },
    },
  },
  required: ['programmes'],
  additionalProperties: false,
}

const system = (locale: Locale) => `You help a school leaver compare a few specific degree programmes with their own profile from a study-choice questionnaire.

For each programme you get its name, institution, level, listed focus areas and the text of its official web page (or nothing, when the page could not be read). Rate how well that specific programme fits this person, 1 (little in common) to 5 (very close), and explain why in terms of what is particular to this programme: its specialisations, tracks, typical modules, teaching approach or practical parts, related to the person's interests, subjects, priorities and, if given, personality. Compare the programmes with each other: two programmes in the same field should differ in their rating when their content differs.

Also give "score", 0 to 100: the same judgement on a finer scale, consistent with "fit" (1 ≈ 0–20, 2 ≈ 20–40, 3 ≈ 40–60, 4 ≈ 60–80, 5 ≈ 80–100). Use the whole range within the band; two programmes should get the same score only if you really cannot tell them apart.

Rules:
- Base every statement about a programme on its page text or listed focus areas. "enough_info" is false when the page and focus areas say too little about the programme's content to judge it; then rate it 3, never lower for lack of information, and say in "check" what to find out.
- Write in your own words. Never copy sentences from the page; names of specialisations or modules may be mentioned.
- 2 or 3 short reasons per programme, each one sentence, addressed to the person as «du»/«you» in the language below.
- "check": one sentence on what the person should look into before deciding (e.g. admission, language, how much maths, whether a track is really offered).
- The profile is a rough self-description, not a diagnosis. No statements about mental health.
- Write in ${LANGUAGE[locale]}.`

async function officialText(url: string | undefined, institutionUrl: string | undefined): Promise<string | null> {
  if (!url || !institutionUrl || !sameSite(url, institutionUrl)) return null
  try {
    const origin = new URL(url).origin
    const robots = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000), next: { revalidate: 7 * 86400 } })
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => '')
    if (!robotsAllow(robots, url)) return null
    // Kept by Next's fetch cache for a week, so a page popular with several people is read once.
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de-CH,de;q=0.9,fr;q=0.8,en;q=0.7' }, signal: AbortSignal.timeout(10_000), next: { revalidate: 7 * 86400 } })
    if (!res.ok) return null
    const text = pageText(await res.text()).slice(0, MAX_CHARS)
    return text.length >= 200 ? text : null
  } catch {
    return null
  }
}

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '')

/** Claude Haiku 5.5 list prices, in millionths of a dollar per token (prompts under 100K tokens). */
const MICRO_USD_IN = 0.1
const MICRO_USD_OUT = 0.5

/** The comparison and what it cost, or null when it can't be made (no key, nothing found, the model failed). */
export async function compareProgrammes(req: FitRequest): Promise<{ fits: ProgrammeFit[]; costMicroUsd: number } | null> {
  if (!process.env.ANTHROPIC_API_KEY || !(await aiAllowed('fit'))) return null
  const found = (await Promise.all(req.programmes.slice(0, MAX_PROGRAMMES).map((x) => findProgramme(x.country, x.field, x.id)))).flatMap((f) => (f ? [f.p] : []))
  if (!found.length) return null
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
  const pr = req.profile
  const profile = [
    pr.riasec ? `Interest profile (Holland/RIASEC, 0..1, R I A S E C): ${pr.riasec.profile.map((x) => x.toFixed(2)).join(' ')}; code ${pr.riasec.code}` : '',
    pr.big5 ? `Big Five (z-scores): ${Object.entries(pr.big5).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}` : '',
    pr.subjects?.length ? `Liked school subjects: ${pr.subjects.join(', ')}` : '',
    pr.values?.length ? `Important at work: ${pr.values.join(', ')}` : '',
    pr.fields?.length ? `Best-fitting fields overall: ${pr.fields.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      // The cheapest current model: comparing a handful of pages needs no more.
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: system(req.locale),
      messages: [{ role: 'user', content: `Person's profile:\n${profile}\n\nProgrammes:\n${blocks.join('\n\n')}` }],
    })
    await aiSpend('fit', 'claude-haiku-5-5', response.usage)
    if (response.stop_reason !== 'end_turn') throw new Error(`stopped: ${response.stop_reason}`)
    const out = JSON.parse(response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')) as { programmes: Array<Partial<ProgrammeFit> & { enough_info?: boolean }> }
    const ids = new Map(found.map((p, i) => [p.id, i]))
    const costMicroUsd = Math.ceil(response.usage.input_tokens * MICRO_USD_IN + response.usage.output_tokens * MICRO_USD_OUT)
    const fits = out.programmes
      .filter((x) => typeof x.id === 'string' && ids.has(x.id))
      .map((x) => ({
        id: x.id!,
        // Too little to go on is no reason to rank a programme low.
        fit: x.enough_info === false ? 3 : Math.max(1, Math.min(5, Math.round(Number(x.fit) || 1))),
        score: x.enough_info === false ? 50 : Math.max(0, Math.min(100, Math.round(Number(x.score) || ((Number(x.fit) || 1) - 1) * 25))),
        reasons: (Array.isArray(x.reasons) ? x.reasons : []).map((r) => clip(r, 300)).filter(Boolean).slice(0, 3),
        check: clip(x.check, 300),
        thin: !pages[ids.get(x.id!)!] || x.enough_info === false,
      }))
      .sort((a, b) => b.fit - a.fit)
    return { fits, costMicroUsd }
  } catch (e) {
    console.error(`programme fit: ${(e as Error).message}`)
    return null
  }
}
