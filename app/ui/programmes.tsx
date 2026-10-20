'use client'

import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getState, loadCompareRows, studentId, unlockToken, update, useAppState } from '@/lib/store.ts'
import { orgsText } from '@/lib/site/orgs-text.ts'
import { reportOfferText } from '@/lib/site/report-offer.ts'
import { SALES_PAUSED, isLocal } from '@/lib/site/config.ts'
import type { FieldMatch, Preferences, Results } from '@/lib/engine/types.ts'
import { normalize } from '@/lib/engine/text.ts'
import { topicWeights } from '@/lib/engine/topics.ts'
import { profileKeyOf, type ProgrammeChange } from '@/lib/engine/programme-changes.ts'
import type { UserTopic } from '@/lib/engine/topics.ts'
import { reasonText } from '@/lib/site/explain.ts'
import { Contributions } from './contributions.tsx'
import { COUNTRIES, flag } from '@/lib/countries.ts'
import type { Level, ResearchInstitution } from '@/lib/programmes.ts'
import type { RankResult, RankedProgramme } from '@/lib/server/rank.ts'
import { catalogueText } from '@/lib/site/catalogue-text.ts'
import { TYPE_LABEL, TYPE_STYLE, admissionText, typeLabel, typeShort } from '@/lib/institutions.ts'
import type { InstType } from '@/lib/institutions.ts'
import { CONTACT, withBase } from '@/lib/site.ts'
import { formatPrice, priceForSite } from '@/lib/pricing.ts'
import { countryLabel, emoji, fieldName, fmtMoney, fmtNumber, levelLabel, riasecLabel, subjectLabel, valueLabel } from '@/lib/site/labels.ts'
import { FACTS_COUNTRIES, PERSONAL_REQUEST, shownScore, orderByNumber, orderedFieldIds, programmeFieldMatch, type LocalFit, type LocalProfile, type PersonalFit, type ProgrammeFacts } from '@/lib/engine/programme-fit.ts'
import { AiBlock, OwnDataPanel, PERSONAL_POOL, useFitScores, useReadings, type OwnStatus, type PersonalStatus } from './readings.tsx'
import { officialPageOf } from '@/lib/official-pages.ts'
import type { SubjectKey, ValueKey } from '@/lib/taxonomy/fields.ts'
import { Price, useConfig } from './price.tsx'
import type { Config } from './price.tsx'
import { useSite } from './site-context.tsx'
import { Burst } from './shapes.tsx'
import { PayWithTwint } from './twint.tsx'
import { measureCheckout } from '@/lib/measure.ts'
import { paywallParticipant } from '@/lib/paywall-experiment-client.ts'

interface Teaser {
  total: number
  facets: RankResult['facets']
  sample: boolean
  updated?: string
}

/** «in der Schweiz», «in den USA»: German needs the article. */
const DE_DATIVE: Record<string, string> = {
  CH: 'der Schweiz',
  US: 'den USA',
  NL: 'den Niederlanden',
  TR: 'der Türkei',
  SK: 'der Slowakei',
  AE: 'den Vereinigten Arabischen Emiraten',
  PH: 'den Philippinen',
}


/** The fields we look up programmes for: your top six, with their scores. */
export function requestFields(results: Results) {
  return results.fields.slice(0, 6).map((f) => ({ id: f.id, score: f.score }))
}

/**
 * Readings are enabled for countries with supported programme sources.
 * Individual programmes can still lack a reading. Otherwise the lists stay in the order of the questionnaire.
 */
export const hasReadings = (prefs: Preferences) => prefs.countries.length > 0 && prefs.countries.every((c) => (FACTS_COUNTRIES as readonly string[]).includes(c))

/** Results per page of the list. The server pages the other sorts by the same size. */
const PAGE_SIZE = 10

/** The limit that answered the comparison, if one did. */
export const limitOf = (e: Error): 'budget' | 'daily' | undefined => (e.message === 'budget' || e.message === 'daily' ? e.message : undefined)

/**
 * Every programme the request asks for, in the server's order. The server answers at most 2000 at a time;
 * 'locked' when it refuses the token.
 */
export async function allProgrammes(request: object, token: string | null, signal?: AbortSignal): Promise<RankResult | 'locked'> {
  const items: RankedProgramme[] = []
  let first: RankResult | null = null
  for (let page = 0; ; page++) {
    const res = await fetch(withBase('/api/programmes'), {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...request, page, pageSize: 2000 }),
    })
    if (res.status === 401) return 'locked'
    if (!res.ok) throw new Error('Programme lookup failed')
    const data = (await res.json()) as RankResult
    if (!first) first = data
    items.push(...data.items)
    if (!data.items.length || items.length >= data.total) break
  }
  return { ...(first as RankResult), items }
}

/**
 * The optional step's comparison. Both lists ask for the same programmes, so the answer is shared
 * between them; a failed ask is not kept, so the next one asks again.
 */
const personalAsks = new Map<string, Promise<PersonalFit[]>>()
/** The ratings this session has received, per profile: a programme keeps its rating when the list is filtered again. */
const ratings = new Map<string, Map<string, PersonalFit>>()

/**
 * The comparison of a list. A list may hold more programmes than one request carries, so they go in
 * requests of PERSONAL_REQUEST each, asked together. A limit answer fails the comparison; a request
 * that fails otherwise is left out, and the others still count.
 */
export function askPersonal(programmes: RankedProgramme[], profile: LocalProfile, locale: string, token: string | null, computed: (p: RankedProgramme) => number, fresh = false): Promise<PersonalFit[]> {
  const profileKey = JSON.stringify([token ?? '', locale, profile.riasec, Object.entries(profile.enjoy).filter(([, v]) => (v ?? 0) >= 4).map(([k]) => k), profile.topics ?? {}])
  const known = ratings.get(profileKey) ?? new Map<string, PersonalFit>()
  ratings.set(profileKey, known)
  // A rating given before is kept, so a programme keeps its number when the list is filtered; a repeat asks again.
  if (fresh) for (const p of programmes) known.delete(p.id)
  const missing = programmes.filter((p) => !known.has(p.id))
  const chunks = Array.from({ length: Math.ceil(missing.length / PERSONAL_REQUEST) }, (_, i) => missing.slice(i * PERSONAL_REQUEST, (i + 1) * PERSONAL_REQUEST))
  return Promise.allSettled(chunks.map((chunk) => askRequest(chunk, profile, locale, token, computed, fresh))).then((settled) => {
    const limit = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected' && !!limitOf(s.reason))
    if (limit) throw limit.reason
    const answers = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
    for (const f of answers) known.set(f.id, f)
    const failure = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected')
    const rated = programmes.filter((p) => known.has(p.id)).map((p) => known.get(p.id)!)
    if (!rated.length && failure) throw failure.reason
    return rated
  })
}

