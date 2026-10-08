'use client'

import { withBase } from '@/lib/site.ts'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '@/lib/store.ts'
import { decodeSnapshot, encodeSnapshot, sharedParam } from '@/lib/share.ts'
import type { Snapshot } from '@/lib/share.ts'
import { score, sourceProfile } from '@/lib/engine/scoring.ts'
import { userTopics } from '@/lib/engine/topics.ts'
import { SUMMARY_VERSION } from '@/lib/engine/accumulate.ts'
import type { FieldMatch, Preferences, Results, SourceSummary } from '@/lib/engine/types.ts'
import type { FieldStat } from '@/lib/programmes.ts'
import { BIG5_KEYS, FIELDS, FIELD_BY_ID, RIASEC_KEYS } from '@/lib/taxonomy/fields.ts'
import { big5Label, emoji, fieldBlurb, fieldCareers, fieldName, fmtNumber, groupLabel, riasecLabel } from '@/lib/site/labels.ts'
import { insightText, reasonText } from '@/lib/site/explain.ts'
import { Hexagon } from '../ui/hexagon.tsx'
import { Programmes } from '../ui/programmes.tsx'
import { StudyingControl } from '../ui/prefs-form.tsx'
import { Earnings } from '../ui/earnings.tsx'
import { Contributions } from '../ui/contributions.tsx'
import { useConfig } from '../ui/price.tsx'
import { Burst, Sparkle } from '../ui/shapes.tsx'
import { useSite } from '../ui/site-context.tsx'
import { measureResult } from '@/lib/measure.ts'

const CARD_COLORS = ['var(--pink)', 'var(--sky)', 'var(--lime)', 'var(--yellow)', 'var(--orange)', 'var(--violet)']
const BIG5_COLORS: Record<string, string> = { O: 'var(--pink)', C: 'var(--sky)', E: 'var(--yellow)', A: 'var(--lime)', N: 'var(--orange)' }

