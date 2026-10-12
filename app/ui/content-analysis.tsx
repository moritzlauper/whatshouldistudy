'use client'

import { useEffect, useRef, useState } from 'react'
import { CONTENT_BATCH, contentVerdicts, type ContentVerdict } from '@/lib/engine/content-analysis.ts'
import { readExports, type ExportResult } from '@/lib/sources/exports.ts'
import { withBase } from '@/lib/site.ts'
import { update, useAppState } from '@/lib/store.ts'
import { useSite } from './site-context.tsx'

type Prepared = { result: ExportResult; plan: ReturnType<ExportResult['contentAnalysis']> }

/** Consent is specific to the previewed export sample, separate from programme comparison. */
export function ContentAnalysisPanel({ token }: { token: string | null }) {
  const { t, locale } = useSite()
  const a = t.contentAi
  const state = useAppState()
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'running'>('idle')
  const [done, setDone] = useState(0)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])

  async function prepare(files: File[]) {
    active.current?.abort()
    const task = new AbortController()
    active.current = task
    setPrepared(null)
    setError('')
    setStatus('reading')
    try {
      const result = await readExports(files)
      if (task.signal.aborted) return
      const plan = result.contentAnalysis()
      if (!plan.items.length) setError(a.empty)
      else setPrepared({ result, plan })
    } catch { if (!task.signal.aborted) setError(a.failed) }
    finally { if (!task.signal.aborted) setStatus('idle') }
  }

  async function analyse() {
    if (!prepared || status !== 'idle') return
    const task = new AbortController()
    active.current = task
    const previous = state.summaries.takeout
    setError('')
    setDone(0)
    setStatus('running')
    try {
      const verdicts: ContentVerdict[] = []
      for (let offset = 0; offset < prepared.plan.items.length; offset += CONTENT_BATCH) {
        const items = prepared.plan.items.slice(offset, offset + CONTENT_BATCH)
        const response = await fetch(withBase('/api/content-analysis'), {
          method: 'POST', signal: task.signal,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ consent: true, source: 'takeout', locale, items }),
        })
        if (!response.ok) throw new Error(response.status === 429 ? 'limit' : 'failed')
        const body = await response.json() as { items: ContentVerdict[] }
        // Revalidate the response before any local ranking is changed.
        verdicts.push(...contentVerdicts(body.items.map((x) => ({ ...x, fields: Object.entries(x.fields).map(([id, confidence]) => ({ id, confidence })) })), new Set(items.map((x) => x.id))))
        if (task.signal.aborted) return
        setDone(verdicts.length)
      }
      const base = prepared.result.summaries.find((s) => s.source === 'takeout')!
      const summary = prepared.plan.apply(verdicts)
      if (task.signal.aborted) return
      // A newer import or deletion takes precedence over an in-flight request.
      update((s) => s.summaries.takeout !== previous ? s : {
        ...s, summaries: { ...s.summaries, takeout: base },
        contentAnalysis: { baseCollectedAt: base.collectedAt, summary, enabled: true },
      })
      setPrepared(null)
    } catch (e) {
      if (!task.signal.aborted) setError(e instanceof Error && e.message === 'limit' ? a.limit : a.failed)
    } finally { if (!task.signal.aborted) setStatus('idle') }
  }

  const ai = state.contentAnalysis
  return <section className="card-sm mt-4 space-y-3 p-4 text-sm">
    <h3 className="font-display text-xl">{a.title}</h3>
    <p className="text-muted">{a.lead}</p>
    {ai && <div className="space-y-2">
      <p>{ai.enabled ? a.active : a.off}</p>
      <p className="text-muted">{a.sample(Number(ai.summary.stats.aiItems ?? 0), Number(ai.summary.stats.aiEligible ?? 0))} {a.contextNote}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost btn-sm" disabled={status !== 'idle'} onClick={() => update((s) => ({ ...s, contentAnalysis: s.contentAnalysis ? { ...s.contentAnalysis, enabled: !s.contentAnalysis.enabled } : undefined }))}>{ai.enabled ? a.disable : a.enable}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={status !== 'idle'} onClick={() => update((s) => ({ ...s, contentAnalysis: undefined }))}>{a.remove}</button>
      </div>
    </div>}
    <p className="text-muted">{a.help}</p>
    <label className="block font-semibold">{a.file}
      <input type="file" multiple accept=".zip,.json,.html,.csv" disabled={status !== 'idle'} className="mt-2 block w-full text-xs" onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) void prepare(files) }} />
    </label>
    {status === 'reading' && <p role="status">{a.reading}</p>}
    {prepared && <>
      <p>{a.sample(prepared.plan.items.length, prepared.plan.eligible)}</p>
      <p className="text-muted">{a.contextNote}</p>
      <details><summary className="cursor-pointer font-bold">{a.preview}</summary>
        <ul className="mt-2 max-h-64 space-y-2 overflow-auto break-words text-xs">{prepared.plan.items.map((it) => <li key={it.id}>
          <strong>{t.results.kinds[it.kind] ?? a.channel}: {it.title}</strong>{it.channel && ` · ${it.channel}`}
          {it.context.length > 0 && <p className="text-muted">{it.context.join(' · ')}</p>}
        </li>)}</ul>
      </details>
      <p>{a.consent}</p>
      {status === 'running' ? <p role="status" className="animate-pulse">{a.loading(done, prepared.plan.items.length)}</p> : <button type="button" className="btn btn-primary btn-sm max-w-full whitespace-normal text-left" onClick={() => void analyse()}>{a.agree}</button>}
    </>}
    {(prepared || status !== 'idle') && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { active.current?.abort(); setPrepared(null); setStatus('idle'); setError('') }}>{a.cancel}</button>}
    {error && <p role="alert" className="text-bad">{error}</p>}
  </section>
}
