'use client'

import { withBase } from '@/lib/site.ts'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { update } from '@/lib/store.ts'
import { useSite } from '../ui/site-context.tsx'
import { Burst } from '../ui/shapes.tsx'

/** Stripe sends the buyer here; we exchange the session for an unlock token. */
export function UnlockedView() {
  const { t, r } = useSite()
  const router = useRouter()
  const [error, setError] = useState('')
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const sid = new URLSearchParams(window.location.search).get('session_id') ?? ''
    fetch(withBase(`/api/unlock?session_id=${encodeURIComponent(sid)}`))
      .then(async (res) => {
        const j = (await res.json()) as { token?: string; expiresAt?: number; error?: string }
        if (!j.token || !j.expiresAt) throw new Error(j.error ?? t.misc.couldNotUnlock)
        update((s) => ({ ...s, unlock: { token: j.token!, expiresAt: j.expiresAt! } }))
        router.replace(`${r.results}#${r.anchors.programmes}`)
      })
      .catch((e: Error) => setError(e.message))
  }, [router, r, t])

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      {error ? (
        <>
          <h1 className="font-display text-4xl">{t.unlocked.failed}</h1>
          <p className="mt-4 text-muted">{error}</p>
          <p className="mt-2 text-sm text-muted">{t.unlocked.charged}</p>
        </>
      ) : (
        <>
          <Burst className="spin-slow mx-auto" size={96} color="var(--lime)" />
          <h1 className="mt-8 font-display text-4xl">{t.unlocked.working}</h1>
        </>
      )}
    </div>
  )
}
