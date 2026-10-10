import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { unstable_cache } from 'next/cache'
import type { Locale } from '../site/config.ts'

/**
 * Translates a programme description into the page's language with Claude,
 * only when a page is rendered (no batch job). The result is cached, so each
 * description is translated once per language and then served from the cache
 * along with the page. Without ANTHROPIC_API_KEY, or when the call fails, the
 * answer is null and the page leaves the description out.
 */

const LANGUAGE: Record<Locale, string> = {
  en: 'English',
  'de-CH': 'Swiss Standard German (Swiss spelling: never «ß», always «ss»)',
  'de-DE': 'German',
  'de-AT': 'Austrian Standard German',
  'fr-CH': 'French',
  'it-CH': 'Italian',
}

const client = () => (process.env.ANTHROPIC_API_KEY ? new Anthropic({
  // Next's fetch cache, so a rendered page stays static and a repeat costs nothing.
  fetch: (url, init) => fetch(url, { ...init, cache: 'force-cache' }),
}) : null)

// Throws on any failure, so a failed attempt is never cached.
async function run(text: string, locale: Locale): Promise<string> {
  const c = client()
  if (!c) throw new Error('ANTHROPIC_API_KEY is not set')
  {
    const response = await c.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: `You translate short descriptions of university degree programmes for a study-choice website. Translate the text the user sends into ${LANGUAGE[locale]}. Keep the meaning and the facts exactly; do not add, shorten or comment. Keep names of programmes and institutions as they are. If the text is already in that language, return it unchanged. Reply with the translation only.`,
      messages: [{ role: 'user', content: text }],
    })
    if (response.stop_reason !== 'end_turn') throw new Error(`stopped: ${response.stop_reason}`)
    const out = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim()
    if (!out) throw new Error('empty translation')
    return out
  }
}

const cached = unstable_cache(run, ['programme-description-v1'], { revalidate: 30 * 86400 })

/** The description in the page's language, or null where that is not possible. */
export async function translateDescription(text: string, locale: Locale): Promise<string | null> {
  try {
    return await cached(text, locale)
  } catch (e) {
    if (process.env.ANTHROPIC_API_KEY) console.error(`translate: ${(e as Error).message}`)
    return null
  }
}
