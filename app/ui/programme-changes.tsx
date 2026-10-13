'use client'

import { Fragment, useEffect, useMemo } from 'react'
import { saveCompareRows, update, useAppState } from '@/lib/store.ts'
import { useSite } from './site-context.tsx'
import { topicWeights, type UserTopic } from '@/lib/engine/topics.ts'
import { PERSONAL_REQUEST, orderByNumber, orderedFieldIds, shownScore, type PersonalFit } from '@/lib/engine/programme-fit.ts'
import { changeSummary, COMPARE_TOP, isCurrentKey, programmeChanges, profileKeyOf, type ProgrammeCompare, type ProgrammeEntry } from '@/lib/engine/programme-changes.ts'
import type { Preferences, Results } from '@/lib/engine/types.ts'
import type { RankedProgramme } from '@/lib/server/rank.ts'
import { allProgrammes, askPersonal, hasReadings, limitOf, requestFields, useCompareRows, useLocalProfile } from './programmes.tsx'
import { useFitScores, useReadings } from './readings.tsx'

/** One side of the comparison: the answers as they stood, and the topics they and the data gave. */
export interface ProgrammeSide {
  results: Results
  topics: UserTopic[]
}

export interface ProgrammeChangesInput {
  prefs: Preferences
  unlocked: boolean
  before: ProgrammeSide
  after: ProgrammeSide
}

function setCompare(compare: ProgrammeCompare) {
  update((s) => (s.contentAnalysis ? { ...s, contentAnalysis: { ...s.contentAnalysis, compare } } : s))
}

/**
 * The comparison after the content analysis. It starts by itself once the analysis has
 * finished, which the stored status says; the consent of the analysis covers it. The AI rates
 * the COMPARE_TOP best programmes of the new state, in requests of PERSONAL_REQUEST each.
 */
