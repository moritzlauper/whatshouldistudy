import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { aiAllowed, aiSpend } from './ai-budget.ts'

/**
 * Claude reads one whole result (questionnaire answers, the summaries of
 * uploaded data, the ranking and the top programmes) and says whether it
 * makes sense. Nothing is stored.
 *
 * REVIEW_PUBLIC: open to every visitor while the site is in testing, without
 * a count per visitor (only the daily dollar budget in ./ai-budget.ts); set
 * to false to keep it to WSIS_REVIEW_KEY.
 */
export const REVIEW_PUBLIC = true

/** The owner's key (WSIS_REVIEW_KEY), compared in constant time. */
export function reviewAllowed(given: string | null): boolean {
  const key = process.env.WSIS_REVIEW_KEY
  if (!key || !given) return false
  const a = createHash('sha256').update(key).digest()
  const b = createHash('sha256').update(given).digest()
  return timingSafeEqual(a, b)
}

const SYSTEM = `You review the output of a study-choice website for its developer, who is a psychology student and data scientist. You get one complete result: the questionnaire answers (RIASEC interest items, optional Mini-IPIP Big Five, school subjects, work values), aggregated summaries of uploaded data exports (YouTube, Google, Instagram, TikTok, Reddit and so on: counts per field and top terms, never raw history), the computed result (RIASEC profile, ranked fields with their score components, quality flags, confidence) and the top programmes with their AI ratings.

Judge whether the result makes sense and where the pipeline goes wrong. Be concrete and critical, like a code and method review:
- Does the ranking follow from the answers and the data? Name fields that rank too high or too low, and the input that likely caused it (a misclassified term, a source weighted too strongly, a questionnaire scale, a missing field).
- Do the uploaded data and the questionnaire agree? Where they disagree, which one does the result follow, and is that right?
- Are the top programmes plausible for this profile? Is anything missing that clearly should be there?
- Quality flags, confidence and texts: are they justified?
- Concrete suggestions for the code or the weights, ordered by impact.

Write in German (Swiss spelling, no «ß»), in Markdown with short sections, at most about 500 words. No preamble.`

/**
 * The review as a text stream. Claude's words go out as they come; until the
 * first ones (and between them), a NUL byte every few seconds keeps proxies
 * from dropping a connection that looks idle. The client removes NULs.
 */
export function reviewStream(input: unknown, signal?: AbortSignal): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const beat = setInterval(() => controller.enqueue(enc.encode('\u0000')), 5000)
      controller.enqueue(enc.encode('\u0000'))
      try {
        if (!(await aiAllowed('review'))) throw new Error('Das Tagesbudget für KI-Prüfungen ist aufgebraucht.')
        const client = new Anthropic({ timeout: 120_000, maxRetries: 0 })
        const stream = client.messages.stream({
          // The cheapest current model, like the other AI parts: fast enough
          // that the answer arrives in well under a minute.
          model: 'claude-haiku-5-5',
          max_tokens: 6000,
          output_config: { effort: 'medium' },
          system: SYSTEM,
          messages: [{ role: 'user', content: `Result to review (JSON):\n\n${JSON.stringify(input).slice(0, 80_000)}` }],
        }, { signal })
        stream.on('text', (t) => controller.enqueue(enc.encode(t)))
        const message = await stream.finalMessage()
        await aiSpend('review', 'claude-haiku-5-5', message.usage)
        if (message.stop_reason === 'refusal') controller.enqueue(enc.encode('\n\nClaude hat die Prüfung abgelehnt.'))
      } catch (e) {
        console.error(`review: ${(e as Error).message}`)
        controller.enqueue(enc.encode(`\n\n⚠ Fehler: ${(e as Error).message}`))
      } finally {
        clearInterval(beat)
        controller.close()
      }
    },
  })
}
