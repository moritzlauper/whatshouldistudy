'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authOrigin, finishAuth } from '@/lib/sources/oauth.ts'
import type { AuthOrigin, Provider } from '@/lib/sources/oauth.ts'
import { collectYouTube } from '@/lib/sources/youtube.ts'
import { collectSpotify } from '@/lib/sources/spotify.ts'
import { collectReddit } from '@/lib/sources/reddit.ts'
import { setSummary } from '@/lib/store.ts'
import { measureImport } from '@/lib/product-measure.ts'
import { fmtNumber } from '@/lib/site/labels.ts'
import { SiteProvider, useSite } from '../ui/site-context.tsx'
import { Sparkle } from '../ui/shapes.tsx'

const NAMES: Record<Provider, string> = { google: 'YouTube', spotify: 'Spotify', reddit: 'Reddit' }

/**
 * The country sites under the global domain share the global callback URL, so
 * the page switches to the site the sign-in started on: its language, links
 * and, above all, its store.
 */
export function CallbackView({ provider }: { provider: string }) {
  const { site, base, locale } = useSite()
  const [from, setFrom] = useState<AuthOrigin | null | undefined>(undefined)
  useEffect(() => setFrom(authOrigin()), [])
  if (from === undefined) return <div className="min-h-[60vh]" aria-busy="true" />
  if (from && (from.site !== site || from.base !== base || (from.locale && from.locale !== locale))) {
    return (
      <SiteProvider site={from.site} base={from.base} locale={from.locale}>
        <Finish provider={provider} />
      </SiteProvider>
    )
  }
  return <Finish provider={provider} />
}

function Finish({ provider }: { provider: string }) {
  const { t, r, intl } = useSite()
  const router = useRouter()
  const [message, setMessage] = useState(t.callback.finishing)
  const [count, setCount] = useState<number | undefined>()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const p = provider as Provider
    if (!(p in NAMES)) {
      setError(t.callback.unknown)
      return
    }
    const progress = (m: string, n?: number) => {
      setMessage(t.tr(m))
      setCount(n)
    }
    ;(async () => {
      try {
        const { accessToken } = await finishAuth(p)
        const summary = p === 'google' ? await collectYouTube(accessToken, progress) : p === 'spotify' ? await collectSpotify(accessToken, progress) : await collectReddit(accessToken, progress)
        setSummary(summary)
        measureImport(summary.source)
        router.replace(`${r.start}?added=${summary.source}#${r.anchors.sources}`)
      } catch (e) {
        setError(t.tr((e as Error).message || t.callback.generic))
      }
    })()
  }, [provider, router, r, t])

  const name = NAMES[provider as Provider] ?? provider
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      {error ? (
        <>
          <div className="text-6xl" aria-hidden="true">😵</div>
          <h1 className="mt-6 font-display text-4xl">{t.callback.failed(name)}</h1>
          <p className="mt-4 text-muted">{error}</p>
          <Link href={`${r.start}#${r.anchors.sources}`} className="btn btn-ink mt-8">
            {t.callback.back}
          </Link>
        </>
      ) : (
        <>
          <Sparkle className="spin-slow mx-auto" size={72} color="var(--accent)" />
          <h1 className="mt-8 font-display text-4xl">{t.callback.reading(name)}</h1>
          <p className="animate-soft mt-4 font-semibold text-muted">
            {message}
            {count !== undefined ? ` · ${fmtNumber(count, intl)}` : ''}
          </p>
          <p className="mt-10 text-xs text-muted">🔒 {t.callback.local}</p>
        </>
      )}
    </div>
  )
}
