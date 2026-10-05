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
import { Questionnaire } from '../components/questionnaire.tsx'
import { PrefsForm } from '../components/prefs-form.tsx'

type Running = { source: string; message: string; count?: number } | null

export function StartClient() {
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

  const fail = (id: string, e: unknown) => setErrors((x) => ({ ...x, [id]: (e as Error).message || 'Something went wrong.' }))
  const progress = (source: string) => (message: string, count?: number) => setRunning({ source, message, count })

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
      if (!result.summaries.length) throw new Error('No history found in these files. See the steps below for what to export.')
      for (const s of result.summaries) setSummary(s)
      setNotes(result.recognised)
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
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-10 sm:px-6">
      <h1 className="font-display text-4xl sm:text-5xl">Let’s find your field.</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Connect as many sources as you like, answer as much of the questionnaire as you want, then see your result. You can come back and add more at any
        time.
      </p>

      <section id="sources" className="mt-12 scroll-mt-20">
        <StepTitle n={1} title="Connect your sources" sub="Read-only. Analysed in your browser, nothing is uploaded." />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <OAuthCard
            id="youtube"
            provider="google"
            title="YouTube"
            text="Subscriptions, liked videos, playlists and uploads, with every channel’s description."
            summary={state.summaries.youtube}
            running={running?.source === 'youtube' ? running : null}
            error={errors.google}
            onConnect={() => connect('google')}
            mounted={mounted}
          />
          <TakeoutCard summary={state.summaries.takeout} spotifyExport={state.summaries['spotify-export']} running={running?.source === 'takeout' ? running : null} error={errors.takeout} notes={notes} onFiles={onFiles} />
          <OAuthCard
            id="spotify"
            provider="spotify"
            title="Spotify"
            text="Podcasts, saved episodes and audiobooks, plus your top and followed artists for music taste."
            summary={state.summaries.spotify}
            running={null}
            error={errors.spotify}
            onConnect={() => connect('spotify')}
            mounted={mounted}
          />
          <OAuthCard
            id="reddit"
            provider="reddit"
            title="Reddit"
            text="Your communities, saved and upvoted posts, and what you wrote yourself."
            summary={state.summaries.reddit}
            running={null}
            error={errors.reddit}
            onConnect={() => connect('reddit')}
            mounted={mounted}
          />
          <GitHubCard summary={state.summaries.github} running={running?.source === 'github' ? running : null} error={errors.github} onSubmit={github} />
        </div>
      </section>

      <section id="questionnaire" className="mt-16 scroll-mt-20">
        <StepTitle n={2} title="Five minutes about you" sub="What no history can show: how you see yourself, your subjects, your priorities. Every part is optional." />
        <div className="mt-6">
          <Questionnaire />
        </div>
      </section>

      <section id="preferences" className="mt-16 scroll-mt-20">
        <StepTitle n={3} title="Where and what" sub="Used to filter programmes and show the fees that apply to you." />
        <div className="mt-6">
          <PrefsForm />
        </div>
      </section>

      <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-muted">
        <span>Everything above is stored only in this browser.</span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Delete all your connected data, answers and preferences from this browser?')) clearAll()
          }}
          className="rounded-full border border-line px-4 py-2 hover:border-coral hover:text-coral"
        >
          Delete all my data
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="text-sm">
            <span className="font-semibold">{mounted ? signals.toLocaleString('en') : '0'}</span> <span className="text-muted">signals</span>
            <span className="mx-2 text-line">|</span>
            <span className="font-semibold">{mounted ? q.done : 0}</span>
            <span className="text-muted">/{q.total} answers</span>
          </div>
          {mounted && ready ? (
            <Link href="/results" className="rounded-full bg-accent px-6 py-2.5 font-medium text-accent-ink hover:opacity-90">
              See my result →
            </Link>
          ) : (
            <span className="rounded-full bg-surface-2 px-6 py-2.5 text-sm text-muted">Connect a source or answer 18 questions</span>
          )}
        </div>
      </div>
    </div>
  )
}

function StepTitle({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="flex gap-4">
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-bg">{n}</span>
      <div>
        <h2 className="font-display text-2xl sm:text-3xl">{title}</h2>
        <p className="mt-1 text-muted">{sub}</p>
      </div>
    </div>
  )
}

