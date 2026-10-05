'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '@/lib/store.ts'
import { score } from '@/lib/engine/scoring.ts'
import type { FieldMatch, Results, SourceSummary } from '@/lib/engine/types.ts'
import type { FieldStat } from '@/lib/programmes.ts'
import { BIG5_KEYS, BIG5_LABELS, FIELD_BY_ID, GROUP_LABELS, RIASEC_KEYS, RIASEC_LABELS } from '@/lib/taxonomy/fields.ts'
import { Hexagon } from '../components/hexagon.tsx'
import { Programmes } from '../components/programmes.tsx'

const SOURCE_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  takeout: 'Google Takeout',
  spotify: 'Spotify',
  'spotify-export': 'Spotify export',
  reddit: 'Reddit',
  github: 'GitHub',
  questionnaire: 'Questionnaire',
}

const KIND_LABEL: Record<string, string> = {
  subscription: 'subscribed',
  like: 'liked',
  watch: 'watched',
  search: 'searched',
  comment: 'commented',
  playlist: 'playlist',
  upload: 'your video',
  podcast: 'podcast',
  episode: 'episode',
  book: 'audiobook',
  subreddit: 'community',
  saved: 'saved',
  upvote: 'upvoted',
  post: 'your post',
  repo: 'your repo',
  fork: 'fork',
  star: 'starred',
  bio: 'bio',
}

