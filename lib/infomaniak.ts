/** Server/CLI transport. Never import into a client component or expose these credentials. */
export const AI_MODEL = 'google/gemma-4-31B-it'

// CHF 0.20/0.40 per million tokens. Reserve at 2 USD/CHF, deliberately above
// the exchange rate, to keep the existing dollar-denominated caps conservative.
export const AI_BUDGET_PRICE = [0.4, 0.8] as const

export function aiConfigured(): boolean {
  return !!process.env.INFOMANIAK_API_TOKEN && /^\d+$/.test(process.env.INFOMANIAK_PRODUCT_ID ?? '')
}

export interface CompletionRequest {
  system: string
  input: string
  schema?: object
  maxTokens: number
  timeoutMs?: number
}

export interface Completion {
  text: string
  complete: boolean
  usage: { input_tokens: number; output_tokens: number }
}

/** Errors intentionally exclude provider bodies, which can echo personal input. */
export class AiError extends Error {
  status?: number
  constructor(status?: number) {
    super('Infomaniak request unavailable')
    this.name = 'AiError'
    this.status = status
  }
}

/** Stateless completion: no files, conversations, user identifiers or request cache.
 * Retention is governed by Infomaniak's LLM API terms, art. 6. Its documented API
 * offers no zero-retention switch; do not mistake fetch's no-store for one.
 */
export async function complete(request: CompletionRequest): Promise<Completion> {
  if (!aiConfigured()) throw new AiError()
  try {
    const response = await fetch(`https://api.infomaniak.com/2/ai/${process.env.INFOMANIAK_PRODUCT_ID}/openai/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.INFOMANIAK_API_TOKEN}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(request.timeoutMs ?? 45_000),
      body: JSON.stringify({
        model: AI_MODEL, stream: false, reasoning_effort: 'none',
        max_completion_tokens: request.maxTokens,
        messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.input }],
        ...(request.schema ? { response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema: request.schema } } } : {}),
      }),
    })
    if (!response.ok) { await response.body?.cancel(); throw new AiError(response.status) }
    const result = await response.json() as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const choice = result.choices?.[0]
    const usage = result.usage
    if (typeof choice?.message?.content !== 'string' || !Number.isFinite(usage?.prompt_tokens) || !Number.isFinite(usage?.completion_tokens)
      || usage!.prompt_tokens! < 0 || usage!.completion_tokens! < 0) throw new AiError()
    return { text: choice.message.content, complete: choice.finish_reason === 'stop',
      usage: { input_tokens: usage!.prompt_tokens!, output_tokens: usage!.completion_tokens! } }
  } catch (error) {
    throw error instanceof AiError ? error : new AiError()
  }
}
