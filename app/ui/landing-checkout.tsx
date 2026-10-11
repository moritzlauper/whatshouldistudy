'use client'

import Link from 'next/link'
import { useState } from 'react'
import { withBase } from '@/lib/site.ts'
import { formatPrice, priceForSite } from '@/lib/pricing.ts'
import { measureCheckout } from '@/lib/measure.ts'
import { useAppState } from '@/lib/store.ts'
import { resultsReady } from '@/lib/engine/questionnaire.ts'
import { useConfig } from './price.tsx'
import { useSite } from './site-context.tsx'

/** Buy before completing the analysis, through the same checkout as the report. */
export function LandingCheckout() {
  const { site, base, locale, intl, t, r } = useSite()
  const config = useConfig(site)
  const state = useAppState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const price = config?.price ?? priceForSite(site)
  const ready = resultsReady(state.answers, Object.values(state.summaries).filter(Boolean).length)

  if (state.unlock?.token && state.unlock.expiresAt > Date.now()) {
    return <Link href={ready ? r.results : r.start} className="btn btn-lime btn-lg mt-6 w-full">{ready ? t.results.title : t.nav.start} →</Link>
  }

  async function checkout() {
    if (busy || !config || config.payments === 'off') return
    setBusy(true)
    setError('')
    measureCheckout(price)
    try {
      const query = new URLSearchParams({ site, back: base, locale, o: window.location.origin, from: 'landing' })
      const res = await fetch(withBase(`/api/checkout?${query}`), { method: 'POST' })
      const result = await res.json() as { url?: string; error?: string }
      if (!res.ok || !result.url) throw new Error(result.error ?? t.programmes.checkoutFailed)
      window.location.assign(result.url)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  if (config?.payments === 'off') return <p className="mt-6 text-sm">{t.programmes.paymentsOff}</p>

  return (
    <div className="mt-6">
      <button type="button" disabled={busy || !config} onClick={checkout} className="btn btn-lime btn-lg w-full">
        {busy ? t.programmes.opening : config?.payments === 'free' ? t.programmes.unlockFree : t.programmes.unlock(formatPrice(price, intl))}
      </button>
      {error && <p role="alert" className="mt-3 rounded-xl bg-surface p-3 text-sm font-semibold text-bad">{error}</p>}
      <p className="mt-3 text-center text-sm">{t.landing.buyNote}</p>
      {config?.payments === 'stripe' && <p className="mt-2 text-center text-sm font-semibold">{t.programmes.boxNote}</p>}
      <p className="mt-2 text-center text-xs opacity-80">{t.programmes.minors}{' '}<Link href={r.terms} className="underline">{t.footer.terms}</Link></p>
    </div>
  )
}
