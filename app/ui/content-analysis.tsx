'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CONTENT_MAX, CONTENT_MIN_SHARE, classifyInBatches, contentVerdicts, type ContentItem, type ContentVerdict } from '@/lib/engine/content-analysis.ts'
import { prepareContentAnalysis } from '@/lib/sources/exports.ts'
import { withBase } from '@/lib/site.ts'
import { getState, loadContentInput, update, useAppState } from '@/lib/store.ts'
import { useSite } from './site-context.tsx'
import { ProgrammeChanges, type ProgrammeChangesInput } from './programme-changes.tsx'
import { fieldName } from '@/lib/site/labels.ts'
import type { FieldMatch } from '@/lib/engine/types.ts'

type Prepared = ReturnType<typeof prepareContentAnalysis>
type Comparison = { before: FieldMatch[]; after: FieldMatch[] }

/** Prepare the existing local import; only the explicit consent button sends it. */
export function ContentAnalysisPanel({ token, comparison, programmes }: { token: string | null; comparison?: Comparison; programmes?: ProgrammeChangesInput }) {
  const { t, r, locale } = useSite()
  const a = t.contentAi
  const state = useAppState()
  const base = state.summaries.takeout
  const importId = state.contentImportId
  const ai = state.contentAnalysis?.baseCollectedAt === base?.collectedAt ? state.contentAnalysis : undefined
  const hasAnalysis = !!ai
  const sampled = Number(ai?.summary.stats.aiItems ?? 0)
  // After the standard sample, the panel can classify more titles, up to CONTENT_MAX.
  const canExpand = !!ai && sampled < CONTENT_MAX && Number(ai.summary.stats.aiEligible ?? 0) > sampled
  const [prepared, setPrepared] = useState<{ base: typeof base; plan: Prepared } | null>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'running'>('idle')
  const [dismissed, setDismissed] = useState(false)
  // The panel shows the larger sample until its result replaces the standard one.
  const [wide, setWide] = useState(false)
  const [done, setDone] = useState(0)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const sending = useRef(false)
  const plan = prepared?.base === base ? prepared?.plan : undefined

  useEffect(() => {
    const task = new AbortController()
    active.current = task
    sending.current = false
    setPrepared(null)
    setError('')
    setDismissed(false)
    setWide(false)
    setStatus(base && !hasAnalysis ? 'reading' : 'idle')
    if (base && !hasAnalysis) {
      void loadContentInput(getState()).then((input) => {
        if (task.signal.aborted) return
        if (input) setPrepared({ base, plan: prepareContentAnalysis(input) })
      }).catch(() => {
        if (!task.signal.aborted) setError(a.failed)
      }).finally(() => { if (!task.signal.aborted) setStatus('idle') })
    }
    return () => { task.abort(); active.current?.abort() }
  }, [base, importId, hasAnalysis, token, a.failed])

  // Up to CONTENT_MAX titles from this browser's import, with the same consent as the standard sample.
  async function expand() {
    if (!base || status !== 'idle' || sending.current) return
    const input = await loadContentInput(getState()).catch(() => undefined)
    if (getState().summaries.takeout !== base) return
    if (!input) return setError(a.failed)
    setError('')
    setPrepared({ base, plan: prepareContentAnalysis(input, CONTENT_MAX) })
    setWide(true)
  }

  // One request for one group. Anything that is not a usable answer throws or comes back empty, and classifyInBatches tries the group again.
  async function sendBatch(group: ContentItem[], signal: AbortSignal): Promise<ContentVerdict[]> {
    const response = await fetch(withBase('/api/content-analysis'), {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ consent: true, source: 'takeout', locale, items: group }),
    })
    if (!response.ok) throw new Error(response.status === 429 ? 'limit' : 'failed')
    const body = await response.json() as { items?: ContentVerdict[] }
    return contentVerdicts((body.items ?? []).map((x) => ({ ...x, fields: Object.entries(x.fields ?? {}).map(([id, confidence]) => ({ id, confidence })) })), new Set(group.map((x) => x.id)))
  }

  async function analyse() {
    if (!base || !plan?.items.length || status !== 'idle' || sending.current) return
    // A double click, replacement or deletion cannot start another batch.
    if (getState().summaries.takeout !== base) return
    active.current?.abort()
    const task = new AbortController()
    active.current = task
    sending.current = true
    setError('')
    setDone(0)
    setStatus('running')
    try {
      const result = await classifyInBatches(plan.items, (group) => sendBatch(group, task.signal), {
        stopped: () => task.signal.aborted || getState().summaries.takeout !== base,
        onProgress: setDone,
      })
      if (task.signal.aborted || getState().summaries.takeout !== base) return
      if (result.limited) throw new Error('limit')
      // Titles of a group that failed for good are left out; the result replaces the earlier one only when most titles were classified.
      if (result.verdicts.length < CONTENT_MIN_SHARE * plan.items.length) throw new Error('failed')
      const summary = plan.apply(result.verdicts)
      if (task.signal.aborted) return
      update((s) => s.summaries.takeout !== base ? s : {
        ...s, contentAnalysis: { baseCollectedAt: base.collectedAt, summary, enabled: true, compare: { status: 'pending' } },
      })
      setWide(false)
    } catch (e) {
      if (!task.signal.aborted) {
        setError(e instanceof Error && e.message === 'limit' ? a.limit : a.failed)
        // Back to the result still in use, with the message above it.
        setWide(false)
      }
    } finally {
      if (active.current === task) { sending.current = false; setStatus('idle') }
    }
  }

  return <section className="card-sm mt-4 space-y-3 p-4 text-sm">
    <h3 className="font-display text-xl">{a.title}</h3>
    <p className="text-muted">{a.lead}</p>
    {ai && !wide ? <div className="space-y-2">
      <p>{ai.enabled ? a.active : a.off}</p>
      <p className="text-muted">{a.sample(Number(ai.summary.stats.aiItems ?? 0), Number(ai.summary.stats.aiEligible ?? 0))} {a.contextNote}</p>
      {Number(ai.summary.stats.aiClassified ?? ai.summary.stats.aiItems ?? 0) < Number(ai.summary.stats.aiItems ?? 0) && <p>{a.partial(Number(ai.summary.stats.aiClassified ?? 0), Number(ai.summary.stats.aiItems ?? 0))}</p>}
      {comparison && <ContentAnalysisChanges comparison={comparison} />}
      {programmes && <ProgrammeChanges input={programmes} token={token} />}
      <div className="flex flex-wrap gap-2">
        {canExpand && <button type="button" className="btn btn-ghost btn-sm max-w-full whitespace-normal text-left" disabled={status !== 'idle'} onClick={() => void expand()}>{a.more}</button>}
        <button type="button" className="btn btn-ghost btn-sm" disabled={status !== 'idle'} onClick={() => update((s) => ({ ...s, contentAnalysis: s.contentAnalysis ? { ...s.contentAnalysis, enabled: !s.contentAnalysis.enabled } : undefined }))}>{ai.enabled ? a.disable : a.enable}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={status !== 'idle'} onClick={() => update((s) => ({ ...s, contentAnalysis: undefined }))}>{a.remove}</button>
      </div>
    </div> : status === 'reading' ? <p role="status">{a.reading}</p> : !plan ? <>
      <p className="text-muted">{base ? a.unavailable : a.missing}</p>
      <Link href={r.start} className="btn btn-ghost btn-sm">{a.import}</Link>
    </> : !plan.items.length ? <p className="text-muted">{a.empty}</p> : dismissed && !wide ? (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDismissed(false)}>{a.ask}</button>
    ) : <>
      <p className="font-semibold">{a.ready}</p>
      <p>{a.sample(plan.items.length, plan.eligible)}</p>
      <p className="text-muted">{a.contextNote}</p>
      <details><summary className="cursor-pointer font-bold">{a.preview}</summary>
        <ul className="mt-2 max-h-64 space-y-2 overflow-auto break-words text-xs">{plan.items.map((it) => <li key={it.id}>
          <strong>{t.results.kinds[it.kind] ?? a.channel}: {it.title}</strong>{it.channel && ` · ${it.channel}`}
          {it.context.length > 0 && <p className="text-muted">{it.context.join(' · ')}</p>}
        </li>)}</ul>
      </details>
      <p>{a.consent}</p>
      {wide && <p className="text-muted">{a.moreHint}</p>}
      {status === 'running' ? <p role="status" className="animate-pulse">{a.loading(done, plan.items.length)}</p> : <button type="button" className="btn btn-primary btn-sm max-w-full whitespace-normal text-left" onClick={() => void analyse()}>{a.agree}</button>}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { active.current?.abort(); sending.current = false; setWide(false); setDismissed(true); setStatus('idle'); setError('') }}>{a.cancel}</button>
    </>}
    {error && <p role="alert" className="text-bad">{error}</p>}
  </section>
}