/** One request, at most PERSONAL_REQUEST programmes. */
function askRequest(programmes: RankedProgramme[], profile: LocalProfile, locale: string, token: string | null, computed: (p: RankedProgramme) => number, fresh = false): Promise<PersonalFit[]> {
  const body = JSON.stringify({
    consent: true,
    programmes: programmes.map((p) => ({ id: p.id, field: p.matchedField, country: p.country, computed: Math.round(computed(p)) })),
    profile: { riasec: profile.riasec, subjects: Object.entries(profile.enjoy).filter(([, v]) => (v ?? 0) >= 4).map(([k]) => k), topics: profile.topics ?? {} },
    locale,
  })
  const key = `${token ?? ''}|${body}`
  // A repeated comparison asks again; the same list and profile would otherwise return the earlier answer.
  if (fresh) personalAsks.delete(key)
  const hit = personalAsks.get(key)
  if (hit) return hit
  const ask = fetch(withBase('/api/personal-fit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
  }).then(async (res) => {
    if (res.status === 429) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error === 'daily' ? 'daily' : 'budget')
    if (!res.ok) throw new Error(String(res.status))
    return ((await res.json()) as { fits: PersonalFit[] }).fits
  })
  personalAsks.set(key, ask)
  ask.catch(() => personalAsks.delete(key))
  return ask
}

/** A click authorises this list and profile only; changed filters require another click. */
export function usePersonalComparison(programmes: RankedProgramme[], profile: LocalProfile | null, locale: string, token: string | null, context: string, computed: (p: RankedProgramme) => number = (p) => p.match) {
  const key = JSON.stringify([context, programmes.map((p) => p.id), locale, profile, token])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const attempt = useRef(0)
  useEffect(() => () => { attempt.current++ }, [])
  const [reply, setReply] = useState<{ key: string; map: Map<string, PersonalFit> | null; limit?: 'budget' | 'daily' } | null>(null)
  const on = activeKey === key
  useEffect(() => {
    if (activeKey && !on) {
      attempt.current++
      setActiveKey(null)
      setReply(null)
    }
  }, [activeKey, on])
  const current = on && reply?.key === key ? reply : null
  const status: OwnStatus = !on ? 'ready' : !current ? 'loading' : current.limit ?? (current.map ? 'ready' : 'failed')
  const statusOf = (id: string): PersonalStatus => {
    if (!on) return 'off'
    if (!current) return 'loading'
    if (!current.map) return 'failed'
    if (current.map.has(id)) return 'rated'
    return programmes.some((p) => p.id === id) ? 'missing' : 'outside'
  }
  const onChange = (enabled: boolean) => {
    const run = ++attempt.current
    setReply(null)
    if (!enabled || !programmes.length || !profile) {
      setActiveKey(null)
      return
    }
    setActiveKey(key)
    // Sending is an explicit button action, never an effect of opening or changing a list.
    askPersonal(programmes, profile, locale, token, computed)
      .then((list) => {
        if (attempt.current === run) setReply({ key, map: list.length ? new Map(list.map((f) => [f.id, f])) : null })
      })
      .catch((e: Error) => {
        if (attempt.current === run) setReply({ key, map: null, limit: limitOf(e) })
      })
  }
  return { on, status, statusOf, onChange, map: current?.map ?? null }
}

/**
 * The comparison made after the content analysis, while the request it was made for is unchanged.
 * Lists use it instead of asking again: the same numbers, the same order and the same reasons.
 */
/** The comparison's rows: kept beside the stored state, or those of an older version that kept them there. */
export function useCompareRows(): ProgrammeChange[] | null {
  const compare = useAppState().contentAnalysis?.compare
  const at = compare?.status === 'done' ? compare.at : null
  const inState = compare?.status === 'done' ? (compare.rows ?? null) : null
  const [loaded, setLoaded] = useState<{ at: string; rows: ProgrammeChange[] } | null>(null)
  useEffect(() => {
    if (!at || inState) return
    let current = true
    void loadCompareRows(getState(), at).then((rows) => { if (current && rows) setLoaded({ at, rows }) })
    return () => { current = false }
  }, [at, inState])
  if (inState) return inState
  return at && loaded?.at === at ? loaded.rows : null
}

export function useAnalysisFits(): { fits: Map<string, PersonalFit>; rank: Map<string, number> } | null {
  const state = useAppState()
  const compare = state.contentAnalysis
  const key = profileKeyOf(state)
  const rows = useCompareRows()
  return useMemo(() => {
    const stored = compare?.compare
    const done = compare?.enabled && stored?.status === 'done' ? stored : null
    if (!done || done.key !== key || !rows) return null
    const fits = new Map<string, PersonalFit>()
    const rank = new Map<string, number>()
    for (const row of rows) {
      rank.set(row.id, row.after.rank)
      if (row.after.reasons.length) fits.set(row.id, { id: row.id, fit: row.after.fit ?? 3, score: row.after.score, reasons: row.after.reasons, thin: false })
    }
    return fits.size ? { fits, rank } : null
  }, [compare, key, rows])
}

/** The ratings a list shows: the stored comparison's where it covers a programme, otherwise this list's own comparison. */
function listRatings(own: Map<string, PersonalFit> | null, stored: Map<string, PersonalFit> | undefined): Map<string, PersonalFit> | null {
  if (!stored) return own
  return own ? new Map([...own, ...stored]) : stored
}

/** The programmes the stored comparison does not cover: this list asks the AI about those only. */
function notCovered<T extends { id: string }>(items: T[], analysis: { rank: Map<string, number> } | null): T[] {
  return analysis ? items.filter((p) => !analysis.rank.has(p.id)) : items
}

/** Where a programme's rating comes from: the stored comparison for the programmes it covers, otherwise this list's own comparison. */
function ratingStatus(id: string, analysis: { fits: Map<string, PersonalFit>; rank: Map<string, number> } | null, own: (id: string) => PersonalStatus): PersonalStatus {
  if (analysis?.rank.has(id)) return analysis.fits.has(id) ? 'rated' : 'off'
  return own(id)
}

/** Programmes the comparison ranked come first, in its order; the others keep the order they had. */
function withAnalysisOrder<T extends { id: string }>(items: T[], rank?: Map<string, number>): T[] {
  if (!rank) return items
  return [...items].sort((a, b) => {
    const ra = rank.get(a.id)
    const rb = rank.get(b.id)
    return ra === undefined ? (rb === undefined ? 0 : 1) : rb === undefined ? -1 : ra - rb
  })
}

/**
 * The top programmes. Every programme with a reading is ranked, not only the best
 * matches of the questionnaire, so a good fit is not left out for lack of a place.
 */
