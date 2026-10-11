'use client'

import { useEffect, useState } from 'react'
import { withBase } from '@/lib/site.ts'
import type { Preferences, QuestionnaireAnswers, Results, SourceSummary } from '@/lib/engine/types.ts'
import { lastTop } from './programmes.tsx'

/**
 * Sends this whole result to Claude for a critical review. Open to everyone
 * while the site is in testing (REVIEW_PUBLIC in lib/server/review.ts); a
 * review key given once in the address (…/resultat?review=KEY) lifts the
 * daily limit. Uploaded data go as their summaries only.
 */
const KEY_STORE = 'wsis:review-key'

/** Long lists and strings shortened, so a large export summary stays a readable size. */
function trim(x: unknown, depth = 0): unknown {
  if (typeof x === 'string') return x.length > 120 ? `${x.slice(0, 120)}…` : x
  if (Array.isArray(x)) return x.slice(0, 20).map((v) => trim(v, depth + 1))
  if (x && typeof x === 'object') {
    if (depth > 6) return '…'
    const entries = Object.entries(x as Record<string, unknown>)
    // Maps keyed by term or field: keep the 60 largest.
    const big = entries.length > 30 && entries.every(([, v]) => typeof v === 'number')
    const kept = big ? entries.sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 30) : entries
    return Object.fromEntries(kept.map(([k, v]) => [k, trim(v, depth + 1)]))
  }
  return x
}

export function ReviewPanel({ results, answers, prefs, summaries }: { results: Results; answers: QuestionnaireAnswers; prefs: Preferences; summaries: SourceSummary[] }) {
  const [key, setKey] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [review, setReview] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const given = url.searchParams.get('review')
      if (given) {
        window.localStorage.setItem(KEY_STORE, given)
        url.searchParams.delete('review')
        window.history.replaceState(null, '', url.toString())
      }
      setKey(window.localStorage.getItem(KEY_STORE))
    } catch {
      setKey(null)
    }
  }, [])

  async function run() {
    setState('loading')
    setReview(null)
    try {
      const res = await fetch(withBase('/api/review'), {
        method: 'POST',
        // Never wait longer than the server may take.
        signal: AbortSignal.timeout(200_000),
        headers: { 'Content-Type': 'application/json', ...(key ? { 'x-review-key': key } : {}) },
        body: JSON.stringify({ results: trim(results), answers, prefs, summaries: summaries.map((s) => trim(s)), topProgrammes: lastTop.current }),
      })
      const j = (await res.json().catch(() => ({}))) as { review?: string; error?: string }
      if (!res.ok || !j.review) throw new Error(j.error ?? `HTTP ${res.status}`)
      setReview(j.review)
      setState('idle')
    } catch (e) {
      const err = e as Error
      setError(err.name === 'TimeoutError' ? 'Die Prüfung hat zu lange gedauert. Versuch es nochmals.' : err.message)
      setState('error')
    }
  }

  return (
    <section className="card-sm mt-4 border-dashed p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold">🧪 Test: Resultat von der KI prüfen lassen</p>
        <button type="button" onClick={run} disabled={state === 'loading'} className="btn btn-ghost btn-sm">
          {state === 'loading' ? 'Claude prüft … (etwa 1 Min.)' : 'Ganzes Resultat mit KI prüfen'}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">Claude prüft, ob dein Resultat stimmig ist. Dafür schicken wir dein anonymes Profil, die Zusammenfassungen deiner Uploads (keine Verläufe), die Rangliste und die Top-Studiengänge an Anthropic. Gespeichert wird nichts.</p>
      {state === 'error' && <p className="mt-2 font-semibold text-bad">{error}</p>}
      {review && <div className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-3">{review}</div>}
    </section>
  )
}
