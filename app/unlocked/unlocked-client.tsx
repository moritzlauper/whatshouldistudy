'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { update } from '@/lib/store.ts'

/** Stripe sends the buyer here; we exchange the session for an unlock token. */
export function UnlockedClient() {
  const router = useRouter()
  const [error, setError] = useState('')
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const sid = new URLSearchParams(window.location.search).get('session_id') ?? ''
    fetch(`/api/unlock?session_id=${encodeURIComponent(sid)}`)
      .then(async (r) => {
        const j = (await r.json()) as { token?: string; expiresAt?: number; error?: string }
        if (!j.token || !j.expiresAt) throw new Error(j.error ?? 'Could not unlock.')
        update((s) => ({ ...s, unlock: { token: j.token!, expiresAt: j.expiresAt! } }))
        router.replace('/results#programmes')
      })
      .catch((e: Error) => setError(e.message))
  }, [router])

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      {error ? (
        <>
          <h1 className="font-display text-3xl">Something went wrong</h1>
          <p className="mt-4 text-muted">{error}</p>
          <p className="mt-2 text-sm text-muted">If you were charged, reply to your Stripe receipt and we’ll sort it out.</p>
        </>
      ) : (
        <>
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
          <h1 className="mt-8 font-display text-3xl">Unlocking your full report…</h1>
        </>
      )}
    </div>
  )
}