export function ResultsClient() {
  const state = useAppState()
  const [stats, setStats] = useState<Record<string, FieldStat>>({})
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    fetch('/api/stats')
      .then((r) => r.json())
      .then((j: { stats: Record<string, FieldStat> }) => setStats(j.stats ?? {}))
      .catch(() => {})
  }, [])

  const summaries = Object.values(state.summaries).filter(Boolean) as SourceSummary[]
  const results = useMemo<Results | null>(() => {
    if (!mounted) return null
    const fieldStats = Object.fromEntries(Object.entries(stats).map(([id, s]) => [id, { salaryPercentile: s.salaryPercentile }]))
    return score({ summaries, answers: state.answers, fieldStats })
  }, [mounted, state, stats])

  if (!mounted || !results) return <div className="mx-auto max-w-6xl px-4 py-24 text-muted sm:px-6">Calculating…</div>

  const hasInput = summaries.length > 0 || Object.keys(state.answers.riasec ?? {}).length >= 6
  if (!hasInput) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl">Nothing to analyse yet</h1>
        <p className="mt-4 text-muted">Connect a source or answer part of the questionnaire first.</p>
        <Link href="/start" className="mt-8 inline-block rounded-full bg-accent px-6 py-3 font-medium text-accent-ink">
          Start
        </Link>
      </div>
    )
  }

  const [first, ...rest] = results.fields
  const top = rest.slice(0, 9)

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {results.dataPoints.toLocaleString('en')} signals from {results.sources.map((s) => SOURCE_NAMES[s.id] ?? s.label).join(', ') || 'your answers'}
          </p>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl">Your result</h1>
        </div>
        <div className="flex items-center gap-3">
          <Confidence level={results.confidence} />
          <Link href="/start" className="rounded-full border border-line px-4 py-2 text-sm hover:border-ink/40">
            Add more data
          </Link>
        </div>
      </div>

      <TopMatch m={first} stat={stats[first.id]} />

      <section className="mt-12">
        <h2 className="font-display text-2xl sm:text-3xl">Your next best fields</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {top.map((m, i) => (
            <FieldCard key={m.id} m={m} rank={i + 2} stat={stats[m.id]} />
          ))}
        </div>
      </section>

      {results.hidden.length > 0 && (
        <section className="mt-12 rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl sm:text-3xl">Hidden matches</h2>
          <p className="mt-2 text-muted">Fields you barely touch online, but your interests, personality and subjects fit them. Worth a look.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {results.hidden.map((m) => {
              const f = FIELD_BY_ID[m.id]
              return (
                <Link key={m.id} href={`/fields/${m.id}`} className="rounded-2xl bg-surface-2 p-5 hover:ring-1 hover:ring-accent/40">
                  <div className="text-xs uppercase tracking-wider text-muted">{GROUP_LABELS[f.group]}</div>
                  <div className="mt-1 font-semibold">{f.name}</div>
                  <p className="mt-2 text-sm text-muted">{m.reasons.slice(1, 3).join(' ') || f.blurb}</p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-12 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl">Interest profile</h2>
          <p className="mt-1 text-sm text-muted">
            Holland’s RIASEC types, from {results.riasec.from.join(' and ') || 'your data'}. Your code: <strong className="text-ink">{results.riasec.code}</strong>
          </p>
          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
            <Hexagon profile={results.riasec.profile} />
            <ul className="grid gap-2 text-sm">
              {RIASEC_KEYS.map((k, i) => (
                <li key={k} className={results.riasec.code.includes(k) ? '' : 'text-muted'}>
                  <span className="inline-block w-6 font-semibold">{k}</span>
                  {RIASEC_LABELS[k].name} <span className="text-muted">· {Math.round(results.riasec.profile[i] * 100)}</span>
                  {results.riasec.code.includes(k) && <div className="ml-6 text-xs text-muted">{RIASEC_LABELS[k].short}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl">Personality</h2>
          {results.big5 ? (
            <>
              <p className="mt-1 text-sm text-muted">
                Big Five, compared with people your age.{' '}
                {results.big5.from.includes('questionnaire') ? 'From your questionnaire.' : 'Estimated from your music taste only: a weak signal, take it lightly.'}
              </p>
              <ul className="mt-5 grid gap-4">
                {BIG5_KEYS.map((k) => {
                  const z = results.big5!.z[k] ?? 0
                  const pct = Math.round(100 / (1 + Math.exp(-1.7 * z)))
                  return (
                    <li key={k}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{BIG5_LABELS[k].name}</span>
                        <span className="text-muted">{pct}th percentile</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-surface-2">
                        <div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-xs text-muted">{z > 0.5 ? BIG5_LABELS[k].high : z < -0.5 ? BIG5_LABELS[k].low : 'In the middle'}</div>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-muted">
              Answer the 20 personality questions (2 minutes) to include it.{' '}
              <Link href="/start#questionnaire" className="text-accent underline">
                Add it
              </Link>
            </p>
          )}
        </div>
      </section>

      {results.insights.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl sm:text-3xl">What your data says</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.insights.map((ins) => (
              <div key={ins.id} className="rounded-2xl border border-line bg-surface p-5">
                <div className="text-xs uppercase tracking-wider text-muted">{ins.title}</div>
                <div className="mt-1 font-display text-3xl">{ins.value}</div>
                <p className="mt-2 text-sm text-muted">{ins.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {results.timeline.length >= 2 && (
        <section className="mt-12 rounded-3xl border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl">How your interests moved</h2>
          <p className="mt-1 text-sm text-muted">The fields that stood out most each year, against what everyone watches.</p>
          <ol className="mt-6 grid gap-3">
            {results.timeline.map((y) => (
              <li key={y.year} className="grid grid-cols-[3.5rem_1fr] items-center gap-3">
                <span className="font-semibold">{y.year}</span>
                <div className="flex flex-wrap gap-2">
                  {y.fields.map((f) => (
                    <span key={f.id} className="rounded-full bg-surface-2 px-3 py-1 text-sm">
                      {FIELD_BY_ID[f.id]?.name}
                    </span>
                  ))}
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
  const text = { low: 'Low confidence: add a source or the questionnaire', medium: 'Medium confidence', high: 'High confidence' }[level]
  const color = { low: 'text-warn', medium: 'text-accent', high: 'text-good' }[level]
  return (
    <span className={`rounded-full border border-line bg-surface px-3 py-1.5 text-sm ${color}`} title="Based on how much data and how many kinds of input the result rests on">
      ● {text}
    </span>
  )
}

function Components({ m }: { m: FieldMatch }) {
  const labels: Record<string, string> = {
    interest: 'What you engage with',
    riasec: 'Interest type fit',
    personality: 'Personality fit',
    subjects: 'School subjects',
    values: 'Your priorities',
  }
  return (
    <ul className="grid gap-2">
      {Object.entries(m.components).map(([k, v]) => (
        <li key={k} className="grid grid-cols-[9.5rem_1fr_2rem] items-center gap-2 text-xs">
          <span className="text-muted">{labels[k]}</span>
          <div className="h-1.5 rounded-full bg-surface-2">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((v ?? 0) * 100)}%` }} />
          </div>
          <span className="text-right text-muted">{Math.round((v ?? 0) * 100)}</span>
        </li>
      ))}
    </ul>
  )
}

function Evidence({ m, n }: { m: FieldMatch; n: number }) {
  if (!m.evidence.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {m.evidence.slice(0, n).map((e) => (
        <li key={e.label} className="max-w-full truncate rounded-full bg-surface-2 px-2.5 py-1 text-xs" title={`${e.label} (${SOURCE_NAMES[e.source]})`}>
          <span className="text-muted">{KIND_LABEL[e.kind] ?? e.kind}:</span> {e.label}
        </li>
      ))}
    </ul>
  )
}

function TopMatch({ m, stat }: { m: FieldMatch; stat?: FieldStat }) {
  const f = FIELD_BY_ID[m.id]
  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_20rem]">
        <div>
          <div className="text-sm text-muted">Your best match · {GROUP_LABELS[f.group]}</div>
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">{f.name}</h2>
          <p className="mt-4 max-w-2xl text-lg text-muted">{f.blurb}</p>
          <ul className="mt-6 grid gap-2">
            {m.reasons.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-good">✓</span> {r}
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
            <div className="text-sm text-muted">match, relative to all {Object.keys(FIELD_BY_ID).length} fields</div>
          </div>
          <Components m={m} />
          <div className="text-sm">
            <div className="text-muted">Leads to</div>
            <div>{f.careers.slice(0, 4).join(' · ')}</div>
          </div>
          {stat?.usMedianEarnings && (
            <div className="text-sm">
              <div className="text-muted">US median earnings, 1 year after a bachelor’s</div>
              <div>${Math.round(stat.usMedianEarnings).toLocaleString('en')}</div>
            </div>
          )}
          <Link href={`/fields/${m.id}`} className="text-sm text-accent underline-offset-2 hover:underline">
            More about {f.name} →
          </Link>
        </div>
      </div>
    </section>
  )
}

function FieldCard({ m, rank, stat }: { m: FieldMatch; rank: number; stat?: FieldStat }) {
  const f = FIELD_BY_ID[m.id]
  const [open, setOpen] = useState(false)
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted">
            #{rank} · {GROUP_LABELS[f.group]}
          </div>
          <h3 className="mt-0.5 text-lg font-semibold leading-snug">
            <Link href={`/fields/${m.id}`} className="hover:text-accent">
              {f.name}
            </Link>
          </h3>
        </div>
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-semibold text-accent">{m.score}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{m.reasons[0] ?? f.blurb}</p>
      <div className="mt-3">
        <Evidence m={m} n={3} />
      </div>
      <button type="button" onClick={() => setOpen(!open)} className="mt-4 self-start text-xs text-accent">
        {open ? 'Less' : 'Why?'}
      </button>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-line pt-3">
          <Components m={m} />
          {m.reasons.slice(1).map((r) => (
            <p key={r} className="text-xs text-muted">
              {r}
            </p>
          ))}
          {m.terms.length > 0 && <p className="text-xs text-muted">Topics we matched: {m.terms.slice(0, 6).join(', ')}</p>}
          {stat?.usMedianEarnings && <p className="text-xs text-muted">US median earnings after a bachelor’s: ${Math.round(stat.usMedianEarnings).toLocaleString('en')}</p>}
        </div>
      )}
    </article>
  )
}

function ScoreRing({ value }: { value: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg width={84} height={84} viewBox="0 0 84 84" role="img" aria-label={`Match ${value} of 100`}>
      <circle cx={42} cy={42} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={8} />
      <circle cx={42} cy={42} r={r} fill="none" stroke="var(--accent)" strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 42 42)" />
      <text x={42} y={42} textAnchor="middle" dominantBaseline="central" fontSize={22} fontWeight={700} fill="var(--ink)">
        {value}
      </text>
    </svg>
  )
}
