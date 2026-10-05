'use client'

import { withBase } from '@/lib/site.ts'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '@/lib/store.ts'
import { score } from '@/lib/engine/scoring.ts'
import type { FieldMatch, Results, SourceSummary } from '@/lib/engine/types.ts'
import type { FieldStat } from '@/lib/programmes.ts'
import { BIG5_KEYS, FIELDS, FIELD_BY_ID, RIASEC_KEYS } from '@/lib/taxonomy/fields.ts'
import { isLocal } from '@/lib/site/config.ts'
import { big5Label, emoji, fieldBlurb, fieldCareers, fieldName, fmtMoney, fmtNumber, groupLabel, riasecLabel } from '@/lib/site/labels.ts'
import { insightText, reasonText } from '@/lib/site/explain.ts'
import { Hexagon } from '../ui/hexagon.tsx'
import { Programmes } from '../ui/programmes.tsx'
import { Burst, Sparkle } from '../ui/shapes.tsx'
import { useSite } from '../ui/site-context.tsx'

const CARD_COLORS = ['var(--pink)', 'var(--sky)', 'var(--lime)', 'var(--yellow)', 'var(--orange)', 'var(--violet)']
const BIG5_COLORS: Record<string, string> = { O: 'var(--pink)', C: 'var(--sky)', E: 'var(--yellow)', A: 'var(--lime)', N: 'var(--orange)' }

export function ResultsView() {
  const k = useSite()
  const { t, r, locale, intl } = k
  const state = useAppState()
  const [stats, setStats] = useState<Record<string, FieldStat>>({})
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    fetch(withBase('/api/stats'))
      .then((res) => res.json())
      .then((j: { stats: Record<string, FieldStat> }) => setStats(j.stats ?? {}))
      .catch(() => {})
  }, [])

  const summaries = Object.values(state.summaries).filter(Boolean) as SourceSummary[]
  const results = useMemo<Results | null>(() => {
    if (!mounted) return null
    const fieldStats = Object.fromEntries(Object.entries(stats).map(([id, s]) => [id, { salaryPercentile: s.salaryPercentile }]))
    return score({ summaries, answers: state.answers, fieldStats })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, state, stats])

  if (!mounted || !results) return <div className="animate-soft mx-auto max-w-6xl px-4 py-24 font-display text-3xl text-muted sm:px-6">{t.results.calculating}</div>

  const hasInput = summaries.length > 0 || Object.keys(state.answers.riasec ?? {}).length >= 6
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
  // Place 1 belongs to the paid report; the other places stay free.
  const unlocked = !!state.unlock && state.unlock.expiresAt > Date.now()
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
          <Link href={r.start} className="btn btn-ghost btn-sm">
            + {t.results.addMore}
          </Link>
        </div>
      </div>

      {unlocked ? <TopMatch m={first} stat={stats[first.id]} /> : <LockedTop />}

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
          {results.big5 ? (
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
          <ol className="mt-6 grid gap-3">
            {results.timeline.map((y) => (
              <li key={y.year} className="grid grid-cols-[4rem_1fr] items-center gap-3">
                <span className="font-display text-xl">{y.year}</span>
                <div className="flex flex-wrap gap-2">
                  {y.fields.map((f) =>
                    f.id === first.id && !unlocked ? (
                      <span key={f.id} className="chip">
                        🔒 {t.results.lockedChip}
                      </span>
                    ) : (
                      <span key={f.id} className="chip">
                        <span aria-hidden="true">{emoji(f.id)}</span> {fieldName(f.id, locale)}
                      </span>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Programmes results={results} prefs={state.prefs} />
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

function Evidence({ m, n }: { m: FieldMatch; n: number }) {
  const { t } = useSite()
  if (!m.evidence.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {m.evidence.slice(0, n).map((e) => (
        <li key={e.label} className="chip-soft max-w-full truncate" title={`${e.label} (${t.sourceNames[e.source] ?? e.source})`}>
          <span className="text-muted">{t.results.kinds[e.kind] ?? e.kind}:</span>&nbsp;{e.label}
        </li>
      ))}
    </ul>
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
                  ✓
                </span>
                {reasonText(x, k)}
              </li>
            ))}
          </ul>
          <div className="mt-6">
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
          {stat?.usMedianEarnings && !isLocal(k.site) && (
            <div className="text-sm">
              <div className="font-bold">{t.results.usEarnings}</div>
              <div className="text-muted">{fmtMoney(stat.usMedianEarnings, 'USD', intl)}</div>
            </div>
          )}
          <Link href={r.field(m.id)} className="btn btn-ghost btn-sm max-w-full self-start">
            {t.results.more}
          </Link>
        </div>
      </div>
    </section>
  )
}

/** Place 1 before the report is unlocked: the card's shape, nothing of its content. */
function LockedTop() {
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
            <p className="mt-2 text-muted">{t.results.lockedText}</p>
            <a href={`#${r.anchors.programmes}`} className="btn btn-primary mt-5">
              {t.results.lockedCta}
            </a>
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
        <span className="rounded-full border-2 border-line bg-surface px-2.5 py-0.5 text-sm font-extrabold text-ink">{m.score}</span>
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
        <div className="mt-3">
          <Evidence m={m} n={3} />
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="mt-4 self-start text-sm font-bold text-accent" aria-expanded={open}>
          {open ? t.results.less : t.results.why}
        </button>
        {open && (
          <div className="mt-3 grid gap-3 border-t-2 border-soft-line pt-3">
            <Components m={m} />
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
            {stat?.usMedianEarnings && !isLocal(k.site) && (
              <p className="text-xs text-muted">
                {t.results.usEarnings}: {fmtMoney(stat.usMedianEarnings, 'USD', intl)}
              </p>
            )}
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
      <text x={46} y={47} textAnchor="middle" dominantBaseline="central" fontSize={26} fontWeight={800} fill="var(--ink)">
        {value}
      </text>
    </svg>
  )
}
