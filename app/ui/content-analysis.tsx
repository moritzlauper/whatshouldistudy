'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { CONTENT_MAX, CONTENT_RUN_VERSION, CONTENT_SAMPLE, classifyInBatches, contentVerdicts, type ContentItem, type ContentProgress, type ContentVerdict } from '@/lib/engine/content-analysis.ts'
import { prepareContentAnalysis } from '@/lib/sources/exports.ts'
import { withBase } from '@/lib/site.ts'
import { discardCompareRows, getState, loadContentInput, loadContentProgress, saveContentProgress, update, useAppState } from '@/lib/store.ts'
import { useSite } from './site-context.tsx'
import { ProgrammeChanges, type ProgrammeChangesInput } from './programme-changes.tsx'
import { fieldName } from '@/lib/site/labels.ts'
import type { FieldMatch } from '@/lib/engine/types.ts'
import { ScanProgress } from './scan-progress.tsx'

type Prepared = ReturnType<typeof prepareContentAnalysis>
type Comparison = { before: FieldMatch[]; after: FieldMatch[] }

/** An unfinished run continues only on the plan it was made with: same size, same number of titles. */
const sameRun = (progress: ContentProgress, plan: Prepared) => progress.size === plan.size && progress.total === plan.items.length

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
  const expandable = Number(ai?.summary.stats.aiExpandable ?? ai?.summary.stats.aiEligible ?? 0)
  const canExpand = !!ai && sampled < CONTENT_MAX && expandable > sampled
  const [prepared, setPrepared] = useState<{ base: typeof base; plan: Prepared } | null>(null)
  // The unfinished run of this import, kept in this browser after every answered group.
  const [saved, setSaved] = useState<{ base: typeof base; progress: ContentProgress } | null>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'running'>('idle')
  const [dismissed, setDismissed] = useState(false)
  // The panel shows the larger sample until its result replaces the standard one.
  const [wide, setWide] = useState(false)
  const [done, setDone] = useState(0)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const sending = useRef(false)
  const plan = prepared?.base === base ? prepared?.plan : undefined
  const pending = saved && saved.base === base ? saved.progress : null
  // The unfinished run that the shown plan continues, and the maximum run that its button continues.
  const resuming = pending && plan && sameRun(pending, plan) ? pending : null
  const unfinished = pending && pending.size === CONTENT_MAX ? pending : null

  useEffect(() => {
    const task = new AbortController()
    active.current = task
    sending.current = false
    setPrepared(null)
    setSaved(null)
    setError('')
    setDismissed(false)
    setWide(false)
    setStatus(base && !hasAnalysis ? 'reading' : 'idle')
    if (base) {
      void Promise.all([hasAnalysis ? null : loadContentInput(getState()), loadContentProgress(getState())]).then(([input, found]) => {
        if (task.signal.aborted) return
        // An unfinished standard run is rebuilt from the time it was made, so it continues on the same titles.
        if (input) setPrepared({ base, plan: prepareContentAnalysis(input, CONTENT_SAMPLE, found?.size === CONTENT_SAMPLE ? found.now : undefined) })
        if (found) setSaved({ base, progress: found })
      }).catch(() => {
        if (!task.signal.aborted) setError(a.failed)
      }).finally(() => { if (!task.signal.aborted) setStatus('idle') })
    }
    return () => { task.abort(); active.current?.abort() }
  }, [base, importId, hasAnalysis, token, a.failed, state.summaries['google-search']])

  // Up to CONTENT_MAX titles from this browser's import, with the same consent as the standard sample.
  async function expand() {
    if (!base || status !== 'idle' || sending.current) return
    const input = await loadContentInput(getState()).catch(() => undefined)
    if (getState().summaries.takeout !== base) return
    if (!input) return setError(a.failed)
    setError('')
    // An unfinished maximum run is rebuilt from the time it was made, so it continues on the same titles.
    setPrepared({ base, plan: prepareContentAnalysis(input, CONTENT_MAX, unfinished?.now) })
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

  // Drops the unfinished run; the next start classifies from the beginning.
  function discard() {
    void saveContentProgress(null)
    setSaved(null)
  }

  async function analyse() {
    if (!base || !importId || !plan?.items.length || status !== 'idle' || sending.current) return
    // A double click, replacement or deletion cannot start another batch.
    if (getState().summaries.takeout !== base || (wide && plan.googleBaseCollectedAt !== getState().summaries['google-search']?.collectedAt && plan.items.some(it => it.kind === 'read'))) return
    active.current?.abort()
    const task = new AbortController()
    active.current = task
    sending.current = true
    setError('')
    setStatus('running')
    // An unfinished run of this plan continues: the groups it answered are not sent again.
    const earlier = resuming
    const answered = earlier?.verdicts.length ?? 0
    setDone(answered)
    let progress: ContentProgress = earlier ?? { version: CONTENT_RUN_VERSION, importId, baseCollectedAt: base.collectedAt, size: plan.size, now: plan.now, total: plan.items.length, savedAt: Date.now(), done: [], verdicts: [] }
    try {
      const result = await classifyInBatches(plan.items, (group) => sendBatch(group, task.signal), {
        done: new Set(earlier?.done ?? []),
        stopped: () => task.signal.aborted || getState().summaries.takeout !== base,
        onGroup: (group, verdicts) => {
          if (getState().summaries.takeout !== base) return
          // Saved after every answered group, so a closed tab loses at most the group still in flight.
          progress = { ...progress, savedAt: Date.now(), done: [...progress.done, group], verdicts: [...progress.verdicts, ...verdicts] }
          void saveContentProgress(progress)
        },
        onProgress: (n) => setDone(answered + n),
      })
      if (task.signal.aborted || getState().summaries.takeout !== base) return
      // Every group was tried, so the run is finished and its progress goes. A budget stop keeps it for a later run.
      if (!result.limited) discard()
      const verdicts = [...(earlier?.verdicts ?? []), ...result.verdicts]
      const classified = verdicts.length
      // Nothing classified: there is no new result, and the earlier one stays.
      if (!classified) throw new Error(result.limited ? 'limit' : 'failed')
      // Fewer titles than the result in use: that result stays, and the message says why.
      if (ai && classified < Number(ai.summary.stats.aiClassified ?? ai.summary.stats.aiItems ?? 0)) {
        setError(a.keptEarlier(classified, plan.items.length))
        setWide(false)
        return
      }
      const summary = plan.apply(verdicts)
      const googleSummary = plan.googleBaseCollectedAt === getState().summaries['google-search']?.collectedAt ? plan.applyGoogle(verdicts) : undefined
      // A budget that ended the run early is stored with the result, so the note survives a reload.
      summary.stats.aiLimited = result.limited ? 1 : 0
      update((s) => s.summaries.takeout !== base ? s : {
        ...s, contentAnalysis: { baseCollectedAt: base.collectedAt, summary, ...(googleSummary ? { google: { baseCollectedAt: plan.googleBaseCollectedAt!, summary: googleSummary } } : {}), enabled: true, provider: 'infomaniak', compare: { status: 'pending' } },
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
      // Shows what is kept after the run: an interrupted or budget-stopped run can be continued.
      void loadContentProgress(getState()).then((found) => setSaved(found ? { base, progress: found } : null))
    }
  }

  return <section className="card-sm mt-4 space-y-3 p-4 text-sm">
    <h3 className="font-display text-xl">{a.title}</h3>
    <p className="text-muted">{a.lead}</p>
    {ai && !wide ? <div className="space-y-2">
      <p>{ai.enabled ? a.active : a.off}</p>
      <p className="text-muted">{a.sample(Number(ai.summary.stats.aiItems ?? 0), Number(ai.summary.stats.aiEligible ?? 0))} {a.contextNote}</p>
      {Number(ai.summary.stats.aiLimited ?? 0) > 0
        ? <p>{a.limitPartial(Number(ai.summary.stats.aiClassified ?? 0), Number(ai.summary.stats.aiItems ?? 0))}</p>
        : Number(ai.summary.stats.aiClassified ?? ai.summary.stats.aiItems ?? 0) < Number(ai.summary.stats.aiItems ?? 0) && <p>{a.partial(Number(ai.summary.stats.aiClassified ?? 0), Number(ai.summary.stats.aiItems ?? 0))}</p>}
      {comparison && <ContentAnalysisChanges comparison={comparison} />}
      {programmes && <ProgrammeChanges input={programmes} token={token} />}
      <div className="flex flex-wrap gap-2">
        {canExpand && <button type="button" className="btn btn-ghost btn-sm max-w-full whitespace-normal text-left" disabled={status !== 'idle'} onClick={() => void expand()}>{unfinished ? a.resumeMore(unfinished.verdicts.length, unfinished.total) : a.more(Math.min(CONTENT_MAX, expandable))}</button>}
        <button type="button" className="btn btn-ghost btn-sm" disabled={status !== 'idle'} onClick={() => update((s) => ({ ...s, contentAnalysis: s.contentAnalysis ? { ...s.contentAnalysis, enabled: !s.contentAnalysis.enabled } : undefined }))}>{ai.enabled ? a.disable : a.enable}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={status !== 'idle'} onClick={() => { discard(); void discardCompareRows(); update((s) => ({ ...s, contentAnalysis: undefined })) }}>{a.remove}</button>
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
          <strong>{it.kind === 'read' ? a.article : t.results.kinds[it.kind] ?? a.channel}: {it.title}</strong>{it.channel && ` · ${it.channel}`}
          {it.context.length > 0 && <p className="text-muted">{it.context.join(' · ')}</p>}
        </li>)}</ul>
      </details>
      {wide && <p>{a.newsMaximum}</p>}
      <p>{a.consent}</p>
      <p>{t.landing.swissAi.retention}</p>
      {wide && <p className="text-muted">{a.moreHint}</p>}
      {resuming && <p>{a.resumed(resuming.verdicts.length, resuming.total)}</p>}
      {status === 'running' ? <p role="status" className="animate-pulse">{a.loading(done, plan.items.length)}</p> : <button type="button" className="btn btn-primary btn-sm max-w-full whitespace-normal text-left" onClick={() => void analyse()}>{resuming ? a.resume : a.agree}</button>}
      {(status === 'running' || resuming) && <ScanProgress done={status === 'running' ? done : resuming!.verdicts.length} total={plan.items.length} label={a.title} />}
      {resuming && status !== 'running' && <button type="button" className="btn btn-ghost btn-sm" onClick={discard}>{a.discard}</button>}
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