export function TopProgrammes({ results, prefs, topics = [], token, unlocked, shared = false }: {
  results: Results; prefs: Preferences; topics?: UserTopic[]; token: string | null; unlocked: boolean; shared?: boolean
}) {
  const { t, r, locale } = useSite()
  const [reply, setReply] = useState<{ key: string; data: RankResult | null; error?: boolean; locked?: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [shown, setShown] = useState(5)
  const weights = useMemo(() => (topics.length ? topicWeights(topics) : undefined), [topics])
  const topicMap = useMemo(() => new Map(topics.map((x) => [x.key, x])), [topics])
  // Not on a shared link (its profile is someone else's).
  const readings = useReadings(token, unlocked && !shared && hasReadings(prefs))
  const profile = useLocalProfile(results, weights)
  // Load every match: a reading can identify the strongest programme within a preferred field, even on a later page.
  const request = useMemo(() => ({ fields: requestFields(results), prefs, topics: weights, sort: 'match' as const }), [results, prefs, weights])
  const fieldOrder = useMemo(() => orderedFieldIds(request.fields), [request])
  const body = JSON.stringify(request)
  const key = JSON.stringify([body, token, unlocked, attempt])
  // The list waits for the readings, so that it is asked for once, with them.
  const ready = readings.status !== 'loading'
  useEffect(() => {
    if (!unlocked || !ready) return
    const controller = new AbortController()
    allProgrammes(request, token, controller.signal).then((data) => {
      if (!controller.signal.aborted) setReply(data === 'locked' ? { key, data: null, locked: true } : { key, data })
    }).catch(() => {
      if (!controller.signal.aborted) setReply({ key, data: null, error: true })
    })
    return () => controller.abort()
  }, [request, key, token, unlocked, ready])
  const current = reply?.key === key ? reply : null
  const locked = !unlocked || current?.locked
  const pool = current?.data?.items ?? []
  const { fits: local, scoreOf, hasScores } = useFitScores(readings.byId, profile)
  // The number without the AI's comparison: the profile with the reading's 20 %.
  const computedOf = (p: RankedProgramme) => shownScore(p.match, scoreOf(p.id), hasScores)
  // Missing readings still allow catalogue-based explanations. Twenty is a maximum, not a minimum.
  const personalPool = useMemo(() => orderByNumber(pool, computedOf, fieldOrder).slice(0, PERSONAL_POOL), [pool, scoreOf, hasScores, fieldOrder])
  // After the content analysis its comparison covers these programmes: they keep its numbers and reasons and are not asked again.
  const analysis = useAnalysisFits()
  const asked = useMemo(() => notCovered(personalPool, analysis), [personalPool, analysis])
  const askedIds = useMemo(() => new Set(asked.map((p) => p.id)), [asked])
  const personal = usePersonalComparison(asked, profile, locale, token, JSON.stringify([body, unlocked, shared]), computedOf)
  const personalMap = useMemo(() => listRatings(personal.map, analysis?.fits), [personal.map, analysis])
  // The one number of each programme, best first; the preferred field only breaks a tie.
  const ranked = useMemo(() => {
    const shownOf = (p: RankedProgramme) => shownScore(p.match, scoreOf(p.id), hasScores, personalMap?.get(p.id))
    return withAnalysisOrder(orderByNumber(pool, shownOf, fieldOrder), analysis?.rank).map((p) => ({ p, score: shownOf(p), personal: personalMap?.get(p.id) }))
  }, [pool, scoreOf, personalMap, hasScores, fieldOrder, analysis])
  const best = ranked.slice(0, shown)
  // Each press shows the next step, up to the top 60; there is no button after that.
  const more = [10, 20, 40, 60].find((n) => n > shown)
  return (
    <section className="mt-8" aria-label={t.programmes.topTitle}>
      <h2 className="mb-4 font-display text-3xl">{t.programmes.topTitle.replace('5', String(Math.min(shown, Math.max(5, ranked.length))))}</h2>
      {locked ? (
        <div className="card bg-accent-soft p-6 sm:p-8">
          <div className="text-3xl" aria-hidden="true">🔒</div>
          <p className="mt-3 max-w-2xl text-muted">{t.programmes.topLocked}</p>
          {shared ? <Link href={r.start} className="btn btn-primary mt-5">{t.share.own}</Link>
            : <a href={`#${r.anchors.unlock}`} className="btn btn-primary mt-5">{t.results.lockedCta}</a>}
        </div>
      ) : best.length > 0 ? (
        <ResultsContext.Provider value={results}><TopicsContext.Provider value={topicMap}>
          {current?.data?.sample && <p className="mb-3 text-sm text-muted">{t.programmes.demo}</p>}
          {!shared && profile && personalPool.length > 0 && (
            <div className="mb-4">
              {analysis && !personal.on && !best.some((x) => askedIds.has(x.p.id)) ? <p className="text-sm text-muted">{t.contentAi.afterAnalysis}</p> : <OwnDataPanel count={asked.length} on={personal.on} status={personal.status} onChange={personal.onChange} />}
            </div>
          )}
          <ol className="grid gap-4">
            {best.map((x, i) => (
              <li key={x.p.id}>
                <ProgrammeRow p={x.p} rank={i + 1} fact={readings.byId.get(x.p.id)} fit={local.get(x.p.id)} score={x.score} personal={x.personal} personalStatus={ratingStatus(x.p.id, analysis, personal.statusOf)} />
              </li>
            ))}
          </ol>
          {more && ranked.length > shown && (
            <button type="button" onClick={() => setShown(more)} className="btn btn-ghost btn-sm mt-3">
              ▾ {t.programmes.ai.showTop(more)}
            </button>
          )}
          <p className="mt-2 text-sm text-muted">{t.programmes.topNote}</p>
        </TopicsContext.Provider></ResultsContext.Provider>
      ) : <div className="card p-6 text-muted" role="status">
        {current?.error ? <>{t.programmes.topError} <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAttempt((n) => n + 1)}>{t.programmes.topRetry}</button></>
          : current?.data ? t.programmes.topEmpty : t.programmes.loading}
      </div>}
    </section>
  )
}

export function Programmes({ results, prefs, topics = [], hideFirst = true, shared = false }: { results: Results; prefs: Preferences; topics?: UserTopic[]; hideFirst?: boolean; shared?: boolean }) {
  const { t, r, site, locale, intl } = useSite()
  const [token, setToken] = useState<string | null>(null)
  const [teaserReply, setTeaserReply] = useState<{ key: string; data: Teaser } | null>(null)
  const config = useConfig(site)
  const fields = useMemo(() => requestFields(results), [results])
  const weights = useMemo(() => (topics.length ? topicWeights(topics) : undefined), [topics])
  const topicMap = useMemo(() => new Map(topics.map((x) => [x.key, x])), [topics])

  useEffect(() => setToken(unlockToken()), [])

  const teaserKey = JSON.stringify({ fields, prefs, topics: weights })
  const teaser = teaserReply?.key === teaserKey ? teaserReply.data : null
  useEffect(() => {
    const controller = new AbortController()
    fetch(withBase('/api/teaser'), { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: teaserKey })
      .then((res) => res.json())
      .then((data: Teaser) => { if (!controller.signal.aborted) setTeaserReply({ key: teaserKey, data }) })
      .catch(() => {})
    return () => controller.abort()
  }, [teaserKey])

  const noDataCountries = prefs.countries.filter((c) => !COUNTRIES[c]?.programmeData)
  const where = prefs.countries.length
    ? prefs.countries.length > 4
      ? t.programmes.inCountries(prefs.countries.length)
      : t.programmes.inList(prefs.countries.map((c) => (locale.startsWith('de-') ? (DE_DATIVE[c] ?? countryLabel(c, intl)) : countryLabel(c, intl))))
    : t.programmes.anywhere

  return (
    <ResultsContext.Provider value={results}>
     <TopicsContext.Provider value={topicMap}>
      <section id={r.anchors.programmes} className="mt-20 scroll-mt-24">
        <h2 className="font-display text-4xl sm:text-5xl">{t.programmes.title}</h2>
        <p className="mt-3 max-w-2xl text-muted">
          {t.programmes.sub(where, t.programmes.levelText[prefs.level])}{' '}
          <Link href={`${r.start}#${r.anchors.prefs}`} className="font-bold text-accent underline-offset-2 hover:underline">
            {t.programmes.change}
          </Link>
        </p>
        {teaser?.sample && <p className="on-color mt-5 rounded-2xl border-2 border-line bg-yellow px-4 py-3 text-sm font-semibold">⚠ {t.programmes.demo}</p>}

        {token || config?.payments === 'off' ? (
          <Explorer token={token} fields={fields} prefs={prefs} topics={weights} onInvalid={() => setToken(null)} shared={shared} />
        ) : (
          <Locked teaser={teaser} config={config} hideFirst={hideFirst} onUnlocked={setToken} />
        )}

        {noDataCountries.length > 0 && <Research token={token} fields={fields.map((f) => f.id)} countries={noDataCountries} />}
      </section>
     </TopicsContext.Provider>
    </ResultsContext.Provider>
  )
}

