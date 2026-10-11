import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { redis } from './usage.ts'

/**
 * Claude reads one whole result (questionnaire answers, the summaries of
 * uploaded data, the ranking and the top programmes) and says whether it
 * makes sense. Nothing is stored.
 *
 * REVIEW_PUBLIC: open to every visitor while the site is in testing, limited
 * per connection and per day; set to false to keep it to WSIS_REVIEW_KEY.
 */
export const REVIEW_PUBLIC = true
const PER_IP_DAY = 5
const ALL_DAY = 40

export function reviewAllowed(given: string | null): boolean {
  const key = process.env.WSIS_REVIEW_KEY
  if (!key || !given) return false
  const a = createHash('sha256').update(key).digest()
  const b = createHash('sha256').update(given).digest()
  return timingSafeEqual(a, b)
}

const COUNT = `
local ip = redis.call('INCR', KEYS[1])
if ip == 1 then redis.call('EXPIRE', KEYS[1], 86400) end
local all = redis.call('INCR', KEYS[2])
if all == 1 then redis.call('EXPIRE', KEYS[2], 86400) end
return {ip, all}
`
// Without the counter store: a rough cap per server instance.
let local = { day: '', n: 0 }

/** Whether a public review may run now for this connection. */
export async function publicReviewAllowed(ip: string): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10)
  const h = createHash('sha256').update(ip).digest('hex').slice(0, 32)
  try {
    const [byIp, all] = (await redis(['EVAL', COUNT, 2, `wsis:review:ip:${day}:${h}`, `wsis:review:all:${day}`])) as [number, number]
    return Number(byIp) <= PER_IP_DAY && Number(all) <= ALL_DAY
  } catch {
    if (local.day !== day) local = { day, n: 0 }
    local.n++
    return local.n <= ALL_DAY
  }
}

const SYSTEM = `You review the output of a study-choice website for its developer, who is a psychology student and data scientist. You get one complete result: the questionnaire answers (RIASEC interest items, optional Mini-IPIP Big Five, school subjects, work values), aggregated summaries of uploaded data exports (YouTube, Google, Instagram, TikTok, Reddit and so on: counts per field and top terms, never raw history), the computed result (RIASEC profile, ranked fields with their score components, quality flags, confidence) and the top programmes with their AI ratings.

Judge whether the result makes sense and where the pipeline goes wrong. Be concrete and critical, like a code and method review:
- Does the ranking follow from the answers and the data? Name fields that rank too high or too low, and the input that likely caused it (a misclassified term, a source weighted too strongly, a questionnaire scale, a missing field).
- Do the uploaded data and the questionnaire agree? Where they disagree, which one does the result follow, and is that right?
- Are the top programmes plausible for this profile? Is anything missing that clearly should be there?
- Quality flags, confidence and texts: are they justified?
- Concrete suggestions for the code or the weights, ordered by impact.

Write in German (Swiss spelling, no «ß»), in Markdown with short sections. No preamble.`

/** The review as Markdown, or an error message. */
export async function reviewResult(input: unknown): Promise<string> {
  const client = new Anthropic()
  const stream = client.beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    // A safety decline is re-run on a fallback model instead of failing.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: `Result to review (JSON):\n\n${JSON.stringify(input)}` }],
  })
  const message = await stream.finalMessage()
  if (message.stop_reason === 'refusal') return 'Claude hat die Prüfung abgelehnt.'
  return message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim()
}
