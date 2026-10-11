'use client'

import { useMemo, useState } from 'react'
import { CONTACT, withBase } from '@/lib/site.ts'
import { update } from '@/lib/store.ts'
import { correctionCandidates } from '@/lib/engine/corrections.ts'
import type { Results, SourceSummary } from '@/lib/engine/types.ts'
import { fieldName } from '@/lib/site/labels.ts'
import { useSite } from './site-context.tsx'

/**
 * «Ranking mit KI verbessern», in the paid report. The person sees the words
 * that would be sent (per top field, with counts and at most one example),
 * can remove any, and must agree before anything leaves the browser. Claude
 * names the words that are no real interest in a field; they are stored in
 * this browser only and taken out before scoring (lib/engine/corrections.ts).
 */
type Exclusion = { field: string; term: string; reason: string }

/** 5 runs a day, 20 in all, counted here for the display; the server counts per purchase as well. */
const RUNS_STORE = 'wsis:improve-runs:v1'
const PER_DAY = 5
const IN_ALL = 20
function runs(): { day: string; today: number; total: number } {
  const day = new Date().toISOString().slice(0, 10)
  try {
    const x = JSON.parse(window.localStorage.getItem(RUNS_STORE) ?? '') as { day: string; today: number; total: number }
    return { day, today: x.day === day ? x.today : 0, total: x.total || 0 }
  } catch {
    return { day, today: 0, total: 0 }
  }
}
function countRun() {
  const r = runs()
  try {
    window.localStorage.setItem(RUNS_STORE, JSON.stringify({ day: r.day, today: r.today + 1, total: r.total + 1 }))
  } catch {
    // Not counted beyond this page view.
  }
}

