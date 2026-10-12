import 'server-only'
import { createHash } from 'node:crypto'
import { redis } from './usage.ts'

/**
 * Hard ceilings on what Claude may cost, so that a bug or a crawler can never
 * run up a bill. Spend is counted from each response's token usage in
 * millionths of a dollar. Once a limit is reached the feature answers as if
 * no key were set, until the next day (UTC). With the counter store (USAGE_*
 * Redis) the limits hold across all server instances; without it, each
 * instance keeps its own count.
 *
 * Two uses: the translation of public programme descriptions (no personal
 * data), and the AI rating of programmes, which only runs after the person
 * has switched it on and given consent (profile without name or account).
 */

export type AiPurpose = 'translate' | 'fit'

/** Daily limits in dollars. */
const LIMIT_USD: Record<AiPurpose | 'total', number> = {
  translate: 0.2,
  fit: 10,
  total: 12,
}

/** List prices in millionths of a dollar per token (input, output). */
const PRICE: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
}

const day = () => new Date().toISOString().slice(0, 10)
const key = (p: string) => `wsis:ai-spend:${day()}:${p}`
let local: { day: string; spend: Record<string, number> } = { day: '', spend: {} }

async function read(p: string): Promise<number> {
  try {
    return Number((await redis(['GET', key(p)])) ?? 0)
  } catch {
    if (local.day !== day()) local = { day: day(), spend: {} }
    return local.spend[p] ?? 0
  }
}

/** Whether this purpose may call Claude now. */
export async function aiAllowed(p: AiPurpose): Promise<boolean> {
  const [mine, total] = await Promise.all([read(p), read('total')])
  return mine < LIMIT_USD[p] * 1e6 && total < LIMIT_USD.total * 1e6
}

/** Books one response's cost against today's limits. Returns it in millionths of a dollar. */
export async function aiSpend(p: AiPurpose, model: string, usage: { input_tokens: number; output_tokens: number }): Promise<number> {
  const [pin, pout] = PRICE[model] ?? PRICE['claude-opus-5-5']
  const micro = Math.ceil(usage.input_tokens * pin + usage.output_tokens * pout)
  try {
    for (const k of [key(p), key('total')]) {
      await redis(['INCRBY', k, micro])
      await redis(['EXPIRE', k, 3 * 86400])
    }
  } catch {
    if (local.day !== day()) local = { day: day(), spend: {} }
    local.spend[p] = (local.spend[p] ?? 0) + micro
    local.spend.total = (local.spend.total ?? 0) + micro
  }
  return micro
}

/**
 * Budget per purchase (one report, CHF 9): at most this much Claude for the
 * AI rating of one report. Above it the report asks people to write to us.
 * Without the counter store nothing is counted.
 */
export const PURCHASE_BUDGET_MICRO_USD = 1_000_000
const purchaseKey = (sid: string) => `wsis:fit:cost:${createHash('sha256').update(sid).digest('hex').slice(0, 32)}`

export async function purchaseSpent(sid: string): Promise<number> {
  try {
    return Number((await redis(['GET', purchaseKey(sid)])) ?? 0)
  } catch {
    return 0
  }
}

export async function purchaseAdd(sid: string, micro: number): Promise<void> {
  try {
    await redis(['INCRBY', purchaseKey(sid), Math.max(0, Math.round(micro))])
    await redis(['EXPIRE', purchaseKey(sid), 400 * 86400])
  } catch {
    // Not counted; the next request tries again.
  }
}
