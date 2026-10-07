import type { SourceId } from './engine/types.ts'
import { withBase } from './site.ts'
import { parseImport, USAGE_STATS } from './usage-stats.ts'

/** Only a source category; no cookies, identifiers, filenames or source contents. */
export function measureImport(source: SourceId) {
  if (!USAGE_STATS) return
  const body = parseImport({ source })
  if (!body) return
  void fetch(withBase('/api/usage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    keepalive: true,
  }).catch(() => {})
}
