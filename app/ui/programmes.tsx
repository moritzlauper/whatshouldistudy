'use client'

import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { studentId, unlockToken, update, useAppState } from '@/lib/store.ts'
import { orgsText } from '@/lib/site/orgs-text.ts'
import { SALES_PAUSED, isLocal } from '@/lib/site/config.ts'
import type { FieldMatch, Preferences, Results } from '@/lib/engine/types.ts'
import { normalize } from '@/lib/engine/text.ts'
import { topicWeights } from '@/lib/engine/topics.ts'
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
import { countryLabel, emoji, fieldName, fmtMoney, fmtNumber, levelLabel, subjectLabel, valueLabel } from '@/lib/site/labels.ts'
import type { SubjectKey, ValueKey } from '@/lib/taxonomy/fields.ts'
import { Price, useConfig } from './price.tsx'
import type { Config } from './price.tsx'
import { useSite } from './site-context.tsx'
import { Burst } from './shapes.tsx'
import { measureCheckout } from '@/lib/measure.ts'

interface Teaser {
  total: number
  facets: RankResult['facets']
  samples: RankedProgramme[]
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
function requestFields(results: Results) {
  return results.fields.slice(0, 6).map((f) => ({ id: f.id, score: f.score }))
}

/** Fetch the top five programmes through the same paid endpoint as the full list. */
export function TopProgrammes({ results, prefs, topics = [], token, unlocked, shared = false }: {
  results: Results; prefs: Preferences; topics?: UserTopic[]; token: string | null; unlocked: boolean; shared?: boolean
}) {
  const { t, r } = useSite()
  const { aiConsent } = useAppState()
  const [reply, setReply] = useState<{ key: string; data: RankResult | null; error?: boolean; locked?: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const weights = useMemo(() => topics.length ? topicWeights(topics) : undefined, [topics])
  const topicMap = useMemo(() => new Map(topics.map((x) => [x.key, x])), [topics])
  const body = JSON.stringify({ fields: requestFields(results), prefs, topics: weights, sort: 'match', page: 0, pageSize: AI_POOL })
  const key = JSON.stringify([body, token, unlocked, attempt])
  useEffect(() => {
    if (!unlocked) return
    const controller = new AbortController()
    fetch(withBase('/api/programmes'), {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body,
    }).then(async (res) => {
      if (res.status === 401) return setReply({ key, data: null, locked: true })
      if (!res.ok) throw new Error('Programme lookup failed')
      const data = await res.json() as RankResult
      if (!controller.signal.aborted) setReply({ key, data })
    }).catch(() => {
      if (!controller.signal.aborted) setReply({ key, data: null, error: true })
    })
    return () => controller.abort()
  }, [body, key, token, unlocked])
  const current = reply?.key === key ? reply : null
  const locked = !unlocked || current?.locked
  const pool = current?.data?.items ?? []
  const [refresh, setRefresh] = useState(0)
  const [shown, setShown] = useState(5)
  // The AI rating runs only with the consent switched on at the top of this section.
  const consent = !!aiConsent && !shared
  const ai = useAiTop(pool, token, results, consent && !current?.data?.sample, refresh)
  const left = refreshesLeft()
  // Until the AI is through, the order from the profile alone; then the combined one.
  const best = (ai.state === 'done' ? [...pool].sort((x, y) => combined(y, ai.fits.get(y.id)) - combined(x, ai.fits.get(x.id))) : pool).slice(0, shown)
  return (
    <section className="mt-8" aria-label={t.programmes.topTitle}>
      <h2 className="mb-4 font-display text-3xl">{t.programmes.topTitle.replace('5', String(Math.min(shown, Math.max(5, pool.length))))}</h2>
      {locked ? (
        <div className="card bg-accent-soft p-6 sm:p-8">
          <div className="text-3xl" aria-hidden="true">🔒</div>
          <p className="mt-3 max-w-2xl text-muted">{t.programmes.topLocked}</p>
          {shared ? <Link href={r.start} className="btn btn-primary mt-5">{t.share.own}</Link>
            : <a href={`#${r.anchors.unlock}`} className="btn btn-primary mt-5">{t.results.lockedCta}</a>}
        </div>
      ) : best.length > 0 ? (
        <ResultsContext.Provider value={results}><TopicsContext.Provider value={topicMap}>
          {!shared && <AiConsent />}
          {current?.data?.sample && <p className="mb-3 text-sm text-muted">{t.programmes.demo}</p>}
          {ai.state !== 'off' && (
            <p className={`mb-3 max-w-2xl text-sm ${ai.state === 'loading' ? 'animate-pulse text-muted' : 'text-muted'}`} role="status">
              🤖 {ai.state === 'loading' ? t.programmes.ai.topLoading(pool.length) : ai.state === 'done' ? t.programmes.ai.topDone(ai.fits.size) : ai.state === 'budget' ? <BudgetNote /> : t.programmes.ai.topFailed}
            </p>
          )}
          <ol className="grid gap-4">
            {best.map((p, i) => <li key={p.id}><ProgrammeRow p={p} rank={i + 1} ai={consent ? { token } : undefined} /></li>)}
          </ol>
          {pool.length > shown && (
            <button type="button" onClick={() => setShown(shown < 10 ? 10 : 20)} className="btn btn-ghost btn-sm mt-3">
              ▾ {t.programmes.ai.showTop(shown < 10 ? 10 : 20)}
            </button>
          )}
          <p className="mt-2 text-sm text-muted">{t.programmes.topNote}</p>
          {ai.state !== 'off' && (
            <button
              type="button"
              disabled={ai.state === 'loading' || left.today <= 0}
              onClick={() => {
                countRefresh()
                setRefresh((n) => n + 1)
              }}
              className="btn btn-ghost btn-sm mt-3"
              title={t.programmes.ai.refreshTip(left.today, left.total)}
            >
              ↻ {left.today > 0 ? t.programmes.ai.refresh : t.programmes.ai.refreshNone}
            </button>
          )}
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
  const [teaser, setTeaser] = useState<Teaser | null>(null)
  const config = useConfig(site)
  const fields = useMemo(() => requestFields(results), [results])
  const weights = useMemo(() => (topics.length ? topicWeights(topics) : undefined), [topics])
  const topicMap = useMemo(() => new Map(topics.map((x) => [x.key, x])), [topics])

  useEffect(() => setToken(unlockToken()), [])

  useEffect(() => {
    fetch(withBase('/api/teaser'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields, prefs, topics: weights }) })
      .then((res) => res.json())
      .then(setTeaser)
      .catch(() => setTeaser(null))
  }, [fields, prefs, hideFirst, weights])

  const noDataCountries = prefs.countries.filter((c) => !COUNTRIES[c]?.programmeData)
  const where = prefs.countries.length
    ? prefs.countries.length > 4
      ? t.programmes.inCountries(prefs.countries.length)
      : t.programmes.inList(prefs.countries.map((c) => (locale !== 'en' ? (DE_DATIVE[c] ?? countryLabel(c, intl)) : countryLabel(c, intl))))
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
      const res = await fetch(withBase(`/api/checkout?site=${site}&back=${encodeURIComponent(base)}&o=${encodeURIComponent(window.location.origin)}`), { method: 'POST' })
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
            {teaser.samples.length > 0 && (
              <>
                <p className="mt-7 font-bold">{t.programmes.freeTop(teaser.samples.length, hideFirst)}</p>
                <div className="mt-3 grid gap-4">
                  {teaser.samples.map((p) => (
                    <ProgrammeRow key={p.id} p={p} />
                  ))}
                </div>
              </>
            )}
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

/** Search queries and comments come quoted already. */
const quoted = (label: string) => (/^[«“#@]/.test(label) ? label : `«${label}»`)

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

function ProgrammeDetails({ p, ai }: { p: RankedProgramme; ai?: { token: string | null } }) {
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
      {(hasAbout || !ai) && <div>
        <h5 className="font-display text-lg">{d.about}</h5>
        {hasAbout ? (
          <>
            {p.description && <p className="mt-2 text-muted">{p.description}</p>}
            {p.focus && p.focus.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {p.focus.map((x) => (
                  <li key={x} className={`chip-soft ${[...(fit?.named ?? []), ...hits.map((h) => h.word)].some((n) => normalize(x).includes(normalize(n))) ? 'ring-2 ring-accent' : ''}`}>
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

      {/* 1b. In the paid report: Claude reads the official page and rates the fit with the profile. */}
      {ai && (
        <div>
          <h5 className="font-display text-lg">🤖 {t.programmes.ai.oneTitle}</h5>
          <AiCompare token={ai.token} item={p} />
        </div>
      )}

      {/* 2. Why this programme: your topics it names, with what you looked at. */}
      {hits.length > 0 && (
        <div>
          <h5 className="font-display text-lg">{t.programmes.fit.title}</h5>
          <p className="mt-1 text-muted">{t.programmes.fit.intro}</p>
          <ul className="mt-3 grid gap-3">
            {hits.map((h) => (
              <li key={h.key}>
                <div>
                  <span className="font-bold">«{h.word}»</span>{' '}
                  <span className="text-muted">
                    {t.programmes.fit.inData(fmtNumber(h.n, intl), h.bySource.map((x) => `${t.sourceNames[x.source] ?? x.source} ${fmtNumber(x.n, intl)}`).join(', '))}
                  </span>
                </div>
                {h.examples.length > 0 && (
                  <ul className="mt-1 grid gap-0.5 border-l-2 border-accent pl-3 text-xs">
                    {h.examples.map((e) => (
                      <li key={e.label} className="break-words">
                        {quoted(e.label)} <span className="text-muted">· {t.sourceNames[e.source] ?? e.source}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">{t.programmes.fit.bonus}</p>
        </div>
      )}

      {/* 3. What else in it fits you: only what this programme says about itself. */}
      {fit && (!hits.length || fit.also.length > 0) && (!ai || fit.named.length > 0 || fit.also.length > 0) && (
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
          <Item k={cd.deadline} v={p.deadline} />
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

/** `ai`: the report is unlocked, so a programme without a description can be checked with AI instead. `rank`: its place in the top list, shown in the card. */
function ProgrammeRow({ p, ai, rank }: { p: RankedProgramme; ai?: { token: string | null }; rank?: number }) {
  const { t, locale, intl, site } = useSite()
  const [open, setOpen] = useState(false)
  // Switzerland, Germany and Austria talk about fees per semester.
  const perSemester = isLocal(site)
  const feeAmount = p.fee ? (perSemester ? Math.round(p.fee.amount / 2) : p.fee.amount) : 0
  const type = p.institutionType as InstType | undefined
  const lang = locale === 'en' ? 'en' : locale.startsWith('de-') ? 'de' : locale === 'fr-CH' ? 'fr' : 'it'
  const hits = useTopicHits(p)
  const example = hits.flatMap((h) => h.examples)[0]
  const results = useContext(ResultsContext)
  const fieldRank = (results?.fields.findIndex((f) => f.id === p.matchedField) ?? -1) + 1
  // In the paid report: the AI rating, once made (top five, or details opened before).
  const aiFit = ai ? aiCacheMap().get(aiKey(p.id, locale, results)) : undefined
  return (
    <article className="card-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 grow items-start gap-3">
          {rank && <span aria-hidden="true" className="on-color flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-line bg-yellow font-display text-lg">{rank}</span>}
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
          {/* Once the AI has read the programme: the combined score, which tells programmes of one field apart. */}
          <span className="rounded-full border-2 border-line bg-accent px-2.5 py-0.5 text-sm font-extrabold text-accent-ink" title={aiFit ? t.programmes.ai.scoreTip(p.match, aiFit.score) : t.programmes.row.matchTip}>
            {combined(p, aiFit)}
          </span>
          {aiFit && (
            <span className="chip text-xs" title={`${dotsFor(combined(p, aiFit))}/5`}>
              🤖 {'●'.repeat(dotsFor(combined(p, aiFit)))}
              <span className="opacity-30">{'●'.repeat(5 - dotsFor(combined(p, aiFit)))}</span>
            </span>
          )}
        </div>
      </div>
      {hits.length > 0 && (
        <div className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-sm">
          <span className="font-bold">✨ {t.programmes.fit.why} </span>
          {hits.slice(0, 3).map((h, i) => (
            <span key={h.key}>
              {i > 0 && ', '}«{h.word}» <span className="text-muted">({fmtNumber(h.n, intl)}×)</span>
            </span>
          ))}
          {example && (
            <div className="mt-1 break-words text-xs text-muted">
              {t.programmes.fit.example} {quoted(example.label)}
            </div>
          )}
        </div>
      )}
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <Item k={t.programmes.row.field} v={`${emoji(p.matchedField)} ${fieldName(p.matchedField, locale)}${fieldRank ? ` (${t.programmes.row.fieldRank(fieldRank)})` : ''}`} />
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
      {p.admission && (
        <p className="mt-2 text-xs text-muted">
          🎟️ {t.programmes.row.entry}: {admissionText(p.country, type, lang) ?? p.admission}
        </p>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-3 text-sm font-bold text-accent hover:underline">
        {open ? `▴ ${t.programmes.details.close}` : `▾ ${t.programmes.details.open}`}
      </button>
      {open && <ProgrammeDetails p={p} ai={ai} />}
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
  const [page, setPage] = useState(0)
  const [data, setData] = useState<RankResult | null>(null)
  // AI ranking of the hits on screen, on request: the first 20 are read and rated, then sorted by the combined score.
  const results = useContext(ResultsContext)
  const hitPool = useMemo(() => (data?.items ?? []).slice(0, AI_POOL), [data])
  const hitIds = hitPool.map((p) => p.id).join(',')
  // Only for the hits it was asked for: paging or filtering does not start new ratings by itself.
  const [rankedFor, setRankedFor] = useState('')
  const { aiConsent } = useAppState()
  const consent = !!aiConsent && !shared
  const aiHits = useAiTop(hitPool, token, results!, consent && rankedFor === hitIds && !!results, 0)
  const shownItems = aiHits.state === 'done' && data
    ? [...data.items].sort((x, y) => combined(y, aiHits.fits.get(y.id)) - combined(x, aiHits.fits.get(x.id)))
    : (data?.items ?? [])
  const [loading, setLoading] = useState(false)

  const query = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      const res = await fetch(withBase('/api/programmes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ fields, prefs, topics, country: country || undefined, level, sort, q: q || undefined, page, ...extra }),
      })
      if (res.status === 401) {
        onInvalid()
        return null
      }
      return (await res.json()) as RankResult
    },
    [token, fields, prefs, topics, country, level, sort, q, page, onInvalid],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      query().then((d) => {
        if (!cancelled && d) setData(d)
        if (!cancelled) setLoading(false)
      })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  async function exportCsv() {
    const all = await query({ page: 0, pageSize: 2000 })
    if (!all) return
    const cols = ['match', 'name', 'institution', 'country', 'city', 'level', 'field', 'tuition_per_year', 'currency', 'earnings', 'admission_rate', 'url']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = all.items.map((p) =>
      [p.match, p.name, p.institution, p.country, p.city, p.level, fieldName(p.matchedField, locale), p.fee?.amount, p.fee?.currency, p.earnings?.median, p.admissionRate, p.url ?? p.institutionUrl].map(esc).join(','),
    )
    const blob = new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${conf.name}-programmes.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const pages = data ? Math.ceil(data.total / data.pageSize) : 0
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
        <select value={country} onChange={(e) => (setCountry(e.target.value), setPage(0))} className="input w-auto">
          <option value="">{t.programmes.allCountries}</option>
          {Object.entries(data?.facets.countries ?? {}).map(([cc, n]) => (
            <option key={cc} value={cc}>
              {countryLabel(cc, intl)} ({n})
            </option>
          ))}
        </select>
        <select value={level} onChange={(e) => (setLevel(e.target.value as Level | 'any'), setPage(0))} className="input w-auto">
          <option value="any">{t.programmes.allLevels}</option>
          {Object.entries(data?.facets.levels ?? {}).map(([l, n]) => (
            <option key={l} value={l}>
              {levelLabel(l as Level, locale)} ({n})
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => (setSort(e.target.value as typeof sort), setPage(0))} className="input w-auto">
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
      <p className="mt-4 text-sm font-semibold text-muted">
        {data ? t.programmes.count(fmtNumber(data.total, intl)) : t.programmes.loading}
        {data?.updated && t.programmes.dataFrom(new Date(data.updated).toLocaleDateString(intl, { dateStyle: 'medium' }))}
        {loading && data && t.programmes.updating}
      </p>
      {consent && data && data.items.length > 0 && results && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setRankedFor(hitIds)} disabled={aiHits.state === 'loading'} className="btn btn-primary btn-sm">
            🤖 {aiHits.state === 'loading' ? t.programmes.ai.loading : t.programmes.ai.rankHits(Math.min(AI_POOL, data.items.length))}
          </button>
          {aiHits.state === 'done' && <span className="text-sm text-muted">{t.programmes.ai.rankedHits}</span>}
          {aiHits.state === 'failed' && <span className="text-sm font-semibold text-bad">{t.programmes.ai.error}</span>}
          {aiHits.state === 'budget' && <span className="text-sm"><BudgetNote /></span>}
        </div>
      )}
      <div className="mt-3 grid gap-4">
        {shownItems.map((p) => (
          <ProgrammeRow key={p.id} p={p} ai={consent ? { token } : undefined} />
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


interface AiFit {
  id: string
  fit: number
  /** 0..100, finer than `fit`. */
  score: number
  reasons: string[]
  check: string
  thin: boolean
}

/**
 * Part of the paid report: Claude compares the first few programmes in the
 * list with your profile, reading their official pages. Only on request, and
 * only the profile (never data exports) leaves the browser.
 */
/**
 * AI ratings already made, per programme and profile, kept in this browser so
 * neither reopening details nor coming back to the result asks Claude again.
 */
// v2: ratings carry a 0..100 score.
const AI_STORE = 'wsis:ai-fit:v2'
let aiCache: Map<string, AiFit> | null = null

/** Withdrawing consent deletes the ratings kept in this browser. */
export function clearAiCache() {
  aiCache = null
  try {
    window.localStorage.removeItem(AI_STORE)
  } catch {
    // Nothing stored, nothing to remove.
  }
}

/** The switch at the top of the programme section: nothing is sent before it is on. */
function AiConsent() {
  const { t } = useSite()
  const { aiConsent } = useAppState()
  const tx = t.programmes.aiOn
  const on = !!aiConsent
  return (
    <div className="card-sm mb-4 p-4 text-sm">
      <p className="font-bold">🤖 {tx.title}</p>
      <p className="mt-1 max-w-3xl text-muted">{tx.text}</p>
      <label className="mt-3 flex items-start gap-2">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            if (!e.target.checked) clearAiCache()
            update((s) => ({ ...s, aiConsent: e.target.checked ? { at: new Date().toISOString() } : undefined }))
          }}
          className="mt-0.5"
        />
        <span>{on ? tx.on : tx.check}</span>
      </label>
    </div>
  )
}
function aiCacheMap(): Map<string, AiFit> {
  if (aiCache) return aiCache
  aiCache = new Map()
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(AI_STORE) : null
    if (raw) for (const [k, v] of JSON.parse(raw) as Array<[string, AiFit]>) aiCache.set(k, v)
  } catch {
    // Storage blocked or broken: start empty.
  }
  return aiCache
}
function aiCacheSet(entries: Array<[string, AiFit]>) {
  const m = aiCacheMap()
  for (const [k, v] of entries) m.set(k, v)
  try {
    window.localStorage.setItem(AI_STORE, JSON.stringify([...m].slice(-200)))
  } catch {
    // Not kept beyond this page view; fine.
  }
}
/** A rating holds for one programme, one profile and one language. */
function aiKey(id: string, locale: string, results: Results | null): string {
  return `${id}|${locale}|${results?.riasec.code ?? ''}|${results?.fields.slice(0, 5).map((f) => f.id).join(',') ?? ''}`
}

type FitProfileBody = {
  riasec?: { code: string; profile: number[] }
  big5?: Record<string, number>
  subjects: string[]
  values: string[]
  fields?: string[]
}

/** What the AI gets: the profile only, never data exports. */
function useFitProfile(given?: Results | null): () => FitProfileBody {
  const { locale } = useSite()
  const context = useContext(ResultsContext)
  const results = given ?? context
  const { answers } = useAppState()
  return () => {
    const fromQuestionnaire = results?.big5?.from.includes('questionnaire')
    return {
      riasec: results?.riasec.code ? { code: results.riasec.code, profile: results.riasec.profile } : undefined,
      big5: fromQuestionnaire ? results!.big5!.z : undefined,
      subjects: Object.entries(answers.subjects ?? {}).filter(([, v]) => (v?.enjoy ?? 0) >= 4).map(([k]) => subjectLabel(k as SubjectKey, locale)),
      values: Object.entries(answers.values ?? {}).filter(([, v]) => (v ?? 0) >= 4).map(([k]) => valueLabel(k as ValueKey, locale)),
      fields: results?.fields.slice(0, 5).map((f) => fieldName(f.id, locale)),
    }
  }
}

async function fetchFits(token: string | null, items: RankedProgramme[], profile: FitProfileBody, locale: string): Promise<AiFit[]> {
  const res = await fetch(withBase('/api/programme-fit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ programmes: items.map((p) => ({ id: p.id, field: p.matchedField, country: p.country })), profile, locale }),
  })
  if (!res.ok) throw new Error(String(res.status))
  return ((await res.json()) as { items: AiFit[] }).items
}

/**
 * The top five in the paid report: Claude reads the official pages of the
 * best candidates by profile and rates each; the five best by the combined
 * score are shown. Ratings already made are taken from this browser.
 */
function useAiTop(pool: RankedProgramme[], token: string | null, results: Results, enabled: boolean, refresh: number) {
  const { locale } = useSite()
  const profile = useFitProfile(results)
  const [out, setOut] = useState<{ key: string; state: 'loading' | 'done' | 'failed' | 'budget'; fits: Map<string, AiFit> } | null>(null)
  const ids = pool.map((p) => p.id).join(',')
  const key = `${ids}|${aiKey('', locale, results)}|${refresh}`
  useEffect(() => {
    if (!enabled || !pool.length) return
    let live = true
    const fits = new Map<string, AiFit>()
    // «Aktualisieren» reads every page again; otherwise ratings already made are reused.
    if (!refresh) {
      for (const p of pool) {
        const f = aiCacheMap().get(aiKey(p.id, locale, results))
        if (f) fits.set(p.id, f)
      }
    }
    const missing = pool.filter((p) => !fits.has(p.id))
    if (!missing.length) {
      setOut({ key, state: 'done', fits })
      return
    }
    setOut({ key, state: 'loading', fits })
    const batches = Array.from({ length: Math.ceil(missing.length / AI_BATCH) }, (_, i) => missing.slice(i * AI_BATCH, (i + 1) * AI_BATCH))
    const body = profile()
    void Promise.allSettled(batches.map((b) => fetchFits(token, b, body, locale))).then((settled) => {
      const got = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      aiCacheSet(got.map((f) => [aiKey(f.id, locale, results), f]))
      for (const f of got) fits.set(f.id, f)
      // 429: this purchase has used up its AI budget.
      const budget = settled.some((r) => r.status === 'rejected' && (r.reason as Error).message === '429')
      if (live) setOut({ key, state: budget && !got.length ? 'budget' : fits.size ? 'done' : 'failed', fits: new Map(fits) })
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, token])
  const current = out?.key === key ? out : null
  return { state: !enabled || !pool.length ? ('off' as const) : (current?.state ?? 'loading'), fits: current?.fits ?? new Map<string, AiFit>() }
}

/** The AI budget of this purchase is used up: write to us for more. */
function BudgetNote() {
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

/** «Aktualisieren» is limited: 5 a day and 20 in all, counted in this browser (the server has its own cap). */
const REFRESH_STORE = 'wsis:ai-refresh:v1'
const REFRESH_PER_DAY = 5
const REFRESH_IN_ALL = 20
function readRefresh(): { day: string; today: number; total: number } {
  const day = new Date().toISOString().slice(0, 10)
  try {
    const x = JSON.parse(window.localStorage.getItem(REFRESH_STORE) ?? '') as { day: string; today: number; total: number }
    return { day, today: x.day === day ? x.today : 0, total: x.total || 0 }
  } catch {
    return { day, today: 0, total: 0 }
  }
}
function refreshesLeft(): { today: number; total: number } {
  if (typeof window === 'undefined') return { today: REFRESH_PER_DAY, total: REFRESH_IN_ALL }
  const r = readRefresh()
  const total = Math.max(0, REFRESH_IN_ALL - r.total)
  return { today: Math.min(total, Math.max(0, REFRESH_PER_DAY - r.today)), total }
}
function countRefresh() {
  const r = readRefresh()
  try {
    window.localStorage.setItem(REFRESH_STORE, JSON.stringify({ day: r.day, today: r.today + 1, total: r.total + 1 }))
  } catch {
    // Not counted beyond this page view.
  }
}

/** Candidates the AI reads for the top five, in batches the endpoint takes at once. */
const AI_POOL = 20
const AI_BATCH = 5
/**
 * Once the AI has read a programme, its score decides: it knows what the
 * programme contains. The profile match (the same for a whole field) only
 * nudges it. Dots and label follow the same number, so they never disagree.
 */
const combined = (p: RankedProgramme, f?: AiFit) => (f ? Math.round(0.8 * f.score + 0.2 * p.match) : p.match)
const dotsFor = (n: number) => (n >= 80 ? 5 : n >= 60 ? 4 : n >= 40 ? 3 : n >= 20 ? 2 : 1)

/** One programme in the paid report, opened in its details: rated once, then kept in this browser. */
function AiCompare({ token, item }: { token: string | null; item: RankedProgramme }) {
  const { t, locale } = useSite()
  const results = useContext(ResultsContext)
  const profile = useFitProfile()
  const [fresh, setFresh] = useState<AiFit | null>(null)
  const [failed, setFailed] = useState(false)
  const a = t.programmes.ai
  const fit = fresh ?? aiCacheMap().get(aiKey(item.id, locale, results))

  async function run() {
    setFailed(false)
    try {
      const [got] = await fetchFits(token, [item], profile(), locale)
      if (!got) throw new Error('no rating')
      aiCacheSet([[aiKey(got.id, locale, results), got]])
      setFresh(got)
    } catch {
      setFailed(true)
    }
  }

  // Read and rated right away when first opened; after that it comes from this browser.
  const started = useRef(false)
  useEffect(() => {
    if (fit || started.current) return
    started.current = true
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit])

  if (!fit) {
    return failed ? (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-bad">{a.error}</p>
        <button type="button" onClick={run} className="btn btn-ghost btn-sm">{a.again}</button>
      </div>
    ) : (
      <p className="animate-pulse text-sm text-muted">{a.loading}</p>
    )
  }
  const dots = dotsFor(combined(item, fit))
  return (
    <section className="mt-2">
      <span className="chip text-xs" title={`${combined(item, fit)}`}>
        {'●'.repeat(dots)}
        <span className="opacity-30">{'●'.repeat(5 - dots)}</span> {a.fit(dots)} · {combined(item, fit)}
      </span>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {fit.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {fit.check && (
        <p className="mt-1 text-sm text-muted">
          <strong>{a.check}</strong> {fit.check}
        </p>
      )}
      {fit.thin && <p className="mt-1 text-xs text-muted">{a.thin}</p>}
      <p className="mt-4 text-xs text-muted">{`${a.note} ${a.consent}`}</p>
    </section>
  )
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
