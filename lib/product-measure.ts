import type { SourceId } from './engine/types.ts'
import { withBase } from './site.ts'
import { parseImport, USAGE_STATS } from './usage-stats.ts'

/** Only a source category; no cookies, identifiers, filenames or source contents. */
export function measureImport(source: SourceId) {
  const body = parseImport({ source })
  if (body) send(body)
}

/** That an own result was shown, nothing of what it says. Counted per page view: no storage to recognise a visitor. */
export function measureResultShown() {
  send({ event: 'result' })
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
