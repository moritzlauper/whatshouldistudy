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
import { GitHubMark } from '../ui/trust.tsx'
import { SOURCE_URL } from '@/lib/site.ts'

type Running = { source: string; message: string; count?: number } | null

export function StartView() {
  const { t, r, intl, site, base } = useSite()
  const state = useAppState()
  const [running, setRunning] = useState<Running>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string[]>>({})
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
      await startAuth(p, { site, base })
    } catch (e) {
      fail(p, e)
    }
  }

  /** Every export card reads any export; the card only decides where progress and notes show. */
  async function onFiles(files: File[], card: string) {
    if (!files.length) return
    setErrors((x) => ({ ...x, [card]: '' }))
    try {
      let result = await readExports(files, progress(card))
      // With a YouTube sign-in in this tab, add descriptions of the channels you watch most.
      const token = getToken('google')
      if (token && result.topChannelIds.length) {
        try {
          const channels = await fetchChannels(result.topChannelIds.slice(0, 200), token, progress(card))
          result = result.rebuild(channels)
        } catch {
          // Optional enrichment.
        }
      }
      if (!result.summaries.length && result.takeoutExport?.files) {
        throw new Error(t.start.takeoutPartMissing(fmtNumber(result.takeoutExport.files, intl)))
      }
      if (!result.summaries.length) {
        const skipped = result.skipped.length ? ` ${t.start.unread(result.skipped.length, result.skipped.slice(0, 3).join(', '))}` : ''
        throw new Error((result.takeoutProducts ? t.start.emptyTakeout(result.takeoutProducts.filter((x) => x !== '?').join(', ')) : t.start.noHistory) + skipped)
      }
      for (const s of result.summaries) setSummary(s)
      setNotes((n) => ({ ...n, [card]: result.recognised.map(t.tr) }))
    } catch (e) {
      fail(card, e)
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
      <div className="card-sm mt-6 flex max-w-3xl flex-col gap-3 bg-surface-2 p-5 sm:flex-row sm:items-center">
        <span className="text-3xl" aria-hidden="true">🔒</span>
        <p className="flex-1 text-sm">
          <strong>{t.trust.nothingStored}.</strong> {t.trust.startNote}{' '}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-accent underline">
            <GitHubMark size={14} /> {t.trust.viewCode}
          </a>
        </p>
      </div>

      <section id={r.anchors.sources} className="mt-14 scroll-mt-24">
        <StepTitle n={1} color="var(--pink)" title={t.start.step1} sub={t.start.step1sub} />
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <ExportCard
            title="YouTube & Google"
            glyph="▶"
            color="var(--pink)"
            badge={t.start.best}
            text={t.start.yt}
            summaries={[state.summaries.takeout, state.summaries['google-search'], state.summaries.youtube]}
            requests={[{ href: 'https://takeout.google.com/settings/takeout/custom/my_activity', label: t.start.request.youtube }]}
            hint={t.start.hint.takeout}
            running={running?.source === 'takeout' ? running : null}
            error={errors.takeout || errors.google}
            notes={notes.takeout}
            onFiles={(f) => onFiles(f, 'takeout')}
            footer={
              mounted && isConfigured('google') ? (
                <p className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-soft-line pt-4 text-xs text-muted">
                  {t.start.ytLogin}
                  <button type="button" onClick={() => connect('google')} className="btn btn-ghost btn-sm">
                    {state.summaries.youtube ? t.start.refresh : t.start.connect('YouTube')}
                  </button>
                </p>
              ) : null
            }
          />
          <ExportCard
            title="Instagram"
            glyph="📸"
            color="var(--violet)"
            badge={t.start.best}
            text={t.start.instagram}
            summaries={[state.summaries.instagram]}
            requests={[{ href: 'https://accountscenter.instagram.com/info_and_permissions/dyi/', label: t.start.request.instagram }]}
            hint={t.start.hint.instagram}
            running={running?.source === 'instagram' ? running : null}
            error={errors.instagram}
            notes={notes.instagram}
            onFiles={(f) => onFiles(f, 'instagram')}
          />
          <ExportCard
            title="TikTok"
            glyph="🎵"
            color="var(--sky)"
            badge={t.start.best}
            text={t.start.tiktok}
            summaries={[state.summaries.tiktok]}
            requests={[{ href: 'https://www.tiktok.com/setting/download-your-data', label: t.start.request.tiktok }]}
            hint={t.start.hint.tiktok}
            running={running?.source === 'tiktok' ? running : null}
            error={errors.tiktok}
            notes={notes.tiktok}
            onFiles={(f) => onFiles(f, 'tiktok')}
          />
          <OAuthCard id="reddit" provider="reddit" title="Reddit" glyph="👽" color="var(--orange)" text={t.start.reddit} summary={state.summaries.reddit} error={errors.reddit} onConnect={() => connect('reddit')} mounted={mounted} />
          <GitHubCard wide summary={state.summaries.github} running={running?.source === 'github' ? running : null} error={errors.github} onSubmit={github} />
        </div>
        <SpotifyRow
          summaries={[state.summaries['spotify-export'], state.summaries.spotify]}
          running={running?.source === 'spotify' ? running : null}
          error={errors.spotify}
          notes={notes.spotify}
          onFiles={(f) => onFiles(f, 'spotify')}
          onConnect={mounted && isConfigured('spotify') ? () => connect('spotify') : undefined}
        />
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <span className="chip whitespace-nowrap">
              <span className="font-display text-base">{mounted ? fmtNumber(signals, intl) : '0'}</span> {t.start.signals}
            </span>
            <span className="chip whitespace-nowrap max-sm:hidden">
              <span className="font-display text-base">{mounted ? q.done : 0}</span>/{q.total} {t.start.answers}
            </span>
          </div>
          {mounted && ready ? (
            <Link href={r.results} className="btn btn-primary shrink-0 whitespace-nowrap">
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
        <span>
          <span className="block text-xs font-extrabold uppercase tracking-wider text-muted">{t.sourceNames[summary.source] ?? summary.label}</span>
          <span className="font-bold text-good">✓ {t.start.signalsRead(fmtNumber(summary.dataPoints, intl))}</span>
        </span>
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

function Card({ title, text, glyph, color, badge, children, className }: { title: string; text: string; glyph: string; color: string; badge?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card flex flex-col overflow-hidden ${className ?? ''}`}>
      <div className="on-color flex items-center justify-between gap-3 border-b-2 border-line px-5 py-3.5" style={{ background: color }}>
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-line bg-surface text-lg text-ink" aria-hidden="true">
            {glyph}
          </span>
          <h3 className="font-display text-2xl">{title}</h3>
        </span>
        {badge && <span className="sticker shrink-0 whitespace-nowrap" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>★ {badge}</span>}
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
          </p>
        )}
      </div>
    </Card>
  )
}

/** A data download: one button to the page where you request it, then a place to drop it. */
function ExportCard(props: {
  title: string
  glyph: string
  color: string
  text: string
  badge?: string
  summaries: Array<SourceSummary | undefined>
  requests: Array<{ href: string; label: string }>
  hint: string
  running: Running
  error?: string
  notes?: string[]
  onFiles: (files: File[]) => void
  children?: React.ReactNode
  /** Below the steps, e.g. the optional sign-in. */
  footer?: React.ReactNode
}) {
  const { t } = useSite()
  // Once the file is in (the first summary), the steps fold away.
  const done = !!props.summaries[0]
  const steps = (
    <div className="mt-5 grid gap-4">
      <div className="flex gap-3">
        <StepDot n={1} />
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            {props.requests.map((q) => (
              <a key={q.href} href={q.href} target="_blank" rel="noreferrer" className="btn btn-ink btn-sm">
                {q.label} ↗
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{props.hint}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <StepDot n={2} />
        <DropZone onFiles={props.onFiles} />
      </div>
    </div>
  )
  return (
    <Card title={props.title} text={props.text} glyph={props.glyph} color={props.color} badge={props.badge}>
      {props.summaries.map((x) => x && <Connected key={x.source} summary={x} onRemove={() => removeSummary(x.source)} />)}
      {props.children}
      {done ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-accent">{t.start.addAnother}</summary>
          {steps}
        </details>
      ) : (
        steps
      )}
      {props.running && <RunningLine running={props.running} />}
      {props.error && <p className="mt-3 text-sm font-semibold text-bad">{props.error}</p>}
      {props.notes && props.notes.length > 0 && (
        <ul className="mt-3 text-xs text-muted">
          {props.notes.map((n) => (
            <li key={n}>✓ {n}</li>
          ))}
        </ul>
      )}
      {props.footer}
    </Card>
  )
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-line bg-surface text-sm font-extrabold" aria-hidden="true">
      {n}
    </span>
  )
}

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { t } = useSite()
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  return (
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
      className={`min-w-0 flex-1 cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition ${drag ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}
    >
      <span className="block text-xl" aria-hidden="true">⤓</span>
      <span className="text-sm font-bold">{t.start.drop}</span>
      <span className="block text-xs text-muted">{t.start.dropSub}</span>
      <input ref={input} type="file" multiple accept=".zip,.json,.html,.csv,.txt" className="hidden" onChange={(e) => onFiles([...(e.target.files ?? [])])} />
    </div>
  )
}

function GitHubCard({ summary, running, error, onSubmit, wide }: { summary?: SourceSummary; running: Running; error?: string; onSubmit: (u: string) => void; wide?: boolean }) {
  const { t } = useSite()
  const [name, setName] = useState('')
  return (
    <Card className={wide ? 'md:col-span-2' : undefined} title="GitHub" text={t.start.github} glyph="🐙" color="var(--sky)">
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

/** Spotify, small and optional: its download takes days, and music says little. */
function SpotifyRow(props: { summaries: Array<SourceSummary | undefined>; running: Running; error?: string; notes?: string[]; onFiles: (files: File[]) => void; onConnect?: () => void }) {
  const { t } = useSite()
  return (
    <div className="card-sm mt-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-xl" aria-hidden="true">🎧</span>
          <div className="min-w-0">
            <div className="font-bold">
              Spotify <span className="ml-1 rounded-full border-2 border-soft-line px-2 py-0.5 text-xs font-semibold text-muted">{t.start.optional}</span>
            </div>
            <p className="text-xs text-muted">{t.start.spotifySlow}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            {t.start.request.spotify} ↗
          </a>
          {props.onConnect && (
            <button type="button" onClick={props.onConnect} className="btn btn-ghost btn-sm">
              {t.start.connect('Spotify')}
            </button>
          )}
        </div>
      </div>
      {props.summaries.map((x) => x && <Connected key={x.source} summary={x} onRemove={() => removeSummary(x.source)} />)}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-accent">{t.start.fileReady}</summary>
        <div className="mt-3 flex">
          <DropZone onFiles={props.onFiles} />
        </div>
      </details>
      {props.running && <RunningLine running={props.running} />}
      {props.error && <p className="mt-3 text-sm font-semibold text-bad">{props.error}</p>}
      {props.notes && props.notes.length > 0 && (
        <ul className="mt-3 text-xs text-muted">
          {props.notes.map((n) => (
            <li key={n}>✓ {n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