function Locked({ teaser, config, hideFirst, onUnlocked }: { teaser: Teaser | null; config: Config | null; hideFirst: boolean; onUnlocked: (token: string) => void }) {
  const { t, r, site, base, locale, intl } = useSite()
  const offer = reportOfferText(locale)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { org } = useAppState()
  const os = orgsText(locale).student
  const [orgError, setOrgError] = useState('')

  /** Through a school's link: counts one report of its plan instead of a payment. */
  async function unlockViaOrg() {
    setBusy(true)
    setOrgError('')
    try {
      const res = await fetch(withBase('/api/org/redeem'), { method: 'POST', body: JSON.stringify({ org, student: studentId() }) })
      const j = (await res.json()) as { token?: string; expiresAt?: number; error?: string }
      if (!j.token || !j.expiresAt) throw new Error(j.error === 'limit' ? os.limit : j.error === 'inactive' || j.error === 'invalid' ? os.inactive : os.failed)
      update((s) => ({ ...s, unlock: { token: j.token!, expiresAt: j.expiresAt! } }))
      onUnlocked(j.token)
    } catch (e) {
      setOrgError((e as Error).message)
      setBusy(false)
    }
  }
  const price = formatPrice(config?.price ?? priceForSite(site), intl)

  async function checkout() {
    setBusy(true)
    setError('')
    measureCheckout(config?.price ?? priceForSite(site))
    try {
      const query = new URLSearchParams({ site, back: base, locale, o: window.location.origin })
      const participant = paywallParticipant(site, config?.consent)
      if (participant) query.set('ab', participant)
      const res = await fetch(withBase(`/api/checkout?${query}`), { method: 'POST' })
      const j = (await res.json()) as { url?: string; error?: string }
      if (!j.url) throw new Error(j.error ?? t.programmes.checkoutFailed)
      window.location.assign(j.url)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div>
        {teaser ? (
          <>
            <div className="card p-6 sm:p-7">
              <div className="font-display text-6xl">{fmtNumber(teaser.total, intl)}</div>
              <div className="mt-1 font-semibold text-muted">{t.programmes.matchCount}</div>
              <div className="mt-5 flex flex-wrap gap-2">
                {Object.entries(teaser.facets.countries)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cc, n]) => (
                    <span key={cc} className="chip">
                      {flag(cc)} {countryLabel(cc, intl)} <span className="text-muted">{fmtNumber(n, intl)}</span>
                    </span>
                  ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {hideFirst && <span className="chip-soft">🔒 {t.results.lockedChip}</span>}
                {Object.entries(teaser.facets.fields)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, n]) => (
                    <span key={id} className="chip-soft">
                      {emoji(id)} {fieldName(id, locale)} <span className="text-muted">{fmtNumber(n, intl)}</span>
                    </span>
                  ))}
              </div>
            </div>
            <div className="card mt-5 bg-accent-soft p-6 sm:p-7">
              <h3 className="font-display text-2xl">🔒 {offer.lockedTitle}</h3>
              <p className="mt-2 text-sm text-muted">{offer.lockedText}</p>
              <ul className="mt-5 grid gap-3">
                {offer.labels.map((label) => <li key={label} className="flex items-center justify-between gap-3 rounded-xl border-2 border-line bg-surface px-4 py-3 font-semibold">
                  <span>{label}</span><span aria-hidden="true">🔒</span>
                </li>)}
              </ul>
              <a href={`#${r.anchors.unlock}`} className="btn btn-primary mt-5 max-w-full whitespace-normal text-center">{offer.cta}</a>
            </div>
          </>
        ) : (
          <div className="card animate-soft p-6 font-semibold text-muted">{t.programmes.loading}</div>
        )}
      </div>
      <div id={r.anchors.unlock} className="card relative h-fit scroll-mt-24 bg-accent p-7 text-accent-ink lg:sticky lg:top-24">
        {!SALES_PAUSED[site] && (
          <div className="absolute -top-7 right-0 rotate-12 sm:-right-4">
            <Burst size={108} color="var(--yellow)" />
            <span className="absolute inset-0 flex flex-col items-center justify-center text-center font-display text-base leading-none text-on-color">
              <Price site={site} />
            </span>
          </div>
        )}
        <h3 className="pr-16 font-display text-3xl">{t.programmes.boxTitle}</h3>
        <p className="mt-2 text-sm opacity-85">{t.programmes.boxSub}</p>
        <div className="on-color mt-5 rounded-2xl bg-lime p-4">
          <p className="font-display text-xl">{offer.included}</p>
          <p className="mt-1 text-sm font-semibold">{offer.price(price)}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {offer.features.map((feature) => <li key={feature.title}>✓ {feature.title}</li>)}
          </ul>
        </div>
        <ul className="mt-5 grid gap-2 text-sm font-medium">
          {t.programmes.boxList(teaser ? fmtNumber(teaser.total, intl) : '').map((x) => (
            <li key={x}>★ {x}</li>
          ))}
        </ul>
        {t.reportScope && <p className="mt-5 rounded-xl bg-surface p-4 text-sm font-semibold text-ink">{t.reportScope}</p>}
        {org && config?.payments !== 'off' && !orgError && (
          <>
            <button type="button" disabled={busy || !config} onClick={unlockViaOrg} className="btn btn-lime btn-lg mt-6 w-full">
              {busy ? t.programmes.opening : os.via}
            </button>
            <p className="mt-2 text-center text-xs opacity-85">{os.note}</p>
          </>
        )}
        {orgError && <p className="mt-6 rounded-xl bg-surface p-2 text-sm font-semibold text-ink">{orgError}</p>}
        {SALES_PAUSED[site] && !org ? (
          <p className="mt-6 rounded-xl bg-surface p-3 text-sm font-semibold text-ink">{t.salesPaused}</p>
        ) : config?.payments === 'off' ? (
          <p className="mt-6 text-sm opacity-85">{t.programmes.paymentsOff}</p>
        ) : org && !orgError ? null : (
          <button type="button" disabled={busy || !config} onClick={checkout} className="btn btn-lime btn-lg mt-6 w-full whitespace-normal text-center">
            {busy ? t.programmes.opening : config?.payments === 'free' ? t.programmes.unlockFree : t.programmes.unlock(price)}
          </button>
        )}
        {error && <p className="mt-3 rounded-xl bg-surface p-2 text-sm font-semibold text-bad">{error}</p>}
        {!org && !SALES_PAUSED[site] && <PayWithTwint className="mt-3 justify-center" />}
        {!org && !SALES_PAUSED[site] && config?.payments === 'stripe' && <p className="mt-3 text-center text-sm font-semibold">{t.programmes.boxNote}</p>}
        {config?.payments !== 'off' && !(SALES_PAUSED[site] && !org) && (
          <p className="mt-2 text-center text-xs opacity-80">
            {t.programmes.minors}{' '}
            <Link href={r.terms} className="underline">
              {t.footer.terms}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

/** A URL that is just a homepage, not the programme's own page. */
function isHomepage(url: string): boolean {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === ''
  } catch {
    return true
  }
}

/**
 * The programme's own page. Where the data only knows the institution (Swiss
 * statistics, US Scorecard), DuckDuckGo's «\» search jumps straight to the
 * first result on the institution's site, usually the programme page.
 */
function programmeLink(p: RankedProgramme): string {
  const official = officialPageOf(p)
  if (official) return official
  if (p.url && p.url !== p.institutionUrl && !isHomepage(p.url)) return p.url
  const home = p.institutionUrl ?? p.url
  let site = ''
  try {
    if (home) site = ` site:${new URL(home).hostname.replace(/^www\./, '')}`
  } catch {
    site = ''
  }
  const query = `\\${p.name}${site || ` ${p.institution}`}`
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
}

/** The person's results, so each programme can say why it fits. */
const ResultsContext = createContext<Results | null>(null)
/** The person's topics by key, with counts and examples (these never leave the browser). */
const TopicsContext = createContext<Map<string, UserTopic>>(new Map())

/** Your topics this programme names, with what you looked at. */
function useTopicHits(p: RankedProgramme): UserTopic[] {
  const topics = useContext(TopicsContext)
  const hits = (p.topicHits ?? []).map((k) => topics.get(k)).filter((x): x is UserTopic => !!x)
  // Data from before the server merged nested topics: «ungleichheit» next to «soziale ungleichheit».
  return hits.filter((h) => !hits.some((o) => o !== h && o.word.length > h.word.length && o.word.toLowerCase().includes(h.word.toLowerCase())))
}

/** What in the person's own data points to this programme. */
function fitFor(p: RankedProgramme, results: Results) {
  const rank = results.fields.findIndex((f) => f.id === p.matchedField)
  const m: FieldMatch | undefined = results.fields[rank]
  if (!m) return null
  // Only what the programme says about itself counts: its name and the field's
  // name would make every psychology master «match» the word psychology.
  const about = ` ${normalize([...(p.focus ?? []), p.description ?? ''].join(' '))} `
  const trivial = normalize([p.name, ...p.fields.flatMap((id) => [fieldName(id, 'en'), fieldName(id, 'de-CH')])].join(' '))
  const named = new Set<string>()
  for (const f of results.fields.slice(0, 12)) {
    for (const term of f.terms) {
      const core = normalize(term.replace(/…/g, ''))
      if (core.length < 4 || trivial.includes(core)) continue
      if (term.includes('…') ? about.includes(core) : about.includes(` ${core} `)) named.add(term.replace(/…/g, ''))
    }
  }
  const also = p.fields
    .filter((id) => id !== p.matchedField)
    .map((id) => ({ id, rank: results.fields.findIndex((f) => f.id === id) + 1 }))
    .filter((x) => x.rank > 0 && x.rank <= 12)
  const interest = m.reasons.find((r) => r.k === 'interest') as { items: number; months: number } | undefined
  return { m, rank: rank + 1, named: [...named].slice(0, 6), also, interest }
}

const SOURCE_NAMES: Record<string, string> = {
  'ch-bfs': 'Bundesamt für Statistik (BFS)',
  'de-studiensuche': 'Studiensuche der Hochschulrektorenkonferenz',
  'at-studienwahl': 'studienwahl.at',
  'us-college-scorecard': 'College Scorecard (US Department of Education)',
  'uk-discover-uni': 'Discover Uni',
  'fr-parcoursup': 'Parcoursup',
  'ch-studyprogrammes': 'studyprogrammes.ch (swissuniversities)',
  'au-cricos': 'CRICOS (Australian Government)',
  'fi-opintopolku': 'Opintopolku / Studyinfo.fi',
  'nl-duo': 'DUO (Dienst Uitvoering Onderwijs)',
  'no-dbh': 'DBH (HK-dir)',
}

function ProgrammeDetails({ p, aiBlock }: { p: RankedProgramme; aiBlock?: ReactNode }) {
  const kit = useSite()
  const { t, locale, intl } = kit
  const results = useContext(ResultsContext)
  const fit = results ? fitFor(p, results) : null
  const hits = useTopicHits(p)
  const d = t.programmes.details
  const cd = catalogueText(locale).detail
  const home = p.institutionUrl ?? (p.url && isHomepage(p.url) ? p.url : undefined)
  const hasAbout = !!(p.description || p.focus?.length)
  const field = fieldName(p.matchedField, locale)
  return (
    <div className="mt-4 grid gap-6 border-t-2 border-soft-line pt-4 text-sm">
      {/* 1. What the programme is. */}
      {(hasAbout || !aiBlock) && <div>
        <h5 className="font-display text-lg">{d.about}</h5>
        {hasAbout ? (
          <>
            {p.description && <p className="mt-2 text-muted">{p.description}</p>}
            {p.focus && p.focus.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {p.focus.map((x) => (
                  <li key={x} className={`chip-soft ${(fit?.named ?? []).some((n) => normalize(x).includes(normalize(n))) ? 'ring-2 ring-accent' : ''}`}>
                    {x}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-2 text-muted">{d.noInfo}</p>
        )}
      </div>}

      {/* 1b. In the paid report: what the AI read, weighed against the profile in this browser. */}
      {aiBlock && (
        <div>
          <h5 className="font-display text-lg">{t.programmes.ai.oneTitle}</h5>
          {aiBlock}
        </div>
      )}

      {/* 3. What else in it fits you: only what this programme says about itself. */}
      {fit && (!hits.length || fit.also.length > 0) && (!aiBlock || fit.named.length > 0 || fit.also.length > 0) && (
        <div>
          <h5 className="font-display text-lg">{d.forYou}</h5>
          <ul className="mt-2 grid gap-1.5">
            {!hits.length && fit.named.length > 0 && <li>✓ {d.named(fit.named)}</li>}
            {fit.also.length > 0 && <li>✓ {d.also(fit.also.map((a) => d.alsoRank(fieldName(a.id, locale), a.rank)))}</li>}
            {!hits.length && !fit.named.length && !fit.also.length && <li className="text-muted">{hasAbout ? d.noOverlap(field) : d.onlyField(field)}</li>}
          </ul>
        </div>
      )}

      {/* 4. The field in general. */}
      {fit && (
        <div>
          <h5 className="font-display text-lg">{d.fieldGeneral(field)}</h5>
          <ul className="mt-2 grid gap-1.5">
            <li>✓ {d.rank(fit.rank, field)}</li>
            {fit.interest && <li>✓ {d.items(fmtNumber(fit.interest.items, intl), fit.interest.months)}</li>}
            {fit.m.reasons
              .filter((r) => r.k !== 'interest' && r.k !== 'hidden')
              .map((r) => (
                <li key={r.k}>
                  {r.k === 'subjectsLow' ? '△' : r.k === 'studying' ? 'ℹ' : '✓'} {reasonText(r, kit)}
                </li>
              ))}
          </ul>
          <div className="mt-3">
            <Contributions m={fit.m} />
          </div>
          {fit.m.terms.length > 0 && (
            <p className="mt-3 text-muted">
              {d.topics}: <span className="font-semibold text-ink">{fit.m.terms.slice(0, 8).map((x) => x.replace(/…/g, '')).join(' · ')}</span>
            </p>
          )}
          {fit.m.evidence.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-bold text-muted">{d.seen}</summary>
              <ul className="mt-2 grid gap-1">
                {fit.m.evidence.slice(0, 6).map((e) => (
                  <li key={e.label} className="break-words" title={t.sourceNames[e.source] ?? e.source}>
                    <span className="text-muted">{t.results.kinds[e.kind] ?? e.kind}:</span> {e.label}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div>
        <h5 className="font-display text-lg">{d.facts}</h5>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          <Item k={d.institution} v={p.institution} />
          <Item k={d.place} v={[p.city, p.region, countryLabel(p.country, intl)].filter(Boolean).join(', ')} />
          <Item k={d.fields} v={p.fields.map((id) => `${emoji(id)} ${fieldName(id, locale)}`).join(', ')} />
          <Item k={t.programmes.row.level} v={levelLabel(p.level as Level, locale)} />
          <Item k={cd.title} v={p.degreeTitle} />
          {p.ects ? <Item k={cd.ects} v={`${fmtNumber(p.ects, intl)} ECTS`} /> : null}
          <Item k={cd.department} v={p.department} />
          <Item k={cd.partners} v={p.partners} />
          <Item k={cd.otherLanguages} v={p.otherLanguages?.join(', ')} />
          <Item k={cd.deadline} v={p.closedFrom ? cd.closed(p.closedFrom.term, p.closedFrom.year, p.successor) : p.deadline} />
          <Item k={cd.prior} v={p.priorStudies?.join(', ')} />
          {/* The institution's own fee wording (paid list only). */}
          {p.tuition?.note?.startsWith('Laut Hochschule') && <Item k={t.programmes.row.fee} v={p.tuition.note.replace(/^Laut Hochschule:\s*/, '')} />}
          {p.mode && <Item k={d.mode} v={d.modes[p.mode]} />}
          {p.public !== undefined && <Item k={d.sector} v={p.public ? d.public : d.private} />}
          <Item k={d.source} v={`${SOURCE_NAMES[p.source] ?? p.source}, ${new Date(p.updated).toLocaleDateString(intl, { dateStyle: 'medium' })}`} />
        </dl>
        {p.requirements && (
          <p className="mt-2 text-muted">
            <span className="font-bold text-ink">{cd.requirements}:</span> {p.requirements}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={programmeLink(p)} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
          {d.page} ↗
        </a>
        {home && (
          <a href={home} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            {d.website} ↗
          </a>
        )}
        {p.regulationsUrl && (
          <a href={p.regulationsUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            {cd.regulations} ↗
          </a>
        )}
        <a href={`https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${p.institution}`)}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
          {d.search} ↗
        </a>
      </div>
    </div>
  )
}

/** `fact`: what the AI read about the programme; `fit`: how it matches the answers here; `score`: the list's score; `rank`: its place in the top list. */
function ProgrammeRow({ p, rank, fact, fit, score, personal, personalStatus = 'off' }: {
  p: RankedProgramme; rank?: number; fact?: ProgrammeFacts; fit?: LocalFit; score?: number; personal?: PersonalFit; personalStatus?: PersonalStatus
}) {
  const { t, locale, intl, site } = useSite()
  const [open, setOpen] = useState(false)
  // Switzerland, Germany and Austria talk about fees per semester.
  const perSemester = isLocal(site)
  const feeAmount = p.fee ? (perSemester ? Math.round(p.fee.amount / 2) : p.fee.amount) : 0
  const type = p.institutionType as InstType | undefined
  const lang = locale === 'en' ? 'en' : locale.startsWith('de-') ? 'de' : locale === 'fr-CH' ? 'fr' : 'it'
  const results = useContext(ResultsContext)
  const basis = programmeFieldMatch(p, orderedFieldIds(results?.fields.slice(0, 6) ?? []))
  const displayField = p.fields[0] ?? p.matchedField
  const fieldRank = (results?.fields.findIndex((f) => f.id === displayField) ?? -1) + 1
  const fieldReason = basis ? basis.direct
    ? t.programmes.ai.reasonField(fieldName(basis.id, locale), basis.rank)
    : t.programmes.ai.reasonSecondaryField(fieldName(p.fields[0], locale), fieldName(basis.id, locale)) : undefined
  return (
    <article className="card-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 grow items-start gap-3">
          {rank && <span className="shrink-0 font-display text-xl leading-snug text-accent">{rank}.</span>}
          <div className="min-w-0">
            <h4 className="font-bold leading-snug">
              <a href={programmeLink(p)} target="_blank" rel="noreferrer" className="hover:text-accent" title={t.programmes.row.openPage}>
                {p.name} <span className="text-xs text-muted" aria-hidden="true">↗</span>
              </a>
              {p.isNew && <span className="on-color ml-2 rounded-full border-2 border-line bg-lime px-2 py-0.5 text-xs font-bold">{t.programmes.row.isNew}</span>}
            </h4>
            <div className="mt-0.5 text-sm text-muted">
              {p.institutionUrl ? (
                <a href={p.institutionUrl} target="_blank" rel="noreferrer" className="hover:text-ink">
                  {p.institution}
                </a>
              ) : (
                p.institution
              )}
              {' · '}
              {flag(p.country)} {[p.city, p.region].filter(Boolean).join(', ') || countryLabel(p.country, intl)}
            </div>
            {p.focus && p.focus.length > 0 && (
              <div className="mt-1.5 text-xs">
                <span className="text-muted">{t.programmes.details.focus}: </span>
                <span className="font-semibold">{p.focus.slice(0, 3).join(' · ')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {type && TYPE_LABEL[type] && (
            <span className="on-color rounded-full border-2 border-line px-2.5 py-0.5 text-xs font-bold" style={{ background: TYPE_STYLE[type].color }} title={typeLabel(type, p.country, lang)}>
              {typeShort(type, p.country)}
            </span>
          )}
          {/* The one number of the programme: the AI's comparison where it rated it, otherwise the profile with the reading. */}
          <span className="rounded-full border-2 border-line bg-accent px-2.5 py-0.5 text-sm font-extrabold text-accent-ink" title={t.programmes.row.matchTip}>
            {score ?? p.match}
          </span>
        </div>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <Item k={t.programmes.row.field} v={`${emoji(displayField)} ${fieldName(displayField, locale)}${fieldRank ? ` (${t.programmes.row.fieldRank(fieldRank)})` : ''}`} />
        <Item k={t.programmes.row.level} v={levelLabel(p.level as Level, locale)} />
        {p.durationYears && <Item k={t.programmes.row.duration} v={`${p.durationYears} ${t.programmes.row.yrs}`} />}
        <Item
          k={perSemester ? t.programmes.row.feeSemester : t.programmes.row.fee}
          v={p.fee ? `${feeAmount === 0 ? t.programmes.row.free : fmtMoney(feeAmount, p.fee.currency, intl)}${p.fee.estimated ? t.programmes.row.approx : ''}` : (p.tuition?.note ?? t.programmes.row.seePage)}
        />
        {p.earnings && <Item k={t.programmes.row.earnings(p.earnings.yearsAfter)} v={fmtMoney(p.earnings.median, p.earnings.currency, intl)} />}
        {p.debt && <Item k={t.programmes.row.debt} v={fmtMoney(p.debt.median, p.debt.currency, intl)} />}
        {p.admissionRate !== undefined && <Item k={t.programmes.row.admission} v={`${Math.round(p.admissionRate * 100)} %`} />}
        {p.capacity && <Item k={p.source === 'ch-bfs' ? t.programmes.row.students : t.programmes.row.places} v={fmtNumber(p.capacity, intl)} />}
        {p.languages?.length ? <Item k={t.programmes.row.language} v={p.languages.map((l) => l.toUpperCase()).join(', ')} /> : null}
      </dl>
      {/* Closed to new students: stays in the ranking, with the institution's notice in plain view. */}
      {p.closedFrom && (
        <p className="on-color mt-3 rounded-xl border-2 border-line bg-yellow px-3 py-2 text-sm font-semibold">
          ⚠ {catalogueText(locale).detail.closed(p.closedFrom.term, p.closedFrom.year, p.successor)}
        </p>
      )}
      {p.admission && (
        <p className="mt-2 text-xs text-muted">
          🎟️ {t.programmes.row.entry}: {admissionText(p.country, type, lang) ?? p.admission}
        </p>
      )}
      {rank === 1 && basis?.direct && <p className="mt-3 text-sm font-semibold">{t.programmes.ai.firstReason(fieldName(basis.id, locale), basis.rank)}</p>}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-3 text-sm font-bold text-accent hover:underline">
        {open ? `▴ ${t.programmes.details.close}` : `▾ ${t.programmes.details.open}`}
      </button>
      {open && (
        <ProgrammeDetails
          p={p}
          aiBlock={fact || personalStatus !== 'off' ? <AiBlock fact={fact} fit={fit} personal={personal} personalStatus={personalStatus} fieldReason={fieldReason} /> : undefined}
        />
      )}
    </article>
  )
}

function Item({ k, v }: { k: string; v?: string }) {
  if (!v) return null
  return (
    <div>
      <dt className="inline">{k}: </dt>
      <dd className="inline font-semibold text-ink">{v}</dd>
    </div>
  )
}

function Explorer({
  token,
  fields,
  prefs,
  topics,
  onInvalid,
  shared,
}: {
  token: string | null
  fields: Array<{ id: string; score: number }>
  prefs: Preferences
  topics?: Record<string, number>
  onInvalid: () => void
  shared?: boolean
}) {
  const { t, locale, intl, conf, site } = useSite()
  const [country, setCountry] = useState('')
  const [level, setLevel] = useState<Level | 'any'>('any')
  const [sort, setSort] = useState<'match' | 'cost' | 'earnings' | 'new'>('match')
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [page, setPage] = useState(0)
  const queryKey = JSON.stringify([token, fields, prefs, topics, country, level, sort, q, city, sort === 'match' ? 0 : page])
  const [reply, setReply] = useState<{ key: string; data: RankResult | null } | null>(null)
  const data = reply?.key === queryKey ? reply.data : null
  const results = useContext(ResultsContext)
  const profile = useLocalProfile(results, topics)
  // The readings are shown in the rows; the order is the one the filters ask for.
  const readings = useReadings(token, !shared && hasReadings(prefs))
  const { fits, scoreOf, hasScores } = useFitScores(readings.byId, profile)
  const listSort = sort
  // Search compares its best results (up to PERSONAL_POOL), only after its own button was pressed.
  const computedOf = (p: RankedProgramme) => shownScore(p.match, scoreOf(p.id), hasScores)
  const ownPool = useMemo(() => orderByNumber(data?.items ?? [], computedOf).slice(0, PERSONAL_POOL), [data, scoreOf, hasScores])
  // After the content analysis its comparison covers the programmes it ranked: they keep its numbers and reasons, and only the others are asked.
  const analysis = useAnalysisFits()
  const asked = useMemo(() => notCovered(ownPool, analysis), [ownPool, analysis])
  const askedIds = useMemo(() => new Set(asked.map((p) => p.id)), [asked])
  const personal = usePersonalComparison(asked, profile, locale, token, queryKey, computedOf)
  const ownMap = useMemo(() => listRatings(personal.map, analysis?.fits), [personal.map, analysis])
  // The one number of each programme, as in the top list.
  const shownOf = (p: RankedProgramme) => shownScore(p.match, scoreOf(p.id), hasScores, ownMap?.get(p.id))
  // Fetch every match before sorting by its displayed points, then page the complete order here.
  const byMatch = listSort === 'match'
  const serverPage = byMatch ? 0 : page
  const ordered = useMemo(() => {
    const items = data?.items ?? []
    return byMatch ? withAnalysisOrder(orderByNumber(items, shownOf), analysis?.rank) : items
  }, [data, byMatch, scoreOf, ownMap, hasScores, analysis])
  const pageItems = byMatch ? ordered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : ordered
  const [loading, setLoading] = useState(false)

  const query = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      const base = { fields, prefs, topics, country: country || undefined, level, sort: listSort, q: q || undefined, city: city || undefined }
      if (byMatch) {
        const all = await allProgrammes({ ...base, ...extra }, token)
        if (all === 'locked') {
          onInvalid()
          return null
        }
        return all
      }
      const res = await fetch(withBase('/api/programmes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...base, page: serverPage, pageSize: PAGE_SIZE, ...extra }),
      })
      if (res.status === 401) {
        onInvalid()
        return null
      }
      return (await res.json()) as RankResult
    },
    [token, fields, prefs, topics, country, level, listSort, q, city, byMatch, serverPage, onInvalid],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      query().then((d) => {
        if (!cancelled && d) setReply({ key: queryKey, data: d })
      }).catch(() => {
        if (!cancelled) setReply({ key: queryKey, data: null })
      }).finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, queryKey])

  async function exportCsv() {
    const all = await allProgrammes({ fields, prefs, topics, country: country || undefined, level, sort, q: q || undefined, city: city || undefined }, token)
    if (all === 'locked') { onInvalid(); return }
    const cols = ['match', 'name', 'institution', 'country', 'city', 'level', 'field', 'tuition_per_year', 'currency', 'earnings', 'admission_rate', 'url']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const exportItems = byMatch ? orderByNumber(all.items, shownOf) : all.items
    const rows = exportItems.map((p) =>
      [shownOf(p), p.name, p.institution, p.country, p.city, p.level, fieldName(p.fields[0] ?? p.matchedField, locale), p.fee?.amount, p.fee?.currency, p.earnings?.median, p.admissionRate, p.url ?? p.institutionUrl].map(esc).join(','),
    )
    const blob = new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${conf.name}-programmes.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const pages = byMatch ? Math.ceil(ordered.length / PAGE_SIZE) : data ? Math.ceil(data.total / data.pageSize) : 0
  return (
    <div className="mt-8">
      <div className="card-sm flex flex-wrap items-center gap-2 p-3">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
          placeholder={t.programmes.search}
          className="input min-w-[12rem] flex-1"
        />
        <input
          value={city}
          onChange={(e) => {
            setCity(e.target.value)
            setPage(0)
          }}
          placeholder={t.programmes.cityPlaceholder}
          aria-label={t.programmes.cityPlaceholder}
          className="input w-44 min-w-[9rem]"
        />
        <select value={country} onChange={(e) => (setCountry(e.target.value), setPage(0))} className="input w-auto">
          <option value="">{t.programmes.allCountries}</option>
          {Object.entries(reply?.data?.facets.countries ?? {}).map(([cc, n]) => (
            <option key={cc} value={cc}>
              {countryLabel(cc, intl)} ({n})
            </option>
          ))}
        </select>
        <select value={level} onChange={(e) => (setLevel(e.target.value as Level | 'any'), setPage(0))} className="input w-auto">
          <option value="any">{t.programmes.allLevels}</option>
          {Object.entries(reply?.data?.facets.levels ?? {}).map(([l, n]) => (
            <option key={l} value={l}>
              {levelLabel(l as Level, locale)} ({n})
            </option>
          ))}
        </select>
        <select
          value={listSort}
          onChange={(e) => {
            const next = e.target.value as typeof sort
            setSort(next)
            setPage(0)
          }}
          className="input w-auto"
        >
          {(['match', 'cost', 'earnings', 'new'] as const).filter((s) => s !== 'earnings' || !isLocal(site)).map((s) => (
            <option key={s} value={s}>
              {t.programmes.sort[s]}
            </option>
          ))}
        </select>
        <button type="button" onClick={exportCsv} className="btn btn-ghost btn-sm">
          CSV ⤓
        </button>
      </div>
      {!shared && profile && readings.status !== 'loading' && byMatch && (
        <div className="mt-3">
          {analysis && !personal.on && !pageItems.some((p) => askedIds.has(p.id)) ? <p className="text-sm text-muted">{t.contentAi.afterAnalysis}</p> : <OwnDataPanel search count={asked.length} on={personal.on} status={personal.status} disabled={loading || !asked.length} onChange={(on) => { personal.onChange(on); setPage(0) }} />}
          {ordered.length > 0 && hasScores && (
            <p className="mt-2 text-sm text-muted">
              {t.programmes.ai.listBasis(ordered.filter((p) => scoreOf(p.id) !== undefined).length, ordered.length)}
              {personal.on && ` ${t.programmes.ai.listBasisOn}`}
            </p>
          )}
        </div>
      )}
      <p className="mt-4 text-sm font-semibold text-muted">
        {data ? t.programmes.count(fmtNumber(data.total, intl)) : t.programmes.loading}
        {data?.updated && t.programmes.dataFrom(new Date(data.updated).toLocaleDateString(intl, { dateStyle: 'medium' }))}
        {loading && data && t.programmes.updating}
      </p>
      <div className="mt-3 grid gap-4">
        {pageItems.map((p) => (
          <ProgrammeRow key={p.id} p={p} fact={readings.byId.get(p.id)} fit={fits.get(p.id)} score={shownOf(p)} personal={ownMap?.get(p.id)} personalStatus={ratingStatus(p.id, analysis, personal.statusOf)} />
        ))}
      </div>
      {pages > 1 && (
        <div className="mt-7 flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="btn btn-ghost btn-sm">
            {t.programmes.prev}
          </button>
          <span className="font-bold">
            {page + 1} / {pages}
          </span>
          <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="btn btn-ghost btn-sm">
            {t.programmes.nextPage}
          </button>
        </div>
      )}
    </div>
  )
}


/** The person's side of the comparison: interest profile, the subjects they enjoy, and the topics they gave weight (lexicon keys). */
export function useLocalProfile(given?: Results | null, topics?: Record<string, number>): LocalProfile | null {
  const context = useContext(ResultsContext)
  const results = given ?? context
  const { answers } = useAppState()
  return useMemo(() => {
    if (!results) return null
    const enjoy: Partial<Record<string, number>> = {}
    for (const [k, v] of Object.entries(answers.subjects ?? {})) if (v?.enjoy) enjoy[k] = v.enjoy
    return { riasec: [...results.riasec.profile], enjoy, topics }
  }, [results, answers, topics])
}

interface ResearchResponse {
  paid: boolean
  byCountry: Record<string, { research: Record<string, Array<Partial<ResearchInstitution>>>; directory: number; universities?: Array<{ name: string; url?: string; domain?: string }> }>
}

function Research({ token, fields, countries }: { token: string | null; fields: string[]; countries: string[] }) {
  const { t, locale, intl } = useSite()
  const [data, setData] = useState<ResearchResponse | null>(null)
  useEffect(() => {
    fetch(withBase('/api/research'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ fields, countries }),
    })
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
  }, [token, fields, countries])

  if (!data?.byCountry) return null
  return (
    <div className="mt-16">
      <h3 className="font-display text-3xl">{t.programmes.researchTitle}</h3>
      <p className="mt-2 max-w-3xl text-sm text-muted">{t.programmes.researchSub}</p>
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        {Object.entries(data.byCountry).map(([cc, c]) => (
          <div key={cc} className="card-sm p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="font-display text-xl">
                {flag(cc)} {countryLabel(cc, intl)}
              </h4>
              <span className="text-xs font-semibold text-muted">{t.programmes.universities(c.directory)}</span>
            </div>
            {COUNTRIES[cc]?.typicalTuition && (
              <p className="mt-1 text-xs text-muted">
                {t.programmes.typical}: {COUNTRIES[cc].typicalTuition}
              </p>
            )}
            {Object.keys(c.research).length === 0 && <p className="mt-3 text-sm text-muted">{t.programmes.noResearch}</p>}
            {Object.entries(c.research).map(([fid, list]) => (
              <div key={fid} className="mt-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted">
                  {emoji(fid)} {fieldName(fid, locale)}
                </div>
                {data.paid ? (
                  <ol className="mt-1 grid gap-1 text-sm">
                    {list.slice(0, 6).map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {i.url ? (
                            <a href={i.url} target="_blank" rel="noreferrer" className="hover:text-accent">
                              {i.name}
                            </a>
                          ) : (
                            i.name
                          )}
                          {i.city && <span className="text-muted"> · {i.city}</span>}
                        </span>
                        <span className="bar h-2 w-16 shrink-0">
                          <span className="bg-accent" style={{ width: `${Math.round((i.strength ?? 0) * 100)}%` }} />
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-sm text-muted">🔒 {t.programmes.ranked(list.length)}</p>
                )}
              </div>
            ))}
            {data.paid && c.universities && c.universities.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-semibold text-accent">{t.programmes.allUnis(c.universities.length)}</summary>
                <ul className="mt-2 max-h-64 overflow-y-auto pr-1">
                  {c.universities.map((u) => (
                    <li key={u.name} className="flex justify-between gap-2 py-0.5">
                      <a href={u.url} target="_blank" rel="noreferrer" className="truncate hover:text-accent">
                        {u.name}
                      </a>
                      {u.domain && (
                        <a
                          className="shrink-0 text-xs text-muted hover:text-ink"
                          target="_blank"
                          rel="noreferrer"
                          href={`https://www.google.com/search?q=${encodeURIComponent(`site:${u.domain} ${fields.map((f) => fieldName(f, locale)).slice(0, 2).join(' OR ')}`)}`}
                        >
                          {t.programmes.searchProgrammes}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