export function ProgrammeChanges({ input, token }: { input: ProgrammeChangesInput; token: string | null }) {
  const { t, locale } = useSite()
  const a = t.contentAi
  const state = useAppState()
  const compare = state.contentAnalysis?.compare
  const { prefs, unlocked, before, after } = input
  const providerAgreed = state.contentAnalysis?.provider === 'infomaniak'
  const pending = compare?.status === 'pending' && providerAgreed
  const readings = useReadings(token, unlocked && hasReadings(prefs))
  const beforeWeights = useMemo(() => topicWeights(before.topics), [before.topics])
  const afterWeights = useMemo(() => topicWeights(after.topics), [after.topics])
  const beforeProfile = useLocalProfile(before.results, beforeWeights)
  const afterProfile = useLocalProfile(after.results, afterWeights)
  const beforeFits = useFitScores(readings.byId, beforeProfile)
  const afterFits = useFitScores(readings.byId, afterProfile)
  const beforeFields = useMemo(() => requestFields(before.results), [before.results])
  const afterFields = useMemo(() => requestFields(after.results), [after.results])
  const ready = readings.status !== 'loading'
  // A comparison kept by an older version has another key, which no list accepts. It is made again once, here: the consent to the analysis covers it.
  const outdated = compare?.status === 'done' && !isCurrentKey(compare.key)
  const analysisOn = !!state.contentAnalysis?.enabled
  useEffect(() => {
    if (outdated && analysisOn && unlocked && providerAgreed) setCompare({ status: 'pending' })
  }, [outdated, analysisOn, unlocked, providerAgreed])

  useEffect(() => {
    if (!pending || !unlocked || !ready || !beforeProfile || !afterProfile) return
    const controller = new AbortController()
    const profile = afterProfile
    const fresh = compare?.status === 'pending' && compare.fresh === true
    const shownBefore = (p: RankedProgramme) => shownScore(p.match, beforeFits.scoreOf(p.id), beforeFits.hasScores)
    const computedAfter = (p: RankedProgramme) => shownScore(p.match, afterFits.scoreOf(p.id), afterFits.hasScores)
    const beforeRequest = { fields: beforeFields, prefs, topics: beforeWeights, sort: 'match' as const }
    const afterRequest = { fields: afterFields, prefs, topics: afterWeights, sort: 'match' as const }
    void (async () => {
      const [earlier, now] = await Promise.all([allProgrammes(beforeRequest, token, controller.signal), allProgrammes(afterRequest, token, controller.signal)])
      if (earlier === 'locked' || now === 'locked') throw new Error('locked')
      const beforeOrder = orderByNumber(earlier.items, shownBefore, orderedFieldIds(beforeFields))
      const top = orderByNumber(now.items, computedAfter, orderedFieldIds(afterFields)).slice(0, COMPARE_TOP)
      // All requests go out together; each one holds PERSONAL_REQUEST programmes, the most one request may carry.
      const chunks = Array.from({ length: Math.ceil(top.length / PERSONAL_REQUEST) }, (_, i) => top.slice(i * PERSONAL_REQUEST, (i + 1) * PERSONAL_REQUEST))
      // A chunk that fails is asked once more, unless the limit ended it; the other chunks still count.
      const settled = await Promise.allSettled(chunks.map((c) => askPersonal(c, profile, locale, token, computedAfter, fresh).catch((e: Error) => (limitOf(e) ? Promise.reject(e) : askPersonal(c, profile, locale, token, computedAfter, true)))))
      const answers: PersonalFit[] = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
      const failure = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected')
      if (!answers.length && failure) throw failure.reason
      if (controller.signal.aborted) return
      const rated = new Map(answers.map((f): [string, PersonalFit] => [f.id, f]))
      const shownAfter = (p: RankedProgramme) => shownScore(p.match, afterFits.scoreOf(p.id), afterFits.hasScores, rated.get(p.id))
      const ordered = orderByNumber(top, shownAfter, orderedFieldIds(afterFields))
      const rows = programmeChanges(
        beforeOrder.map((p): ProgrammeEntry => ({ id: p.id, name: p.name, institution: p.institution, score: shownBefore(p) })),
        ordered.map((p) => {
          const personal = rated.get(p.id)
          return { id: p.id, name: p.name, institution: p.institution, score: shownAfter(p), computed: computedAfter(p), reasons: personal && !personal.thin ? personal.reasons : [] }
        }),
      )
      // Each row keeps its fit too, and the request it was made for, so the lists show the same rating without asking again.
      const at = new Date().toISOString()
      // The rows are kept in the browser's own store, which has room for them; the state keeps only the comparison's marks.
      void saveCompareRows(at, rows.map((row) => ({ ...row, after: { ...row.after, fit: rated.get(row.id)?.fit } })))
      setCompare({ status: 'done', at, key: profileKeyOf(state) })
    })().catch((e: Error) => {
      if (!controller.signal.aborted) setCompare({ status: 'failed', limit: limitOf(e) })
    })
    return () => controller.abort()
    // One comparison per pending status: later changes to the lists do not start it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, unlocked, ready])

  const done = compare?.status === 'done' ? compare : null
  const compared = useCompareRows()
  const summary = done && compared ? changeSummary(compared) : null
  return <div className="space-y-2">
    {pending && <p role="status" className="animate-pulse">{a.comparing}</p>}
    {compare?.status === 'failed' && <p role="alert" className="text-bad">{compare.limit ? a.compareLimit : a.compareFailed}</p>}
    {!pending && <p className="text-muted">{a.compareNote}</p>}
    {!pending && !providerAgreed && <p className="text-muted">{t.landing.swissAi.retention}</p>}
    {!pending && <button type="button" className="btn btn-ghost btn-sm max-w-full whitespace-normal text-left" onClick={() => update((s) => s.contentAnalysis ? { ...s, contentAnalysis: { ...s.contentAnalysis, provider: 'infomaniak', compare: { status: 'pending', fresh: true } } } : s)}>{compare ? a.repeat : a.compareStart}</button>}
    {done && summary && <details>
      <summary className="cursor-pointer font-bold">{a.programmeChanges}</summary>
      <div className="mt-2 space-y-2">
        <p>{a.changeSummary(summary.up, summary.down, summary.added, summary.changed)}</p>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-xs">
            <thead><tr>{[[a.programme, 'w-[40%]'], [a.rankBefore, 'w-[16%]'], [a.rankAfter, 'w-[16%]'], [a.pointsChange, 'w-[28%]']].map(([label, width]) => <th key={label} scope="col" className={`${width} px-2 py-2`}>{label}</th>)}</tr></thead>
            <tbody>{(compared ?? []).map((r) => <Fragment key={r.id}><tr className="border-t border-soft-line align-top">
              <th scope="row" className="px-2 py-2 font-semibold">{r.name}<span className="block font-normal text-muted">{r.institution}</span></th>
              <td className="px-2 py-2">{r.before ? r.before.rank : a.newInList}</td>
              <td className="px-2 py-2">{r.after.rank}</td>
              <td className="whitespace-nowrap px-2 py-2">{r.before ? Math.round(r.before.score) : '–'} → {Math.round(r.after.score)}</td>
            </tr>{r.after.reasons.length > 0 && <tr><td colSpan={4} className="px-2 pb-2 text-muted">{r.after.reasons.join(' ')}</td></tr>}</Fragment>)}</tbody>
          </table>
        </div>
      </div>
    </details>}
  </div>
}
