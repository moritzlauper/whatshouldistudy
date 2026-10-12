'use client'

import { useEffect, useMemo, useState } from 'react'
import { CONTACT, withBase } from '@/lib/site.ts'
import { fitReasonText } from '@/lib/engine/fit-reason.ts'
import { FACTS_COUNTRIES, calibrated, fitSpread, localFit, type FitReason, type LocalFit, type LocalProfile, type PersonalFit, type ProgrammeFacts } from '@/lib/engine/programme-fit.ts'
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
  const key = `${FACTS_COUNTRIES.join(',')}|${locale}|${token ?? ''}`
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
  const [got, setGot] = useState<{ locale: string; token: string | null; reading: Reading | null } | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadReadings(locale, token).then((reading) => {
      if (alive) setGot({ locale, token, reading })
    })
    return () => {
      alive = false
    }
  }, [enabled, locale, token])
  const current = enabled && got?.locale === locale && got.token === token ? got : null
  const byId = useMemo(() => new Map((current?.reading?.items ?? []).map((f) => [f.id, f])), [current])
  const status: ReadingsStatus = !enabled ? 'off' : !current ? 'loading' : current.reading ? 'done' : 'failed'
  return { status, byId, updated: current?.reading?.updated ?? '' }
}

/** Field order comes first; within a field, the profile counts 80 % and the reading 20 %. */
export { combinedScore } from '@/lib/engine/programme-fit.ts'
export const dotsFor = (n: number) => (n >= 80 ? 5 : n >= 60 ? 4 : n >= 40 ? 3 : n >= 20 ? 2 : 1)

/**
 * Each programme's fit with the person, from the readings in this browser, placed against every reading the country has:
 * 50 is the average programme and 65 one spread above it. A high number is then a clear fit, not a generic overlap.
 */
export function useFitScores(byId: Map<string, ProgrammeFacts>, profile: LocalProfile | null) {
  return useMemo(() => {
    const fits = new Map<string, LocalFit>()
    if (profile) for (const f of byId.values()) fits.set(f.id, localFit(f, profile))
    const spread = fitSpread([...byId.values()].filter((f) => f.enough).map((f) => fits.get(f.id)?.score ?? 50))
    const scoreOf = (id: string): number | undefined => {
      const f = byId.get(id)
      const fit = fits.get(id)
      return f?.enough && fit ? calibrated(fit.score, spread) : undefined
    }
    const hasScores = !!profile && [...byId.values()].some((f) => f.enough)
    return { fits, scoreOf, hasScores }
  }, [byId, profile])
}

const reasonKey = (r: FitReason) =>
  r.kind === 'riasec' ? `i-${r.types.join('')}` : r.kind === 'topics' ? `t-${r.keys.join('')}` : r.kind === 'specialisations' ? `v-${r.names.join('')}` : `s-${r.subjects.join('')}`

/** Under a programme's details: what Claude read, how it fits the answers here, and, when the optional step is on, Claude's own comparison. */
export function AiBlock({ fact, fit, personal, personalStatus, fieldReason }: { fact: ProgrammeFacts; fit?: LocalFit; personal?: PersonalFit; personalStatus: PersonalStatus; fieldReason?: string }) {
  const { t, locale } = useSite()
  const a = t.programmes.ai
  const reasons = fit?.reasons ?? []
  const personalShown = personalStatus === 'rated' && !!personal && !personal.thin && personal.reasons.length > 0
  const specific = reasons.some((r) => r.kind === 'topics' || r.kind === 'specialisations')
  return (
    <div className="space-y-3 text-sm">
      {fieldReason && <p className="font-semibold">{fieldReason}</p>}
      {!personalShown && reasons.length ? (
        <ul className="list-disc space-y-1 pl-5">
          {reasons.map((r) => <li key={reasonKey(r)}>{fitReasonText(r, locale, a)}</li>)}
        </ul>
      ) : !personalShown ? (
        <p className="text-muted">{a.noReason}</p>
      ) : null}
      {personalShown && personal && (
        <div className="rounded-xl bg-accent-soft px-3 py-2">
          <p className="font-bold">{a.own.reasonsTitle}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {personal.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}
      {!specific && reasons.length > 0 && <p className="text-muted">{a.generalOnly}</p>}
      {personalStatus === 'loading' && <p className="animate-pulse text-muted">{a.own.loading}</p>}
      {(personalStatus === 'failed' || personalStatus === 'missing') && <p className="text-muted">{a.own.failed}</p>}
      {personalStatus === 'outside' && <p className="text-muted">{a.own.notRated}</p>}
      {fact.specialisations?.length ? (
        <div>
          <p className="font-bold">{a.specialisationsTitle}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {fact.specialisations.map((s) => <li key={s.name}>{s.name}</li>)}
          </ul>
        </div>
      ) : null}
      {fact.distinctive?.length ? (
        <div>
          <p className="font-bold">{a.distinctiveTitle}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {fact.distinctive.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </div>
      ) : null}
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

// v2: the consent names the topics and Claude as the recipient, so agreements to the earlier text are asked again.
const OWN_STORE = 'wsis:own-data:v2'

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
/** Where the optional step stands: waiting, failed, a limit that answered, or ready. */
export type OwnStatus = 'loading' | 'failed' | 'budget' | 'daily' | 'ready'

export function OwnDataPanel({ on, status, onChange, search = false, hint, disabled = false }: { on: boolean; status: OwnStatus; onChange: (on: boolean) => void; search?: boolean; hint?: string; disabled?: boolean }) {
  const { t } = useSite()
  const a = t.programmes.ai.own
  // Separate controls for the top list and for the current search.
  const label = search ? { ask: a.askSearch, hint: a.askSearchHint, withdraw: a.withdrawSearch } : { ask: a.ask, hint: a.askHint, withdraw: a.withdraw }
  const [asking, setAsking] = useState(false)
  if (on) {
    return (
      <div className="card-sm p-4 text-sm">
        <p className={status === 'loading' ? 'animate-pulse text-muted' : 'text-muted'} role="status">
          {status === 'loading' ? a.loading : status === 'failed' ? a.failed : status === 'budget' ? <BudgetNote /> : status === 'daily' ? a.daily : a.on}
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-sm mt-3 max-w-full justify-start whitespace-normal text-left leading-snug"
          onClick={() => {
            rememberAgreement(false)
            onChange(false)
          }}
        >
          {label.withdraw}
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
            disabled={disabled}
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
    <div className="flex flex-col items-start gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <button type="button" disabled={disabled} className="btn btn-ghost btn-sm max-w-full justify-start whitespace-normal text-left leading-snug" onClick={() => (agreedBefore() ? onChange(true) : setAsking(true))}>
        ＋ {label.ask}
      </button>
      <span className="text-muted">{hint ?? label.hint}</span>
    </div>
  )
}
