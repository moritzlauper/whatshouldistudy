'use client'

import { useEffect, useState } from 'react'
import { withBase } from '@/lib/site.ts'
import type { Preferences, QuestionnaireAnswers, Results, SourceSummary } from '@/lib/engine/types.ts'
import { forReview, summaryCounts } from '@/lib/engine/review-payload.ts'

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
import { lastTop } from './programmes.tsx'

export function ReviewPanel({ results, answers, prefs, summaries }: { results: Results; answers: QuestionnaireAnswers; prefs: Preferences; summaries: SourceSummary[] }) {
  const [key, setKey] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  // What the person sees while waiting: sent, connected (first keep-alive), writing.
  const [phase, setPhase] = useState('')
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
    setPhase('Wird gesendet …')
    try {
      const res = await fetch(withBase('/api/review'), {
        method: 'POST',
        // Never wait longer than the server may take.
        signal: AbortSignal.timeout(200_000),
        headers: { 'Content-Type': 'application/json', ...(key ? { 'x-review-key': key } : {}) },
        body: JSON.stringify({ results: trim(forReview(results)), answers, prefs, summaries: trim(summaryCounts(summaries)), topProgrammes: lastTop.current }),
      })
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      // The answer streams in; NUL bytes are only keep-alives.
      setPhase('Verbunden, Claude liest dein Resultat …')
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let text = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        text += dec.decode(value, { stream: true }).replace(/\u0000/g, '')
        if (text.trim()) setReview(text)
      }
      if (!text.trim()) throw new Error('Keine Antwort erhalten.')
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
      {state === 'loading' && !review && <p className="mt-2 animate-pulse text-muted">{phase}</p>}
      {state === 'error' && <p className="mt-2 font-semibold text-bad">{error}</p>}
      {review && <div className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-3">{review}</div>}
    </section>
  )
}
