'use client'

import Link from 'next/link'
import { useState } from 'react'
import { withBase } from '@/lib/site.ts'
import { formatPrice, priceForSite } from '@/lib/pricing.ts'
import { measureCheckout } from '@/lib/measure.ts'
import { useAppState } from '@/lib/store.ts'
import { resultsReady } from '@/lib/engine/questionnaire.ts'
import { reportOfferText } from '@/lib/site/report-offer.ts'
import { withdrawalText } from '@/lib/site/withdrawal-text.ts'
import { useConfig } from './price.tsx'
import { useSite } from './site-context.tsx'
import { PayWithTwint } from './twint.tsx'
import { paywallParticipant } from '@/lib/paywall-experiment-client.ts'

/** Buy before completing the analysis, through the same checkout as the report. */
export function LandingCheckout({ entry = false }: { entry?: boolean }) {
  const { site, base, locale, intl, t, r } = useSite()
  const offer = reportOfferText(locale)
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
      const participant = paywallParticipant(site, config.consent)
      if (participant) query.set('ab', participant)
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
      <button type="button" disabled={busy || !config} onClick={checkout} className="btn btn-lime btn-lg w-full whitespace-normal text-center">
        {busy ? t.programmes.opening : config?.payments === 'free' ? t.programmes.unlockFree : entry ? offer.landingCta(formatPrice(price, intl)) : t.programmes.unlock(formatPrice(price, intl))}
      </button>
      {error && <p role="alert" className="mt-3 rounded-xl bg-surface p-3 text-sm font-semibold text-bad">{error}</p>}
      {entry ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-muted sm:text-sm">
          <span>{offer.landingReassurance}</span>
          <PayWithTwint compact className="border-l border-soft-line pl-3" />
        </div>
      ) : (
        <>
          <PayWithTwint className="mt-3 justify-center" />
          <p className="mt-3 text-center text-sm">{t.landing.buyNote}</p>
          {config?.payments === 'stripe' && <p className="mt-2 text-center text-sm font-semibold">{t.programmes.boxNote}</p>}
          <p className="mt-2 text-center text-xs opacity-80">{withdrawalText(locale).note} {t.programmes.minors}{' '}<Link href={r.terms} className="underline">{withdrawalText(locale).termsLink}</Link></p>
        </>
      )}
    </div>
  )
}
