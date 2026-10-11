import type { SourceSummary } from './types.ts'

/**
 * AI corrections of the data part of a result. The keyword lexicon cannot
 * tell a singer called Ocean from oceanography; in the paid report, and only
 * with consent, Claude looks at the terms that carried each top field and
 * names those that are no real interest in the subject. They are taken out
 * here, before scoring, so the ranking itself stays this code's work.
 */

export interface Correction {
  field: string
  /** A term as it appears in a summary's `fields[field].terms`. */
  term: string
}

export interface CandidateTerm {
  term: string
  /** Items that matched it, over all sources. */
  n: number
  /** One example title, if a summary has one. */
  ex?: string
}

/** The terms behind each of the given fields, most frequent first, over all sources. */
export function correctionCandidates(summaries: SourceSummary[], fields: string[], perField = 25): Array<{ field: string; terms: CandidateTerm[] }> {
  return fields
    .map((field) => {
      const counts = new Map<string, number>()
      for (const s of summaries) for (const [t, n] of Object.entries(s.fields[field]?.terms ?? {})) counts.set(t, (counts.get(t) ?? 0) + n)
      const terms = [...counts]
        .sort((a, b) => b[1] - a[1])
        .slice(0, perField)
        .map(([term, n]) => ({ term, n, ex: exampleFor(summaries, term) }))
      return { field, terms }
    })
    .filter((x) => x.terms.length > 0)
}

const bare = (t: string) => t.replace(/…/g, '').toLowerCase()

function exampleFor(summaries: SourceSummary[], term: string): string | undefined {
  const b = bare(term)
  for (const s of summaries) {
    for (const t of Object.values(s.topics ?? {})) if (bare(t.w).startsWith(b) && t.ex[0]) return t.ex[0].slice(0, 120)
  }
  return undefined
}

/**
 * The summaries with the corrected terms taken out: each field loses the
 * share of its evidence that those terms carried (by item count, capped at
 * 95 %), in its score, items and yearly weights; the terms, matching
 * examples and topics go too. Returns new objects; the input is unchanged.
 */
export function applyCorrections(summaries: SourceSummary[], exclude: Correction[]): SourceSummary[] {
  if (!exclude.length) return summaries
  const byField = new Map<string, Set<string>>()
  for (const c of exclude) byField.set(c.field, (byField.get(c.field) ?? new Set()).add(c.term))
  const allTerms = new Set(exclude.map((c) => bare(c.term)))

  return summaries.map((s) => {
    const fields = { ...s.fields }
    const timeline = s.timeline ? Object.fromEntries(Object.entries(s.timeline).map(([y, m]) => [y, { ...m }])) : undefined
    for (const [field, terms] of byField) {
      const ev = fields[field]
      if (!ev) continue
      const total = Object.values(ev.terms).reduce((a, b) => a + b, 0)
      const removed = Object.entries(ev.terms).reduce((a, [t, n]) => a + (terms.has(t) ? n : 0), 0)
      if (!total || !removed) continue
      const keep = 1 - Math.min(0.95, removed / total)
      fields[field] = {
        ...ev,
        score: ev.score * keep,
        items: Math.round(ev.items * keep),
        terms: Object.fromEntries(Object.entries(ev.terms).filter(([t]) => !terms.has(t))),
        top: ev.top.filter((x) => ![...terms].some((t) => x.label.toLowerCase().includes(bare(t)))),
      }
      if (timeline) for (const m of Object.values(timeline)) if (m[field]) m[field] *= keep
    }
    const topics = s.topics ? Object.fromEntries(Object.entries(s.topics).filter(([, t]) => ![...allTerms].some((b) => bare(t.w).startsWith(b)))) : undefined
    return { ...s, fields, timeline, topics }
  })
}
