import type { Results, SourceId } from './engine/types.ts'
import { withBase } from './site.ts'
import { parseImport, parseProfile, PROFILE_FIELDS, USAGE_STATS } from './usage-stats.ts'
import type { ProfileReport } from './usage-stats.ts'

/** Only a source category; no cookies, identifiers, filenames or source contents. */
export function measureImport(source: SourceId) {
  const body = parseImport({ source })
  if (body) send(body)
}

/**
 * That an own result was shown, with its Holland code and first three fields
 * for checking the matching. No answers, scores or source types. Counted per
 * page view: no storage to recognise a visitor.
 */
export function measureResultShown(results: Results) {
  const profile = resultProfile(results)
  send(profile ? { event: 'result', profile } : { event: 'result' })
}

export function resultProfile(results: Results): ProfileReport | null {
  const questionnaire = results.riasec.from.includes('questionnaire')
  const data = results.sources.some((s) => s.id !== 'questionnaire')
  return parseProfile({
    basis: questionnaire && data ? 'both' : questionnaire ? 'questionnaire' : 'data',
    // A careless or flat profile has no code worth reading.
    code: results.quality?.careless ? 'careless' : results.quality?.flat ? 'flat' : results.riasec.code,
    fields: results.fields.slice(0, PROFILE_FIELDS).map((f) => f.id),
  })
}

function send(body: object) {
  if (!USAGE_STATS) return
  void fetch(withBase('/api/usage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    keepalive: true,
  }).catch(() => {})
}