export function ImprovePanel({ results, raw, token, corrections }: {
  results: Results
  /** The summaries as read, without earlier corrections. */
  raw: SourceSummary[]
  token: string | null
  corrections?: { at: string; exclude: Exclusion[]; note: string }
}) {
  const { t, locale } = useSite()
  const tx = t.improve
  const fields = useMemo(() => results.fields.slice(0, 8).map((f) => f.id), [results])
  const candidates = useMemo(() => correctionCandidates(raw, fields), [raw, fields])
  const [dropped, setDropped] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState(false)
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'budget' | 'runs'>('idle')
  // Example titles help Claude but say more about a person; off unless chosen.
  const [examples, setExamples] = useState(false)
  const used = typeof window === 'undefined' ? { today: 0, total: 0 } : runs()
  const left = Math.max(0, Math.min(PER_DAY - used.today, IN_ALL - used.total))
  const [error, setError] = useState('')
  const [lastNone, setLastNone] = useState(false)

  if (!raw.length) return null
  const k = (field: string, term: string) => `${field}\u0001${term}`
  const payload = candidates
    .map((c) => ({
      field: c.field,
      name: fieldName(c.field, locale),
      terms: c.terms.filter((x) => !dropped.has(k(c.field, x.term))).map((x) => (examples ? x : { term: x.term, n: x.n })),
    }))
    .filter((c) => c.terms.length)

  async function run() {
    setState('loading')
    setLastNone(false)
    try {
      const res = await fetch(withBase('/api/improve'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ fields: payload }),
        signal: AbortSignal.timeout(200_000),
      })
      if (res.status === 429) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        return setState(j.error === 'runs' ? 'runs' : 'budget')
      }
      countRun()
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      // NUL bytes keep the connection alive; the answer is the JSON after them.
      const text = (await res.text()).replace(/\u0000/g, '').trim()
      const out = JSON.parse(text) as { exclude?: Exclusion[]; note?: string; error?: string }
      if (out.error || !out.exclude) throw new Error(out.error ?? 'empty')
      // Added to earlier corrections, so a second run can only take out more.
      const seen = new Set((corrections?.exclude ?? []).map((x) => k(x.field, x.term)))
      const exclude = [...(corrections?.exclude ?? []), ...out.exclude.filter((x) => !seen.has(k(x.field, x.term)))]
      update((s) => ({ ...s, corrections: { at: new Date().toISOString(), exclude, note: out.note ?? '' } }))
      setLastNone(out.exclude.length === 0)
      setState('idle')
    } catch (e) {
      setError((e as Error).name === 'TimeoutError' ? tx.error : `${tx.error} (${(e as Error).message})`)
      setState('error')
    }
  }

  const undo = () => update((s) => ({ ...s, corrections: undefined }))
  const done = corrections?.exclude ?? []

  return (
    <section className="card-sm mt-4 p-4 text-sm sm:p-5">
      <h2 className="font-display text-xl">🤖 {tx.title}</h2>
      <p className="mt-1 max-w-3xl text-muted">{tx.text}</p>

      {done.length > 0 && (
        <div className="mt-3 rounded-xl bg-accent-soft p-3">
          <p className="font-semibold">{tx.done(done.length)}</p>
          {corrections?.note && <p className="mt-1 text-muted">{corrections.note}</p>}
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold text-accent">{tx.removed}</summary>
            <ul className="mt-1 grid gap-0.5 text-xs">
              {done.map((x) => (
                <li key={k(x.field, x.term)}>
                  <strong>{x.term}</strong> · {fieldName(x.field, locale)}: <span className="text-muted">{x.reason}</span>
                </li>
              ))}
            </ul>
          </details>
          <button type="button" onClick={undo} className="btn btn-ghost btn-sm mt-2">
            ↺ {tx.undo}
          </button>
        </div>
      )}
      {lastNone && <p className="mt-3 font-semibold">{tx.none}</p>}

      {payload.length === 0 ? (
        <p className="mt-3 text-muted">{tx.noData}</p>
      ) : (
        <>
          <button type="button" onClick={() => setPreview(!preview)} className="mt-3 font-semibold text-accent hover:underline">
            {preview ? `▴ ${tx.hidePreview}` : `▾ ${tx.preview}`}
          </button>
          {preview && (
            <div className="mt-2 grid gap-3">
              <p className="text-xs text-muted">{tx.previewNote}</p>
              {candidates.map((c) => (
                <div key={c.field}>
                  <div className="font-bold">{fieldName(c.field, locale)}</div>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {c.terms.map((x) => {
                      const off = dropped.has(k(c.field, x.term))
                      return (
                        <li key={x.term}>
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(dropped)
                              if (off) next.delete(k(c.field, x.term))
                              else next.add(k(c.field, x.term))
                              setDropped(next)
                            }}
                            className={`chip-soft text-xs ${off ? 'line-through opacity-40' : ''}`}
                            title={x.ex ? `${x.ex} · ${tx.remove}` : tx.remove}
                          >
                            {x.term} <span className="text-muted">{x.n}</span> {off ? '↺' : '×'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <label className="mt-3 flex max-w-3xl items-start gap-2 text-xs">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>{tx.consent}</span>
          </label>
          <label className="mt-2 flex max-w-3xl items-start gap-2 text-xs">
            <input type="checkbox" checked={examples} onChange={(e) => setExamples(e.target.checked)} className="mt-0.5" />
            <span>{tx.examples}</span>
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={run} disabled={!consent || state === 'loading' || left <= 0} className="btn btn-primary btn-sm">
              {state === 'loading' ? tx.running : done.length ? `🤖 ${tx.again}` : `🤖 ${tx.run}`}
            </button>
            <span className="text-xs text-muted">{tx.left(left, Math.max(0, IN_ALL - used.total))}</span>
          </div>
          {state === 'runs' && <p className="mt-2 font-semibold">{tx.runsUsed}</p>}
          {state === 'error' && <p className="mt-2 font-semibold text-bad">{error}</p>}
          {state === 'budget' && (
            <p className="mt-2">
              {t.programmes.ai.budget}{' '}
              <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(t.programmes.ai.budgetSubject)}`} className="font-semibold text-accent underline">
                {CONTACT}
              </a>
            </p>
          )}
        </>
      )}
    </section>
  )
}
