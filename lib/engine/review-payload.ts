import type { Results, SourceSummary } from './types.ts'

/**
 * What the review may see. Titles, channel names, example queries and URLs
 * of third parties never go: they are kept in this browser for the person's
 * own view, not sent to an AI. Only counts, scores, keyword counts and the
 * ranking itself. The top fields and the hidden fields are sent apart, so
 * none appears twice.
 */
export function forReview(results: Results) {
  const field = (f: Results['fields'][number]) => ({
    id: f.id,
    score: f.score,
    match: f.match,
    components: f.components,
    reasons: f.reasons.map((r) => r.k),
    sources: f.sources,
    contributions: f.contributions,
    terms: f.terms.slice(0, 15),
  })
  return {
    confidence: results.confidence,
    quality: results.quality,
    riasec: results.riasec,
    big5: results.big5 ? { z: results.big5.z, from: results.big5.from, confidence: results.big5.confidence } : undefined,
    fields: results.fields.slice(0, 12).map(field),
    hidden: results.hidden.map(field),
    dataPoints: results.dataPoints,
  }
}

/** The summaries as numbers: per source the totals and, per field, scores, counts and keyword counts. No labels, examples or URLs. */
export function summaryCounts(summaries: SourceSummary[]) {
  return summaries.map((s) => ({
    source: s.source,
    dataPoints: s.dataPoints,
    totalWeight: s.totalWeight,
    learningWeight: s.learningWeight,
    span: s.span,
    fields: Object.fromEntries(
      Object.entries(s.fields).map(([id, ev]) => [
        id,
        { score: ev.score, items: ev.items, months: ev.months.length, terms: Object.fromEntries(Object.entries(ev.terms).sort((a, b) => b[1] - a[1]).slice(0, 30)) },
      ]),
    ),
  }))
}
