'use client'

import { useEffect, useMemo, useState } from 'react'
import { CONTACT, withBase } from '@/lib/site.ts'
import { riasecLabel, subjectLabel } from '@/lib/site/labels.ts'
import { FACTS_COUNTRIES, type FitReason, type LocalFit, type PersonalFit, type ProgrammeFacts } from '@/lib/engine/programme-fit.ts'
import type { SubjectKey } from '@/lib/taxonomy/fields.ts'
import { useSite } from './site-context.tsx'

/**
 * The readings: what Claude read on each programme's official page, kept in the
 * facts database and shown to the paid report. The comparison with the answers
 * here runs in the browser; only the optional step «include my answers» sends
 * the answers, and only after the person has agreed.
 */

/** How many of the best programmes by the reading the optional step compares with the answers. */
export const PERSONAL_POOL = 20

export type ReadingsStatus = 'off' | 'loading' | 'done' | 'failed'
/** Where the optional step stands for one programme. */
export type PersonalStatus = 'off' | 'loading' | 'failed' | 'missing' | 'rated' | 'outside'

interface Reading {
  items: ProgrammeFacts[]
  updated: string
}

const cache = new Map<string, Promise<Reading | null>>()

/** One request per locale and visit; a failed request is not kept, so the next try asks again. */
function loadReadings(locale: string, token: string | null): Promise<Reading | null> {
  const key = `${FACTS_COUNTRIES.join(',')}|${locale}`
  const hit = cache.get(key)
  if (hit) return hit
  const request = fetch(withBase(`/api/facts?countries=${FACTS_COUNTRIES.join(',')}&locale=${encodeURIComponent(locale)}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(async (res) => (res.ok ? ((await res.json()) as Reading) : null))
    .catch(() => null)
  cache.set(key, request)
  request.then((r) => {
    if (!r) cache.delete(key)
  })
  return request
}

export function useReadings(token: string | null, enabled: boolean) {
  const { locale } = useSite()
  const [got, setGot] = useState<{ locale: string; reading: Reading | null } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadReadings(locale, token).then((reading) => {
      if (alive) setGot({ locale, reading })
    })
    return () => {
      alive = false
    }
  }, [enabled, locale, token])
  const current = enabled && got?.locale === locale ? got : null
  const byId = useMemo(() => new Map((current?.reading?.items ?? []).map((f) => [f.id, f])), [current])
  const status: ReadingsStatus = !enabled ? 'off' : !current ? 'loading' : current.reading ? 'done' : 'failed'
  return { status, byId, updated: current?.reading?.updated ?? '' }
}

/** The order the lists use: the reading's score counts 80 %, the match from the questionnaire 20 %. */
export const combinedScore = (match: number, score?: number) => (score === undefined ? match : Math.round(0.8 * score + 0.2 * match))
export const dotsFor = (n: number) => (n >= 80 ? 5 : n >= 60 ? 4 : n >= 40 ? 3 : n >= 20 ? 2 : 1)

const reasonKey = (r: FitReason) => (r.kind === 'riasec' ? `i-${r.types.join('')}` : `s-${r.subjects.join('')}`)

/** A reason in the page's language: the interest types or the subjects it names. */
function fitReasonText(r: FitReason, locale: Parameters<typeof riasecLabel>[1], a: { reasonRiasec: (names: string) => string; reasonSubjects: (names: string) => string }): string {
  if (r.kind === 'riasec') return a.reasonRiasec(r.types.map((k) => riasecLabel(k, locale).name).join(' · '))
  return a.reasonSubjects(r.subjects.map((s) => subjectLabel(s as SubjectKey, locale)).join(' · '))
}

/** Under a programme's details: what Claude read, how it fits the answers here, and, when the optional step is on, Claude's own comparison. */
export function AiBlock({ fact, fit, personal, personalStatus }: { fact: ProgrammeFacts; fit?: LocalFit; personal?: PersonalFit; personalStatus: PersonalStatus }) {
  const { t, locale } = useSite()
  const a = t.programmes.ai
  const reasons = fit?.reasons ?? []
  const personalShown = personalStatus === 'rated' && !!personal && !personal.thin
  return (
    <div className="space-y-3 text-sm">
      {reasons.length ? (
        <ul className="list-disc space-y-1 pl-5">
          {reasons.map((r) => <li key={reasonKey(r)}>{fitReasonText(r, locale, a)}</li>)}
        </ul>
      ) : !personalShown ? (
        <p className="text-muted">{a.noReason}</p>
      ) : null}
      {personalShown && personal && (
        <div className="rounded-xl bg-accent-soft px-3 py-2">
          <p className="font-bold">{a.own.reasonsTitle}: {a.fit(personal.fit)}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {personal.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}
      {personalStatus === 'loading' && <p className="animate-pulse text-muted">{a.own.loading}</p>}
      {(personalStatus === 'failed' || personalStatus === 'missing') && <p className="text-muted">{a.own.failed}</p>}
      {personalStatus === 'outside' && <p className="text-muted">{a.own.notRated}</p>}
      {fact.check && (
        <p>
          <span className="font-bold">{a.check}</span> {fact.check}
        </p>
      )}
      {(!fact.enough || (personalStatus === 'rated' && personal?.thin)) && <p className="text-muted">{a.thin}</p>}
      <p className="text-xs text-muted">{a.note}</p>
    </div>
  )
}

export function BudgetNote() {
  const { t } = useSite()
  return (
    <>
      {t.programmes.ai.budget}{' '}
      <a href={`mailto:${CONTACT}?subject=${encodeURIComponent(t.programmes.ai.budgetSubject)}`} className="font-semibold text-accent underline">
        {CONTACT}
      </a>
    </>
  )
}

const OWN_STORE = 'wsis:own-data:v1'

/** Whether the person agreed before in this browser; nothing else about the agreement is kept. */
function agreedBefore(): boolean {
  try {
    return window.localStorage.getItem(OWN_STORE) === '1'
  } catch {
    return false
  }
}

function rememberAgreement(on: boolean) {
  try {
    if (on) window.localStorage.setItem(OWN_STORE, '1')
    else window.localStorage.removeItem(OWN_STORE)
  } catch {
    // Not kept: the next time the consent text is shown again.
  }
}

/**
 * The optional step, off unless the person switches it on. The first time, the
 * text says what is sent and to whom; switching it off again withdraws the agreement.
 */
export function OwnDataPanel({ on, status, onChange }: { on: boolean; status: 'loading' | 'failed' | 'budget' | 'ready'; onChange: (on: boolean) => void }) {
  const { t } = useSite()
  const a = t.programmes.ai.own
  const [asking, setAsking] = useState(false)
  if (on) {
    return (
      <div className="card-sm p-4 text-sm">
        <p className={status === 'loading' ? 'animate-pulse text-muted' : 'text-muted'} role="status">
          {status === 'loading' ? a.loading : status === 'failed' ? a.failed : status === 'budget' ? <BudgetNote /> : a.on}
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm mt-3"
          onClick={() => {
            rememberAgreement(false)
            onChange(false)
          }}
        >
          {a.withdraw}
        </button>
      </div>
    )
  }
  if (asking) {
    return (
      <div className="card-sm p-4 text-sm">
        <h3 className="font-display text-lg">{a.consentTitle}</h3>
        <p className="mt-2 text-muted">{a.consentText}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              rememberAgreement(true)
              setAsking(false)
              onChange(true)
            }}
          >
            {a.agree}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsking(false)}>
            {a.notNow}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => (agreedBefore() ? onChange(true) : setAsking(true))}>
        ＋ {a.ask}
      </button>
      <span className="text-muted">{a.askHint}</span>
    </div>
  )
}
