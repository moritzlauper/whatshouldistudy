import 'server-only'
import { AI_MODEL, aiConfigured, complete } from '../infomaniak.ts'
import { unstable_cache } from 'next/cache'
import type { Locale } from '../site/config.ts'
import { aiAllowed, aiSpend } from './ai-budget.ts'

/**
 * Translates a programme description into the page's language with the AI,
 * only when a page is rendered (no batch job). The result is cached, so each
 * description is translated once per language and then served from the cache
 * along with the page. Without Infomaniak credentials, or when the call fails, the
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

// Throws on any failure, so a failed attempt is never cached.
async function run(text: string, locale: Locale): Promise<string> {
  if (!aiConfigured()) throw new Error('Infomaniak is not configured')
  // Crawlers open thousands of programme pages: a daily ceiling, and the cheapest model.
  if (!(await aiAllowed('translate'))) throw new Error('daily AI budget for translations reached')
  {
    const response = await complete({
      maxTokens: 2000,
      system: `You translate short descriptions of university degree programmes for a study-choice website. Translate the text the user sends into ${LANGUAGE[locale]}. Keep the meaning and the facts exactly; do not add, shorten or comment. Keep names of programmes and institutions as they are. If the text is already in that language, return it unchanged. Reply with the translation only.`,
      input: text,
    })
    await aiSpend('translate', AI_MODEL, response.usage)
    if (!response.complete) throw new Error('Incomplete translation')
    const out = response.text.trim()
    if (!out) throw new Error('empty translation')
    return out
  }
}

// Only derived translations of public catalogue descriptions are cached.
const cached = unstable_cache(run, ['programme-description-infomaniak-v1'], { revalidate: 30 * 86400 })

/** The description in the page's language, or null where that is not possible. */
export async function translateDescription(text: string, locale: Locale): Promise<string | null> {
  try {
    return await cached(text, locale)
  } catch {
    if (aiConfigured()) console.error('translate: unavailable')
    return null
  }
}
