'use client'

import { useEffect, useState } from 'react'
import { withBase } from '@/lib/site.ts'
import type { Preferences, QuestionnaireAnswers, Results, SourceSummary } from '@/lib/engine/types.ts'
import { lastTop } from './programmes.tsx'

/**
 * For the site owner only: sends this whole result to Claude for a critical
 * review. Shown once the review key has been given in the address
 * (…/resultat?review=KEY); the key stays in this browser and the server
 * checks it against WSIS_REVIEW_KEY. Uploaded data go as their summaries only.
 */
const KEY_STORE = 'wsis:review-key'

/** Long lists and strings shortened, so a large export summary stays a readable size. */
function trim(x: unknown, depth = 0): unknown {
  if (typeof x === 'string') return x.length > 200 ? `${x.slice(0, 200)}…` : x
  if (Array.isArray(x)) return x.slice(0, 40).map((v) => trim(v, depth + 1))
  if (x && typeof x === 'object') {
    if (depth > 6) return '…'
    const entries = Object.entries(x as Record<string, unknown>)
    // Maps keyed by term or field: keep the 60 largest.
    const big = entries.length > 60 && entries.every(([, v]) => typeof v === 'number')
    const kept = big ? entries.sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 60) : entries
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

  if (!key) return null

  async function run() {
    setState('loading')
    setReview(null)
    try {
      const res = await fetch(withBase('/api/review'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-review-key': key! },
        body: JSON.stringify({ results: trim(results), answers, prefs, summaries: summaries.map((s) => trim(s)), topProgrammes: lastTop.current }),
      })
      const j = (await res.json().catch(() => ({}))) as { review?: string; error?: string }
      if (!res.ok || !j.review) throw new Error(j.error ?? `HTTP ${res.status}`)
      setReview(j.review)
      setState('idle')
    } catch (e) {
      setError((e as Error).message)
      setState('error')
    }
  }

  return (
    <section className="card-sm mt-4 border-dashed p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold">🧪 Review (nur für dich)</p>
        <button type="button" onClick={run} disabled={state === 'loading'} className="btn btn-ghost btn-sm">
          {state === 'loading' ? 'Claude prüft … (bis 2 Min.)' : 'Ganzes Resultat mit KI prüfen'}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">Schickt Antworten, Zusammenfassungen der Uploads, Rangliste und Top-Studiengänge an Claude.</p>
      {state === 'error' && <p className="mt-2 font-semibold text-bad">{error}</p>}
      {review && <div className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-surface-2 p-3">{review}</div>}
    </section>
  )
}