function Connected({ summary, onRemove }: { summary: SourceSummary; onRemove: () => void }) {
  const stats = Object.entries(summary.stats).filter(([, v]) => v !== 0 && v !== '—')
  return (
    <div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-good">✓ {summary.dataPoints.toLocaleString('en')} signals read</span>
        <button type="button" onClick={onRemove} className="text-xs text-muted underline-offset-2 hover:text-coral hover:underline">
          Remove
        </button>
      </div>
      {stats.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {stats
            .slice(0, 6)
            .map(([k, v]) => `${typeof v === 'number' ? v.toLocaleString('en') : v} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
            .join(' · ')}
        </p>
      )}
      {summary.notes?.map((n) => (
        <p key={n} className="mt-2 text-xs text-warn">
          {n}
        </p>
      ))}
    </div>
  )
}

function Card({ title, text, children, badge }: { title: string; text: string; children: React.ReactNode; badge?: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {badge && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">{badge}</span>}
      </div>
      <p className="mt-1.5 text-sm text-muted">{text}</p>
      <div className="mt-auto">{children}</div>
    </div>
  )
}

function RunningLine({ running }: { running: NonNullable<Running> }) {
  return (
    <p className="animate-soft mt-4 text-sm text-accent">
      {running.message}
      {running.count !== undefined ? ` · ${running.count.toLocaleString('en')}` : ''}
    </p>
  )
}

function OAuthCard(props: {
  id: SourceId
  provider: Provider
  title: string
  text: string
  summary?: SourceSummary
  running: Running
  error?: string
  onConnect: () => void
  mounted: boolean
}) {
  const configured = props.mounted && isConfigured(props.provider)
  return (
    <Card title={props.title} text={props.text}>
      {props.summary && <Connected summary={props.summary} onRemove={() => removeSummary(props.id)} />}
      {props.running && <RunningLine running={props.running} />}
      {props.error && <p className="mt-3 text-sm text-coral">{props.error}</p>}
      <div className="mt-4">
        {configured ? (
          <button type="button" onClick={props.onConnect} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-bg hover:opacity-90">
            {props.summary ? 'Refresh' : `Connect ${props.title}`}
          </button>
        ) : (
          <p className="text-xs text-muted">
            {props.mounted ? `${props.title} sign-in isn’t set up on this deployment yet.` : ''}
            {props.id === 'youtube' && props.mounted && ' You can still use Google Takeout.'}
          </p>
        )}
      </div>
    </Card>
  )
}

function TakeoutCard({
  summary,
  spotifyExport,
  running,
  error,
  notes,
  onFiles,
}: {
  summary?: SourceSummary
  spotifyExport?: SourceSummary
  running: Running
  error?: string
  notes: string[]
  onFiles: (files: File[]) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  return (
    <Card title="Data exports" text="Your full YouTube watch and search history from Google Takeout, or your Spotify listening history. The richest source." badge="Best">
      {summary && <Connected summary={summary} onRemove={() => removeSummary('takeout')} />}
      {spotifyExport && <Connected summary={spotifyExport} onRemove={() => removeSummary('spotify-export')} />}
      {running && <RunningLine running={running} />}
      {error && <p className="mt-3 text-sm text-coral">{error}</p>}
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
        className={`mt-4 cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-sm transition ${drag ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/50'}`}
      >
        <span className="font-medium">Drop your .zip or files here</span>
        <span className="block text-xs text-muted">or click to choose · stays on your device</span>
        <input
          ref={input}
          type="file"
          multiple
          accept=".zip,.json,.html,.csv"
          className="hidden"
          onChange={(e) => onFiles([...(e.target.files ?? [])])}
        />
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-accent">How to get your Google Takeout (2 minutes + email)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>
            Open{' '}
            <a className="underline" href="https://takeout.google.com/settings/takeout/custom/youtube" target="_blank" rel="noreferrer">
              takeout.google.com
            </a>{' '}
            and click “Deselect all”, then tick only <em>YouTube and YouTube Music</em>.
          </li>
          <li>Under “All YouTube data included”, keep history, subscriptions and comments; untick videos (they’re large).</li>
          <li>Under “Multiple formats”, set History to JSON (HTML works too).</li>
          <li>Export once as .zip. Google emails you a link, usually within minutes.</li>
          <li>Drop the downloaded .zip here as it is.</li>
        </ol>
      </details>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-accent">How to get your Spotify history</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>
            Open{' '}
            <a className="underline" href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer">
              spotify.com/account/privacy
            </a>{' '}
            and request your “Extended streaming history” (or “Account data”, which is faster).
          </li>
          <li>Spotify emails you a .zip within a few days. Drop it here.</li>
        </ol>
      </details>
    </Card>
  )
}

function GitHubCard({ summary, running, error, onSubmit }: { summary?: SourceSummary; running: Running; error?: string; onSubmit: (u: string) => void }) {
  const [name, setName] = useState('')
  return (
    <Card title="GitHub" text="What you build and what you star. Public data, just your username, no sign-in.">
      {summary && <Connected summary={summary} onRemove={() => removeSummary('github')} />}
      {running && <RunningLine running={running} />}
      {error && <p className="mt-3 text-sm text-coral">{error}</p>}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onSubmit(name)
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="your-username"
          aria-label="GitHub username"
          className="min-w-0 flex-1 rounded-full border border-line bg-bg px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <button type="submit" className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-bg hover:opacity-90">
          {summary ? 'Refresh' : 'Add'}
        </button>
      </form>
    </Card>
  )
}
