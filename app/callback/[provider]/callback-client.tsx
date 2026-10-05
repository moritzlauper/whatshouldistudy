'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { finishAuth } from '@/lib/sources/oauth.ts'
import type { Provider } from '@/lib/sources/oauth.ts'
import { collectYouTube } from '@/lib/sources/youtube.ts'
import { collectSpotify } from '@/lib/sources/spotify.ts'
import { collectReddit } from '@/lib/sources/reddit.ts'
import { setSummary } from '@/lib/store.ts'

const NAMES: Record<Provider, string> = { google: 'YouTube', spotify: 'Spotify', reddit: 'Reddit' }

export function CallbackClient({ provider }: { provider: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('Finishing sign-in')
  const [count, setCount] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const p = provider as Provider
    if (!(p in NAMES)) {
      setError('Unknown provider.')
      return
    }
    const progress = (m: string, n?: number) => {
      setMessage(m)
      setCount(n)
    }
    ;(async () => {
      try {
        const { accessToken } = await finishAuth(p)
        const summary =
          p === 'google' ? await collectYouTube(accessToken, progress) : p === 'spotify' ? await collectSpotify(accessToken, progress) : await collectReddit(accessToken, progress)
        setSummary(summary)
        router.replace(`/start?added=${summary.source}#sources`)
      } catch (e) {
        setError((e as Error).message || 'Something went wrong.')
      }
    })()
  }, [provider, router])

  const name = NAMES[provider as Provider] ?? provider
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      {error ? (
        <>
          <h1 className="font-display text-3xl">Couldn’t read {name}</h1>
          <p className="mt-4 text-muted">{error}</p>
          <a href="/start#sources" className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-bg">
            Back
          </a>
        </>
      ) : (
        <>
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
          <h1 className="mt-8 font-display text-3xl">Reading your {name}</h1>
          <p className="animate-soft mt-4 text-muted">
            {message}
            {count !== undefined ? ` · ${count.toLocaleString('en')}` : ''}
          </p>
          <p className="mt-10 text-xs text-muted">This happens in your browser. Nothing is uploaded to us.</p>
        </>
      )}
    </div>
  )
}
