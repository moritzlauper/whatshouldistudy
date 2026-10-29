/** Offline reader ONLY: public programme pages, never personal profiles or exports. */
import type { Completion, CompletionRequest } from '../../lib/infomaniak.ts'

export const FACTS_MODEL = 'claude-haiku-5-5'
export const factsAiConfigured = () => !!process.env.ANTHROPIC_API_KEY?.trim()

/** Separate from the app's Infomaniak transport; no provider fallback or hidden retries. The rating ensemble names its own model. */
export async function completeFacts(request: CompletionRequest, model: string = FACTS_MODEL): Promise<Completion> {
  if (!factsAiConfigured()) throw new Error('ANTHROPIC_API_KEY required for public programme readings')
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(request.timeoutMs ?? 120_000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: request.maxTokens, system: request.system,
        messages: [{ role: 'user', content: request.input }],
        output_config: { effort: 'low', ...(request.schema ? { format: { type: 'json_schema', schema: request.schema } } : {}) },
      }),
    })
    if (!response.ok) { await response.body?.cancel(); throw new Error('Provider unavailable') }
    const result = await response.json() as {
      content?: Array<{ type: string; text?: string }>; stop_reason?: string
      usage?: { input_tokens: number; output_tokens: number }
    }
    const text = result.content?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
    if (!text || !result.usage || ![result.usage.input_tokens, result.usage.output_tokens].every((n) => Number.isFinite(n) && n >= 0)) throw new Error('Invalid completion')
    return { text, complete: result.stop_reason === 'end_turn', usage: result.usage }
  } catch { throw new Error('Public programme reader unavailable') }
}
