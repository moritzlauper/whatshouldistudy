import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { aiAllowed, aiSpend } from './ai-budget.ts'

/**
 * «Ranking mit KI verbessern», part of the paid report and only with consent:
 * Claude gets, per top field, the terms from the person's data that carried
 * it (with a count and at most one example title, all shown to the person
 * before sending and editable) and names those that are no real interest in
 * that subject. The browser then takes them out and scores again. Nothing is
 * stored.
 */

export interface ImproveInput {
  fields: Array<{ field: string; name: string; terms: Array<{ term: string; n: number; ex?: string }> }>
}

export interface ImproveOutput {
  exclude: Array<{ field: string; term: string; reason: string }>
  note: string
}

const MODEL = 'claude-opus-5-5'

const SCHEMA = {
  type: 'object',
  properties: {
    exclude: {
      type: 'array',
      items: {
        type: 'object',
        properties: { field: { type: 'string' }, term: { type: 'string' }, reason: { type: 'string' } },
        required: ['field', 'term', 'reason'],
        additionalProperties: false,
      },
    },
    note: { type: 'string' },
  },
  required: ['exclude', 'note'],
  additionalProperties: false,
}

const SYSTEM = `A study-choice website matches what someone watched and searched (YouTube, Google, Instagram, TikTok, Reddit) to fields of study with a keyword list. For each of the person's top fields you get the keywords that matched, how many items matched each, and sometimes one example title.

Name the keywords that, for that field, are NOT a sign of interest in studying the subject, because in this person's data they evidently mean something else:
- a person, band, brand, product, film, series, game or song with that word in its name (a singer called Ocean is not oceanography);
- costumes, jokes, memes, gossip, celebrity news;
- entertainment that only borrows the theme (a crime series is not criminology, unless the examples show interest in how crime is studied);
- everyday life: shopping, house plants, cooking, beauty, health worries about oneself, unless it clearly goes deeper.

Keep a keyword when it plausibly shows curiosity about the subject itself, even if the example is popular science. When unsure, keep it: only exclude what you are fairly sure about. Use the exact "field" ids and "term" strings you were given. "reason": at most 8 words, in Swiss Standard German (no «ß»). "note": one sentence in Swiss Standard German on what changed most, or that little needed changing.`

/** A text stream: NUL keep-alives, then one line of JSON (ImproveOutput or {error}). */
export function improveStream(input: ImproveInput, signal?: AbortSignal, onCost?: (micro: number) => Promise<void>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const beat = setInterval(() => controller.enqueue(enc.encode('\u0000')), 5000)
      controller.enqueue(enc.encode('\u0000'))
      try {
        if (!(await aiAllowed('improve'))) throw new Error('Das Tagesbudget für KI-Verbesserungen ist aufgebraucht.')
        const client = new Anthropic({ timeout: 150_000, maxRetries: 0 })
        // Opus: telling a meme from a subject needs judgement; a run costs a few Rappen.
        const stream = client.messages.stream(
          {
            model: MODEL,
            max_tokens: 16000,
            output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
            system: SYSTEM,
            messages: [{ role: 'user', content: JSON.stringify(input).slice(0, 60_000) }],
          },
          { signal },
        )
        const message = await stream.finalMessage()
        const micro = await aiSpend('improve', MODEL, message.usage)
        await onCost?.(micro)
        if (message.stop_reason !== 'end_turn') throw new Error(`Claude hat nicht fertig geantwortet (${message.stop_reason}).`)
        const out = JSON.parse(message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')) as ImproveOutput
        // Only what was asked about: known fields and terms.
        const known = new Set(input.fields.flatMap((f) => f.terms.map((t) => `${f.field}\u0001${t.term}`)))
        const exclude = (out.exclude ?? []).filter((x) => known.has(`${x.field}\u0001${x.term}`)).map((x) => ({ ...x, reason: String(x.reason ?? '').slice(0, 120) }))
        controller.enqueue(enc.encode(JSON.stringify({ exclude, note: String(out.note ?? '').slice(0, 300) })))
      } catch (e) {
        console.error(`improve: ${(e as Error).message}`)
        controller.enqueue(enc.encode(JSON.stringify({ error: (e as Error).message })))
      } finally {
        clearInterval(beat)
        controller.close()
      }
    },
  })
}