export function ResultsView() {
  const k = useSite()
  const { t, r, locale, intl } = k
  const state = useAppState()
  const config = useConfig(k.site)
  const [stats, setStats] = useState<Record<string, FieldStat>>({})
  const [mounted, setMounted] = useState(false)
  // A result opened from a shared link: undefined until checked, then the snapshot, null or 'broken'.
  const [shared, setShared] = useState<Snapshot | null | 'broken' | undefined>(undefined)
  const [sharedPaid, setSharedPaid] = useState(false)
  useEffect(() => {
    const read = () => {
      const code = sharedParam(window.location.hash)
      if (!code) return setShared(null)
      const snap = decodeSnapshot(code)
      setShared(snap ?? 'broken')
      if (snap?.token) {
        fetch(withBase('/api/unlock'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: snap.token }) })
          .then((res) => res.json())
          .then((j: { ok?: boolean }) => setSharedPaid(!!j.ok))
          .catch(() => {})
      }
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])
  useEffect(() => {
    setMounted(true)
    fetch(withBase('/api/stats'))
      .then((res) => res.json())
      .then((j: { stats: Record<string, FieldStat> }) => setStats(j.stats ?? {}))
      .catch(() => {})
  }, [])

  const isShared = !!shared && shared !== 'broken'
  const summaries = isShared ? [] : (Object.values(state.summaries).filter(Boolean) as SourceSummary[])
  const own = useMemo<Results | null>(() => {
    if (!mounted || shared === undefined || isShared) return null
    const swiss = k.site === 'ch' || (k.site === 'global' && state.prefs.countries.includes('CH'))
    const fieldStats = Object.fromEntries(Object.entries(stats).map(([id, s]) => [id, { salaryPercentile: swiss ? (s.chSalaryPercentile ?? s.salaryPercentile) : s.salaryPercentile }]))
    return score({ summaries, answers: state.answers, fieldStats, studying: state.prefs.studying })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, state, stats, shared])
  const results = isShared ? (shared as Snapshot).results : own
  const topics = useMemo(() => (own ? userTopics(summaries, state.prefs.studying) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [own])
  const prefs: Preferences = isShared ? { ...state.prefs, ...(shared as Snapshot).prefs } : state.prefs
  // The step from analysis to result, for ads: that it happened, nothing of what it says.
  useEffect(() => {
    if (own && (summaries.length > 0 || Object.keys(state.answers.riasec ?? {}).length >= 6)) measureResult()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own])

  if (shared === 'broken') {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <Burst className="mx-auto" size={90} />
        <h1 className="mt-6 font-display text-4xl">{t.share.broken}</h1>
        <Link href={r.start} className="btn btn-primary btn-lg mt-8">
          {t.share.own}
        </Link>
      </div>
    )
  }

  if (!mounted || !results) return <div className="animate-soft mx-auto max-w-6xl px-4 py-24 font-display text-3xl text-muted sm:px-6">{t.results.calculating}</div>

  const hasInput = isShared || summaries.length > 0 || Object.keys(state.answers.riasec ?? {}).length >= 6
  if (!hasInput) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <Burst className="mx-auto" size={90} />
        <h1 className="mt-6 font-display text-5xl">{t.results.nothingTitle}</h1>
        <p className="mt-4 text-lg text-muted">{t.results.nothingText}</p>
        <Link href={r.start} className="btn btn-primary btn-lg mt-8">
          {t.misc.start}
        </Link>
      </div>
    )
  }

  const [first, ...rest] = results.fields
  const top = rest.slice(0, 9)
  // Place 1 belongs to the paid report; the other places stay free. Without
  // payments set up on this deployment there is nothing to pay, so it's open.
  const paid = !!state.unlock && state.unlock.expiresAt > Date.now()
  const unlocked = (isShared ? sharedPaid : paid) || config?.payments === 'off'
  const sourceList = results.sources.map((s) => t.sourceNames[s.id] ?? s.label).join(', ') || t.results.yourAnswers

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-semibold text-muted">{t.results.signalsFrom(fmtNumber(results.dataPoints, intl), sourceList)}</p>
          <h1 className="mt-1 font-display text-5xl sm:text-6xl">{t.results.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Confidence level={results.confidence} />
          {!isShared && (
            <Link href={r.start} className="btn btn-ghost btn-sm">
              + {t.results.addMore}
            </Link>
          )}
        </div>
      </div>

      {isShared ? (
        <div className="card-sm mt-6 flex flex-wrap items-center justify-between gap-3 bg-accent-soft p-4">
          <p className="text-sm font-semibold">{t.share.banner(new Date((shared as Snapshot).at).toLocaleDateString(intl, { dateStyle: 'medium' }))}</p>
          <Link href={r.start} className="btn btn-primary btn-sm">
            {t.share.own}
          </Link>
        </div>
      ) : (
        <>
          <ShareCard results={results} prefs={prefs} token={paid ? state.unlock!.token : undefined} />
          <div className="card-sm mt-4 grid gap-2 p-4 sm:grid-cols-[1fr_1.2fr] sm:items-center">
            <div>
              <div className="font-bold">{t.prefs.studying}</div>
              <div className="text-xs text-muted">{t.prefs.studyingHint}</div>
            </div>
            <StudyingControl />
          </div>
          <StudyInfoNote summaries={summaries} />
        </>
      )}

      {unlocked ? <TopMatch m={first} stat={stats[first.id]} /> : <LockedTop shared={isShared} />}

      <section className="mt-16">
        <h2 className="font-display text-4xl">{t.results.next}</h2>
        <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {top.map((m, i) => (
            <FieldCard key={m.id} m={m} rank={i + 2} stat={stats[m.id]} color={CARD_COLORS[i % CARD_COLORS.length]} />
          ))}
        </div>
      </section>

      {results.hidden.length > 0 && (
        <section className="card relative mt-16 overflow-hidden bg-surface-2 p-6 sm:p-9">
          <Sparkle className="float-slow absolute right-6 top-6" size={46} color="var(--violet)" />
          <h2 className="font-display text-4xl">🔮 {t.results.hiddenTitle}</h2>
          <p className="mt-2 max-w-2xl text-muted">{t.results.hiddenSub}</p>
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {results.hidden.map((m) => {
              const f = FIELD_BY_ID[m.id]
              const why = m.reasons.filter((x) => x.k !== 'hidden').slice(0, 2)
              return (
                <Link key={m.id} href={r.field(m.id)} className="card-sm card-pop border-dashed p-5">
                  <div className="text-3xl" aria-hidden="true">{emoji(m.id)}</div>
                  <div className="mt-2 text-xs font-bold uppercase tracking-wider text-muted">{groupLabel(f.group, locale)}</div>
                  <div className="mt-1 hyphens-auto break-words font-display text-xl">{fieldName(m.id, locale)}</div>
                  <div className="mt-1 text-xs font-bold text-accent">{t.results.matchPct(m.score)}</div>
                  <p className="mt-2 text-sm text-muted">{why.map((x) => reasonText(x, k)).join(' ') || fieldBlurb(m.id, locale)}</p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <div className="card p-6 sm:p-8">
          <h2 className="font-display text-3xl">{t.results.riasecTitle}</h2>
          <p className="mt-1 text-sm text-muted">
            {t.results.riasecSub(results.riasec.from.map((x) => (x === 'questionnaire' ? t.results.from.questionnaire : t.results.from.footprint)).join(t.results.from.and) || t.results.from.footprint, '')}
            <strong className="sticker ml-1 align-middle text-base">{results.riasec.code}</strong>
          </p>
          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
            <Hexagon profile={results.riasec.profile} label={t.misc.profileLabel} />
            <ul className="grid gap-2 text-sm">
              {RIASEC_KEYS.map((key, i) => {
                const lab = riasecLabel(key, locale)
                const on = results.riasec.code.includes(key)
                return (
                  <li key={key} className={on ? '' : 'text-muted'}>
                    <span className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md border-2 text-xs font-extrabold ${on ? 'border-line bg-accent text-accent-ink' : 'border-soft-line'}`}>{key}</span>
                    <span className="font-semibold">{lab.name}</span> <span className="text-muted">· {Math.round(results.riasec.profile[i] * 100)}</span>
                    {on && <div className="ml-8 text-xs text-muted">{lab.short}</div>}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
        <div className="card p-6 sm:p-8">
          <h2 className="font-display text-3xl">{t.results.big5Title}</h2>
          {results.big5 && results.big5.from.includes('questionnaire') ? (
            <>
              <p className="mt-1 text-sm text-muted">
                {t.results.big5Sub} {results.big5.from.includes('questionnaire') ? t.results.big5Q : t.results.big5Music}
              </p>
              <ul className="mt-6 grid gap-5">
                {BIG5_KEYS.map((key) => {
                  const z = results.big5!.z[key] ?? 0
                  const pct = Math.round(100 / (1 + Math.exp(-1.7 * z)))
                  const lab = big5Label(key, locale)
                  return (
                    <li key={key}>
                      <div className="flex justify-between text-sm">
                        <span className="font-bold">{lab.name}</span>
                        <span className="text-muted">{t.results.percentile(pct)}</span>
                      </div>
                      <div className="bar mt-1.5">
                        <span style={{ width: `${pct}%`, background: BIG5_COLORS[key] }} />
                      </div>
                      <div className="mt-1 text-xs text-muted">{z > 0.5 ? lab.high : z < -0.5 ? lab.low : t.results.middle}</div>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-muted">
              {t.results.big5Missing}{' '}
              <Link href={`${r.start}#${r.anchors.questionnaire}`} className="font-bold text-accent underline">
                {t.results.addIt}
              </Link>
            </p>
          )}
        </div>
      </section>

      {results.insights.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-4xl">{t.results.insightsTitle}</h2>
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.insights.map((ins, i) => {
              const x = insightText(ins, k)
              return (
                <div key={ins.id} className="card on-color p-6" style={{ background: CARD_COLORS[(i + 2) % CARD_COLORS.length], transform: `rotate(${[-0.8, 0.6, -0.4, 0.9, -0.6, 0.4][i % 6]}deg)` }}>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted">{x.title}</div>
                  <div className="mt-1 font-display text-4xl">{x.value}</div>
                  <p className="mt-2 text-sm text-muted">{x.detail}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {results.timeline.length >= 2 && (
        <section className="card mt-16 p-6 sm:p-8">
          <h2 className="font-display text-3xl">{t.results.timelineTitle}</h2>
          <p className="mt-1 text-sm text-muted">{t.results.timelineSub}</p>
          <ol className="mt-6 grid gap-5">
            {results.timeline.map((y) => (
              <li key={y.year} className="grid grid-cols-[4rem_1fr] items-center gap-3">
                <span className="font-display text-xl">{y.year}</span>
                <div className="flex flex-wrap gap-2">
                  {y.fields.map((f, i) => (
                    <span key={f.id} className="chip">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-accent-ink" title={t.results.yearRank(i + 1)}>
                        {i + 1}
                      </span>
                      {f.id === first.id && !unlocked ? (
                        <>🔒 {t.results.lockedChip}</>
                      ) : (
                        <>
                          <span aria-hidden="true">{emoji(f.id)}</span> {fieldName(f.id, locale)}
                        </>
                      )}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          {state.prefs.studying && !isShared && (
            <p className="mt-5 text-xs text-muted">ℹ {t.results.timelineStudying(fieldName(state.prefs.studying.field, locale), state.prefs.studying.since)}</p>
          )}
        </section>
      )}

      {summaries.some((s) => s.source !== 'questionnaire') && <SourceInsights summaries={summaries} unlocked={unlocked} studying={state.prefs.studying} />}

      <Programmes results={results} prefs={prefs} topics={topics} hideFirst={!unlocked} />
    </div>
  )
}

function Confidence({ level }: { level: Results['confidence'] }) {
  const { t } = useSite()
  const color = { low: 'var(--orange)', medium: 'var(--yellow)', high: 'var(--lime)' }[level]
  return (
    <span className="on-color chip" style={{ background: color }} title={t.results.confidenceTip}>
      ● {t.results.confidence[level]}
    </span>
  )
}

function Components({ m }: { m: FieldMatch }) {
  const { t } = useSite()
  return (
    <ul className="grid gap-2">
      {(Object.entries(m.components) as Array<[keyof typeof t.results.components, number]>).map(([key, v]) => (
        <li key={key} className="grid grid-cols-[9.5rem_1fr_2rem] items-center gap-2 text-xs">
          <span className="text-muted">{t.results.components[key]}</span>
          <div className="bar h-2.5">
            <span className="bg-accent" style={{ width: `${Math.round((v ?? 0) * 100)}%` }} />
          </div>
          <span className="text-right font-bold">{Math.round((v ?? 0) * 100)}</span>
        </li>
      ))}
    </ul>
  )
}

/** A few examples from the data, small and folded away: the bar above tells the story. */
function Evidence({ m, n }: { m: FieldMatch; n: number }) {
  const { t } = useSite()
  if (!m.evidence.length) return null
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-bold text-muted">{t.results.examples(Math.min(n, m.evidence.length))}</summary>
      <ul className="mt-2 grid gap-1">
        {m.evidence.slice(0, n).map((e) => (
          <li key={e.label} className="break-words" title={t.sourceNames[e.source] ?? e.source}>
            <span className="text-muted">{t.results.kinds[e.kind] ?? e.kind}:</span> {e.label}
          </li>
        ))}
      </ul>
    </details>
  )
}

function TopMatch({ m, stat }: { m: FieldMatch; stat?: FieldStat }) {
  const k = useSite()
  const { t, r, locale, intl } = k
  const f = FIELD_BY_ID[m.id]
  const name = fieldName(m.id, locale)
  return (
    <section className="card pop-in relative mt-9 overflow-hidden">
      <div className="on-color relative flex flex-wrap items-center gap-4 border-b-2 border-line bg-yellow px-6 py-4 sm:px-10">
        <span className="sticker" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>🏆 {t.results.best}</span>
        <span className="text-sm font-bold">{groupLabel(f.group, locale)}</span>
        <Burst className="spin-slow absolute -right-8 -top-8 hidden sm:block" size={110} color="var(--pink)" />
      </div>
      <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_20rem]">
        <div>
          <div className="text-6xl" aria-hidden="true">{emoji(m.id)}</div>
          <h2 className="mt-3 hyphens-auto break-words font-display text-5xl sm:text-6xl">{name}</h2>
          <p className="mt-4 max-w-2xl text-lg text-muted">{fieldBlurb(m.id, locale)}</p>
          <ul className="mt-6 grid gap-2.5">
            {m.reasons.map((x) => (
              <li key={x.k} className="flex gap-3">
                <span className="on-color flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line bg-lime text-xs" aria-hidden="true">
                  {x.k === 'studying' ? 'i' : '✓'}
                </span>
                {reasonText(x, k)}
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-4">
            <Contributions m={m} />
            <Evidence m={m} n={8} />
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <ScoreRing value={m.score} />
            <div className="text-sm text-muted">{t.results.relative(FIELDS.length)}</div>
          </div>
          <Components m={m} />
          <div className="text-sm">
            <div className="font-bold">{t.results.leadsTo}</div>
            <div className="text-muted">{fieldCareers(m.id, locale).slice(0, 4).join(' · ')}</div>
          </div>
          <Earnings stat={stat} />
          <Link href={r.field(m.id)} className="btn btn-ghost btn-sm max-w-full self-start">
            {t.results.more}
          </Link>
        </div>
      </div>
    </section>
  )
}

/** Share or keep the result: everything lives in the link, nothing on a server. */
function ShareCard({ results, prefs, token }: { results: Results; prefs: Preferences; token?: string }) {
  const { t, conf, locale } = useSite()
  const s = t.share
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const lang = locale.startsWith('fr') ? 'fr' : locale.startsWith('it') ? 'it' : locale.startsWith('de') ? 'de' : 'en'
  const emailText = {
    en: { label: 'Your email address', send: 'Send to me', sending: 'Sending…', sent: 'The result link is on its way.', error: 'Could not send the email. Please try again.', privacy: 'Your address and result link go to Infomaniak only to deliver this email.', close: 'Cancel' },
    de: { label: 'Deine E-Mail-Adresse', send: 'An mich senden', sending: 'Wird gesendet…', sent: 'Der Ergebnislink ist unterwegs.', error: 'Die E-Mail konnte nicht gesendet werden. Bitte nochmals versuchen.', privacy: 'Deine Adresse und der Ergebnislink gehen nur zum Versand an Infomaniak.', close: 'Abbrechen' },
    fr: { label: 'Ton adresse e-mail', send: 'M’envoyer le lien', sending: 'Envoi…', sent: 'Le lien vers ton résultat est en route.', error: 'L’e-mail n’a pas pu être envoyé. Réessaie.', privacy: 'Ton adresse et le lien sont transmis à Infomaniak uniquement pour envoyer cet e-mail.', close: 'Annuler' },
    it: { label: 'Il tuo indirizzo e-mail', send: 'Inviamelo', sending: 'Invio…', sent: 'Il link al risultato è in arrivo.', error: 'Non è stato possibile inviare l’e-mail. Riprova.', privacy: 'Il tuo indirizzo e il link vengono trasmessi a Infomaniak solo per inviare questa e-mail.', close: 'Annulla' },
  }[lang]
  const url = useMemo(() => `${window.location.origin}${window.location.pathname}#s=${encodeSnapshot(results, prefs, token)}`, [results, prefs, token])
  useEffect(() => setCanShare(typeof navigator.share === 'function'), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt(s.copyFallback, url)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function emailResult(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEmailState('sending')
    try {
      const response = await fetch(withBase('/api/share/email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, url, lang }),
      })
      if (!response.ok) throw new Error('Email delivery failed')
      setEmailState('sent')
    } catch {
      setEmailState('error')
    }
  }

  return (
    <section className="card on-color mt-6 overflow-hidden bg-lime p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <h2 className="font-display text-2xl sm:text-3xl">{s.title}</h2>
          <p className="mt-1 text-sm">{s.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copy} className="btn btn-primary btn-lg">
            {copied ? s.copied : s.copy}
          </button>
          {canShare && (
            <button type="button" onClick={() => navigator.share({ title: s.mailSubject(conf.name), url }).catch(() => {})} className="btn btn-ghost">
              {s.share}
            </button>
          )}
          <button type="button" onClick={() => { setEmailOpen((open) => !open); setEmailState('idle') }} className="btn btn-ghost">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-[1.1em] shrink-0" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m4 7 8 5.5L20 7" />
            </svg>
            {s.mail.replace(/^✉\s*/, '')}
          </button>
        </div>
      </div>
      {emailOpen && (
        <form onSubmit={emailResult} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="sr-only" htmlFor="share-email">{emailText.label}</label>
          <input id="share-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setEmailState('idle') }} placeholder={emailText.label} className="input min-w-0 bg-surface text-ink" />
          <div className="flex gap-2">
            <button type="submit" disabled={emailState === 'sending' || emailState === 'sent'} className="btn btn-primary">
              {emailState === 'sending' ? emailText.sending : emailText.send}
            </button>
            <button type="button" onClick={() => { setEmailOpen(false); setEmailState('idle') }} className="btn btn-ghost">{emailText.close}</button>
          </div>
          <p className="text-xs opacity-75 sm:col-span-2">{emailText.privacy}</p>
          {emailState === 'sent' && <p role="status" className="text-sm font-semibold sm:col-span-2">{emailText.sent}</p>}
          {emailState === 'error' && <p role="alert" className="text-sm font-semibold sm:col-span-2">{emailText.error}</p>}
        </form>
      )}
    </section>
  )
}

/** Each source on its own; part of the full report. */
/** What was left out as degree research, and whether stored data predates the current reader. */
function StudyInfoNote({ summaries }: { summaries: SourceSummary[] }) {
  const { t, r, locale, intl } = useSite()
  const s = t.studyInfo
  const data = summaries.filter((x) => x.source !== 'questionnaire')
  const stale = data.some((x) => (x.v ?? 0) < SUMMARY_VERSION)
  let n = 0
  const fields = new Map<string, number>()
  const ex: string[] = []
  for (const x of data) {
    if (!x.studyInfo) continue
    n += x.studyInfo.n
    for (const [id, c] of Object.entries(x.studyInfo.fields)) fields.set(id, (fields.get(id) ?? 0) + c)
    for (const e of x.studyInfo.ex) if (ex.length < 6 && !ex.includes(e)) ex.push(e)
  }
  if (!n && !stale) return null
  const top = [...fields]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, c]) => `${fieldName(id, locale)} (${fmtNumber(c, intl)})`)
    .join(', ')
  return (
    <div className="card-sm mt-4 grid gap-3 p-4 text-sm">
      {stale && (
        <div className="on-color flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-line bg-yellow px-3 py-2">
          <p className="max-w-2xl font-semibold">⚠ {s.stale}</p>
          <Link href={r.start} className="btn btn-primary btn-sm">
            {s.staleCta}
          </Link>
        </div>
      )}
      {n > 0 && (
        <div>
          <div className="font-bold">🎓 {s.title(fmtNumber(n, intl))}</div>
          <p className="mt-1 max-w-3xl text-muted">{s.text(top)}</p>
          {ex.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-bold text-muted">{s.examples}</summary>
              <ul className="mt-1 grid gap-0.5">
                {ex.map((e) => (
                  <li key={e} className="break-words">
                    {e}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function SourceInsights({ summaries, unlocked, studying }: { summaries: SourceSummary[]; unlocked: boolean; studying?: Preferences['studying'] }) {
  const k = useSite()
  const { t, r, locale, intl } = k
  const s = t.sourceInsights
  const list = summaries.filter((x) => x.source !== 'questionnaire').sort((a, b) => b.dataPoints - a.dataPoints)
  const profiles = new Map(list.map((x) => [x.source, sourceProfile(x, studying)]))
  return (
    <section className="mt-16">
      <h2 className="font-display text-4xl sm:text-5xl">{s.title}</h2>
      <p className="mt-2 max-w-2xl text-muted">{s.sub}</p>
      <div className="relative mt-6">
        <div className={`grid gap-5 md:grid-cols-2 ${unlocked ? '' : 'pointer-events-none select-none blur-[6px]'}`} aria-hidden={!unlocked}>
          {list.map((x, i) => {
            const p = profiles.get(x.source)!
            const span = x.span ? `${x.span.from.slice(0, 4)}–${x.span.to.slice(0, 4)}` : undefined
            return (
              <article key={x.source} className="card overflow-hidden">
                <div className="on-color border-b-2 border-line px-5 py-3" style={{ background: CARD_COLORS[i % CARD_COLORS.length] }}>
                  <h3 className="font-display text-xl">{t.sourceNames[x.source] ?? x.label}</h3>
                  <div className="text-xs font-semibold">{s.points(fmtNumber(x.dataPoints, intl), span)}</div>
                </div>
                <div className="grid gap-4 p-5 text-sm">
                  {p.fields.length ? (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-muted">{s.fields}</div>
                      <ul className="mt-2 grid gap-2.5">
                        {p.fields.map((f) => (
                          <li key={f.id}>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <span className="font-semibold">
                                {emoji(f.id)} {fieldName(f.id, locale)}
                              </span>
                              <span className="text-xs text-muted">{s.share(Math.round(f.share * 100))}</span>
                            </div>
                            {f.examples.length > 0 && (
                              <div className="mt-0.5 text-xs">
                                <span className="text-muted">{s.examples}: </span>
                                {f.examples.map((e) => `${t.results.kinds[e.kind] ?? e.kind} ${e.label}`).join(' · ')}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-muted">{s.nothing}</p>
                  )}
                  {p.terms.length > 0 && (
                    <p>
                      <span className="text-muted">{s.topics}: </span>
                      {p.terms.join(' · ')}
                    </p>
                  )}
                  {x.platform && (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-muted">{s.platform(fmtNumber(x.platform.n, intl))}</div>
                      <ul className="mt-2 grid gap-1">
                        {Object.entries(x.platform.topics)
                          .slice(0, 6)
                          .map(([g, share]) => (
                            <li key={g} className="flex items-center gap-2 text-xs">
                              <span className="w-28 shrink-0 truncate font-semibold">{s.ytGroups[g] ?? g}</span>
                              <span className="bar h-2 flex-1">
                                <span className="bg-accent" style={{ width: `${Math.round(share * 100)}%` }} />
                              </span>
                              <span className="w-9 shrink-0 text-right text-muted">{Math.round(share * 100)} %</span>
                            </li>
                          ))}
                      </ul>
                      <p className="mt-1.5 text-xs text-muted">{s.platformNote}</p>
                    </div>
                  )}
                  <div className="grid gap-1 text-xs text-muted">
                    {p.learning !== undefined && <span>📚 {s.learning(Math.round(p.learning * 100))}</span>}
                    {p.peakHour !== undefined && <span>🕘 {s.hours(p.peakHour, (p.peakHour + 3) % 24)}</span>}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
        {!unlocked && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="card max-w-md p-6 text-center">
              <div className="text-4xl" aria-hidden="true">🔒</div>
              <p className="mt-3 font-semibold">{s.locked}</p>
              {/* A teaser with real counts, nothing of the content. */}
              <ul className="mt-4 grid gap-1 text-left text-sm">
                {list.map((x) => {
                  const p = profiles.get(x.source)!
                  return (
                    <li key={x.source} className="flex justify-between gap-3">
                      <span className="font-semibold">{t.sourceNames[x.source] ?? x.label}</span>
                      <span className="text-muted">{s.teaser(p.fields.length, p.terms.length)}</span>
                    </li>
                  )
                })}
              </ul>
              <a href={`#${r.anchors.programmes}`} className="btn btn-primary mt-5">
                {t.results.lockedCta}
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/** Place 1 before the report is unlocked: the card's shape, nothing of its content. */
function LockedTop({ shared = false }: { shared?: boolean }) {
  const { t, r } = useSite()
  const bar = (w: string) => <span className="block h-3 rounded-full bg-surface-2" style={{ width: w }} />
  return (
    <section className="card pop-in relative mt-9 overflow-hidden">
      <div className="on-color relative flex flex-wrap items-center gap-4 border-b-2 border-line bg-yellow px-6 py-4 sm:px-10">
        <span className="sticker" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>🏆 {t.results.best}</span>
        <Burst className="spin-slow absolute -right-8 -top-8 hidden sm:block" size={110} color="var(--pink)" />
      </div>
      <div className="relative">
        <div className="grid select-none gap-10 p-6 blur-[6px] sm:p-10 lg:grid-cols-[1fr_20rem]" aria-hidden="true">
          <div>
            <div className="text-6xl">🎓</div>
            <div className="mt-4 h-14 w-4/5 rounded-2xl bg-accent-soft" />
            <div className="mt-5 grid gap-2.5">
              {bar('92%')}
              {bar('85%')}
              {bar('60%')}
            </div>
            <div className="mt-7 grid gap-3">
              {bar('70%')}
              {bar('64%')}
              {bar('76%')}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-24 w-24 rounded-full border-[6px] border-accent bg-lime" />
            {bar('100%')}
            {bar('90%')}
            {bar('80%')}
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="card max-w-md p-6 text-center sm:p-8">
            <div className="text-4xl" aria-hidden="true">🔒</div>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">{t.results.lockedTitle}</h2>
            <p className="mt-2 text-muted">{shared ? t.share.lockedText : t.results.lockedText}</p>
            {shared ? (
              <Link href={r.start} className="btn btn-primary mt-5">
                {t.share.own}
              </Link>
            ) : (
              <a href={`#${r.anchors.programmes}`} className="btn btn-primary mt-5">
                {t.results.lockedCta}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function FieldCard({ m, rank, stat, color }: { m: FieldMatch; rank: number; stat?: FieldStat; color: string }) {
  const k = useSite()
  const { t, r, locale, intl } = k
  const f = FIELD_BY_ID[m.id]
  const [open, setOpen] = useState(false)
  return (
    <article className="card card-pop flex flex-col overflow-hidden">
      <div className="on-color flex items-center justify-between border-b-2 border-line px-5 py-2.5" style={{ background: color }}>
        <span className="font-display text-xl">#{rank}</span>
        <span className="rounded-full border-2 border-line bg-surface px-2.5 py-0.5 text-sm font-extrabold text-ink">{t.results.matchPct(m.score)}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden="true">{emoji(m.id)}</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted">{groupLabel(f.group, locale)}</div>
            <h3 className="hyphens-auto break-words font-display text-2xl leading-tight">
              <Link href={r.field(m.id)} className="hover:text-accent">
                {fieldName(m.id, locale)}
              </Link>
            </h3>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">{m.reasons[0] ? reasonText(m.reasons[0], k) : fieldBlurb(m.id, locale)}</p>
        <div className="mt-4">
          <Contributions m={m} />
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="mt-4 self-start text-sm font-bold text-accent" aria-expanded={open}>
          {open ? t.results.less : t.results.why}
        </button>
        {open && (
          <div className="mt-3 grid gap-3 border-t-2 border-soft-line pt-3">
            <Components m={m} />
            <Evidence m={m} n={5} />
            {m.reasons.slice(1).map((x) => (
              <p key={x.k} className="text-xs text-muted">
                {reasonText(x, k)}
              </p>
            ))}
            {m.terms.length > 0 && (
              <p className="text-xs text-muted">
                {t.results.topics}: {m.terms.slice(0, 6).join(', ')}
              </p>
            )}
            <Earnings stat={stat} compact />
          </div>
        )}
      </div>
    </article>
  )
}

function ScoreRing({ value }: { value: number }) {
  const rad = 34
  const c = 2 * Math.PI * rad
  return (
    <svg width={92} height={92} viewBox="0 0 92 92" role="img" aria-label={`${value} / 100`}>
      <circle cx={46} cy={46} r={rad + 7} fill="var(--lime)" stroke="var(--line)" strokeWidth={2.5} />
      <circle cx={46} cy={46} r={rad - 1} fill="var(--surface)" stroke="var(--line)" strokeWidth={2} />
      <circle cx={46} cy={46} r={rad + 3} fill="none" stroke="var(--accent)" strokeWidth={6} strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c * 2}`} transform="rotate(-90 46 46)" />
      <text x={46} y={47} textAnchor="middle" dominantBaseline="central" fontSize={24} fontWeight={800} fill="var(--ink)">
        {value}
        <tspan fontSize={13}>%</tspan>
      </text>
    </svg>
  )
}