export function ContentAnalysisChanges({ comparison }: { comparison: Comparison }) {
  const { t, locale, intl } = useSite()
  const a = t.contentAi
  const top = comparison.after.slice(0, 10)
  const unchanged = top.every((field, i) => comparison.before[i]?.id === field.id)
  const points = (value: number) => value.toLocaleString(intl, { maximumFractionDigits: 1 })
  return <div className="space-y-2">
    <p>{unchanged ? a.unchanged : a.changed}</p>
    <details>
      <summary className="cursor-pointer font-bold">{a.changes}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr>{[a.field, a.before, a.after, a.points].map((label) => <th key={label} scope="col" className="px-2 py-2">{label}</th>)}</tr></thead>
          <tbody>{top.map((field, i) => {
            const previous = comparison.before.findIndex((f) => f.id === field.id)
            return <tr key={field.id} className="border-t border-soft-line">
              <th scope="row" className="px-2 py-2 font-semibold">{fieldName(field.id, locale)}</th>
              <td className="px-2 py-2">{previous < 0 ? '–' : previous + 1}</td><td className="px-2 py-2">{i + 1}</td>
              <td className="whitespace-nowrap px-2 py-2">{previous < 0 ? '–' : points(comparison.before[previous].score)} → {points(field.score)}</td>
            </tr>
          })}</tbody>
        </table>
      </div>
    </details>
  </div>
}
