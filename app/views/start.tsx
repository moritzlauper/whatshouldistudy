'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { clearAll, removeSummary, setSummary, useAppState } from '@/lib/store.ts'
import type { SourceId, SourceSummary } from '@/lib/engine/types.ts'
import { getToken, isConfigured, startAuth } from '@/lib/sources/oauth.ts'
import type { Provider } from '@/lib/sources/oauth.ts'
import { readExports } from '@/lib/sources/exports.ts'
import { fetchChannels } from '@/lib/sources/youtube.ts'
import { collectGitHub } from '@/lib/sources/github.ts'
import { questionnaireProgress } from '@/lib/engine/questionnaire.ts'
import { fmtNumber } from '@/lib/site/labels.ts'
import { Questionnaire } from '../ui/questionnaire.tsx'
import { PrefsForm } from '../ui/prefs-form.tsx'
import { useSite } from '../ui/site-context.tsx'

type Running = { source: string; message: string; count?: number } | null

export function StartView() {
  const { t, r, intl } = useSite()
  const state = useAppState()
  const [running, setRunning] = useState<Running>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const summaries = Object.values(state.summaries).filter(Boolean) as SourceSummary[]
  const signals = summaries.reduce((s, x) => s + x.dataPoints, 0)
  const q = questionnaireProgress(state.answers)
  const ready = summaries.length > 0 || q.done >= 18

  const fail = (id: string, e: unknown) => setErrors((x) => ({ ...x, [id]: t.tr((e as Error).message || t.callback.generic) }))
  const progress = (source: string) => (message: string, count?: number) => setRunning({ source, message: t.tr(message), count })

  async function connect(p: Provider) {
    setErrors((x) => ({ ...x, [p]: '' }))
    try {
      await startAuth(p)
    } catch (e) {
      fail(p, e)
    }
  }

  async function onFiles(files: File[]) {
    if (!files.length) return
    setErrors((x) => ({ ...x, takeout: '' }))
    try {
      let result = await readExports(files, progress('takeout'))
      // With a YouTube sign-in in this tab, add descriptions of the channels you watch most.
      const token = getToken('google')
      if (token && result.topChannelIds.length) {
        try {
          const channels = await fetchChannels(result.topChannelIds.slice(0, 200), token, progress('takeout'))
          result = result.rebuild(channels)
        } catch {
          // Optional enrichment.
        }
      }
      if (!result.summaries.length) throw new Error(t.start.noHistory)
      for (const s of result.summaries) setSummary(s)
      setNotes(result.recognised.map(t.tr))
    } catch (e) {
      fail('takeout', e)
    } finally {
      setRunning(null)
    }
  }

  async function github(username: string) {
    setErrors((x) => ({ ...x, github: '' }))
    try {
      setSummary(await collectGitHub(username, progress('github')))
    } catch (e) {
      fail('github', e)
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-36 pt-12 sm:px-6">
      <h1 className="font-display text-5xl sm:text-6xl">
        <span className="hl">{t.start.title}</span>
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">{t.start.lead}</p>

      <section id={r.anchors.sources} className="mt-14 scroll-mt-24">
        <StepTitle n={1} color="var(--pink)" title={t.start.step1} sub={t.start.step1sub} />
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <OAuthCard id="youtube" provider="google" title="YouTube" glyph="▶" color="var(--pink)" text={t.start.yt} summary={state.summaries.youtube} error={errors.google} onConnect={() => connect('google')} mounted={mounted} />
          <TakeoutCard summary={state.summaries.takeout} spotifyExport={state.summaries['spotify-export']} running={running?.source === 'takeout' ? running : null} error={errors.takeout} notes={notes} onFiles={onFiles} />
          <OAuthCard id="spotify" provider="spotify" title="Spotify" glyph="🎧" color="var(--lime)" text={t.start.spotify} summary={state.summaries.spotify} error={errors.spotify} onConnect={() => connect('spotify')} mounted={mounted} />
          <OAuthCard id="reddit" provider="reddit" title="Reddit" glyph="👽" color="var(--orange)" text={t.start.reddit} summary={state.summaries.reddit} error={errors.reddit} onConnect={() => connect('reddit')} mounted={mounted} />
          <GitHubCard summary={state.summaries.github} running={running?.source === 'github' ? running : null} error={errors.github} onSubmit={github} />
        </div>
      </section>

      <section id={r.anchors.questionnaire} className="mt-20 scroll-mt-24">
        <StepTitle n={2} color="var(--sky)" title={t.start.step2} sub={t.start.step2sub} />
        <div className="mt-7">
          <Questionnaire />
        </div>
      </section>

      <section id={r.anchors.prefs} className="mt-20 scroll-mt-24">
        <StepTitle n={3} color="var(--lime)" title={t.start.step3} sub={t.start.step3sub} />
        <div className="mt-7">
          <PrefsForm />
        </div>
      </section>

      <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t-2 border-line pt-6 text-sm text-muted">
        <span>🔒 {t.start.localOnly}</span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t.start.deleteConfirm)) clearAll()
          }}
          className="btn btn-ghost btn-sm hover:text-bad"
        >
          {t.start.deleteAll}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 text-sm">
            <span className="chip">
              <span className="font-display text-base">{mounted ? fmtNumber(signals, intl) : '0'}</span> {t.start.signals}
            </span>
            <span className="chip">
              <span className="font-display text-base">{mounted ? q.done : 0}</span>/{q.total} {t.start.answers}
            </span>
          </div>
          {mounted && ready ? (
            <Link href={r.results} className="btn btn-primary">
              {t.start.seeResult}
            </Link>
          ) : (
            <span className="hidden rounded-full border-2 border-dashed border-soft-line px-5 py-2.5 text-sm text-muted sm:inline-block">{t.start.needMore}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function StepTitle({ n, title, sub, color }: { n: number; title: string; sub: string; color: string }) {
  return (
    <div className="flex gap-4">
      <span className="on-color flex h-12 w-12 shrink-0 rotate-[-6deg] items-center justify-center rounded-2xl border-2 border-line font-display text-2xl" style={{ background: color, boxShadow: '3px 3px 0 var(--shadow)' }}>
        {n}
      </span>
      <div>
        <h2 className="font-display text-3xl sm:text-4xl">{title}</h2>
        <p className="mt-1.5 text-muted">{sub}</p>
      </div>
    </div>
  )
}

function Connected({ summary, onRemove }: { summary: SourceSummary; onRemove: () => void }) {
  const { t, intl } = useSite()
  const stats = Object.entries(summary.stats).filter(([, v]) => v !== 0 && v !== '—')
  return (
    <div className="mt-4 rounded-2xl border-2 border-line bg-surface-2 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-good">✓ {t.start.signalsRead(fmtNumber(summary.dataPoints, intl))}</span>
        <button type="button" onClick={onRemove} className="text-xs font-semibold text-muted underline-offset-2 hover:text-bad hover:underline">
          {t.start.remove}
        </button>
      </div>
      {stats.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {stats
            .slice(0, 6)
            .map(([k, v]) => `${typeof v === 'number' ? fmtNumber(v, intl) : v} ${t.stats[k] ?? k}`)
            .join(' · ')}
        </p>
      )}
      {summary.notes?.map((n) => (
        <p key={n} className="mt-2 text-xs text-warn">
          {t.tr(n)}
        </p>
      ))}
    </div>
  )
}

function Card({ title, text, glyph, color, badge, children }: { title: string; text: string; glyph: string; color: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="on-color flex items-center justify-between gap-3 border-b-2 border-line px-5 py-3.5" style={{ background: color }}>
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-line bg-surface text-lg text-ink" aria-hidden="true">
            {glyph}
          </span>
          <h3 className="font-display text-2xl">{title}</h3>
        </span>
        {badge && <span className="sticker" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>★ {badge}</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm text-muted">{text}</p>
        <div className="mt-auto">{children}</div>
      </div>
    </div>
  )
}

function RunningLine({ running }: { running: NonNullable<Running> }) {
  const { intl } = useSite()
  return (
    <p className="animate-soft mt-4 text-sm font-semibold text-accent">
      {running.message}
      {running.count !== undefined ? ` · ${fmtNumber(running.count, intl)}` : ''}
    </p>
  )
}

function OAuthCard(props: { id: SourceId; provider: Provider; title: string; glyph: string; color: string; text: string; summary?: SourceSummary; error?: string; onConnect: () => void; mounted: boolean }) {
  const { t } = useSite()
  const configured = props.mounted && isConfigured(props.provider)
  return (
    <Card title={props.title} text={props.text} glyph={props.glyph} color={props.color}>
      {props.summary && <Connected summary={props.summary} onRemove={() => removeSummary(props.id)} />}
      {props.error && <p className="mt-3 text-sm font-semibold text-bad">{props.error}</p>}
      <div className="mt-4">
        {configured ? (
          <button type="button" onClick={props.onConnect} className="btn btn-ink btn-sm">
            {props.summary ? t.start.refresh : t.start.connect(props.title)}
          </button>
        ) : (
          <p className="text-xs text-muted">
            {props.mounted ? t.start.notConfigured(props.title) : ''}
            {props.id === 'youtube' && props.mounted && t.start.takeoutInstead}
          </p>
        )}
      </div>
    </Card>
  )
}

function TakeoutCard({ summary, spotifyExport, running, error, notes, onFiles }: { summary?: SourceSummary; spotifyExport?: SourceSummary; running: Running; error?: string; notes: string[]; onFiles: (files: File[]) => void }) {
  const { t } = useSite()
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  return (
    <Card title={t.start.exportsTitle} text={t.start.exportsText} glyph="📦" color="var(--yellow)" badge={t.start.best}>
      {summary && <Connected summary={summary} onRemove={() => removeSummary('takeout')} />}
      {spotifyExport && <Connected summary={spotifyExport} onRemove={() => removeSummary('spotify-export')} />}
      {running && <RunningLine running={running} />}
      {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}
      {notes.length > 0 && (
        <ul className="mt-3 text-xs text-muted">
          {notes.map((n) => (
            <li key={n}>✓ {n}</li>
          ))}
        </ul>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          onFiles([...e.dataTransfer.files])
        }}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') input.current?.click()
        }}
        role="button"
        tabIndex={0}
        className={`mt-4 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${drag ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}
      >
        <span className="block text-2xl" aria-hidden="true">⤓</span>
        <span className="font-bold">{t.start.drop}</span>
        <span className="block text-xs text-muted">{t.start.dropSub}</span>
        <input ref={input} type="file" multiple accept=".zip,.json,.html,.csv" className="hidden" onChange={(e) => onFiles([...(e.target.files ?? [])])} />
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-accent">{t.start.takeoutHow}</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          {t.start.takeoutSteps.map((s, i) => (
            <li key={s}>
              {i === 0 ? (
                <a className="underline" href="https://takeout.google.com/settings/takeout/custom/youtube" target="_blank" rel="noreferrer">
                  {s}
                </a>
              ) : (
                s
              )}
            </li>
          ))}
        </ol>
      </details>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-semibold text-accent">{t.start.spotifyHow}</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          {t.start.spotifySteps.map((s, i) => (
            <li key={s}>
              {i === 0 ? (
                <a className="underline" href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer">
                  {s}
                </a>
              ) : (
                s
              )}
            </li>
          ))}
        </ol>
      </details>
    </Card>
  )
}

function GitHubCard({ summary, running, error, onSubmit }: { summary?: SourceSummary; running: Running; error?: string; onSubmit: (u: string) => void }) {
  const { t } = useSite()
  const [name, setName] = useState('')
  return (
    <Card title="GitHub" text={t.start.github} glyph="🐙" color="var(--sky)">
      {summary && <Connected summary={summary} onRemove={() => removeSummary('github')} />}
      {running && <RunningLine running={running} />}
      {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onSubmit(name)
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.start.githubPlaceholder} aria-label="GitHub username" className="input rounded-full" />
        <button type="submit" className="btn btn-ink btn-sm">
          {summary ? t.start.refresh : t.start.add}
        </button>
      </form>
    </Card>
  )
}
