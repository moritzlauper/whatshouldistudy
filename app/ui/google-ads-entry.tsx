'use client'

import { Suspense, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { isGoogleAdsEntry } from '@/lib/google-ads-entry.ts'
import { SALES_PAUSED } from '@/lib/site/config.ts'
import { reportOfferText } from '@/lib/site/report-offer.ts'
import { useSite } from './site-context.tsx'
import { LandingCheckout } from './landing-checkout.tsx'
import { useConfig } from './price.tsx'
import { GOOGLE_TAG, effectiveConsent, onConsent, readConsent } from '@/lib/measure.ts'
import { ensurePaywallAssignment, experimentState, onExperiment } from '@/lib/paywall-experiment-client.ts'
import { useAppState } from '@/lib/store.ts'

function Variant({ children, ads, waitForAssignment }: { children: ReactNode; ads: ReactNode; waitForAssignment?: boolean }) {
  const params = useSearchParams()
  const { site } = useSite()
  const config = useConfig(site)
  const state = useAppState()
  const tagged = isGoogleAdsEntry(params)
  const consent = useSyncExternalStore(onConsent, readConsent, () => null)
  const experiment = useSyncExternalStore(onExperiment, () => experimentState(site), () => null)
  const paid = !!state.unlock?.token && state.unlock.expiresAt > Date.now()
  const allowed = GOOGLE_TAG && !!config && effectiveConsent(consent, config.consent) === 'granted'
  useEffect(() => {
    if (allowed && !paid && config?.payments === 'stripe' && !SALES_PAUSED[site]) void ensurePaywallAssignment(site, tagged)
  }, [site, tagged, allowed, paid, config?.payments])
  if (SALES_PAUSED[site]) return children
  if (waitForAssignment && tagged && !paid && allowed && config?.payments === 'stripe' && (!experiment || experiment.status === 'loading')) {
    return <div className="mt-8 h-44 max-w-xl animate-pulse rounded-xl bg-accent-soft" aria-busy="true" />
  }
  if (allowed && !paid && experiment?.assignment) return experiment.assignment.variant === 'direct' ? ads : children
  return tagged ? ads : children
}

export function GoogleAdsVariant({ children, ads, waitForAssignment }: { children: ReactNode; ads: ReactNode; waitForAssignment?: boolean }) {
  return <Suspense fallback={children}><Variant ads={ads} waitForAssignment={waitForAssignment}>{children}</Variant></Suspense>
}

/** Keep the landing page prerendered; only its main CTA depends on the arrival URL. */
export function GoogleAdsEntry({ children }: { children: ReactNode }) {
  const { locale, t } = useSite()
  const offer = reportOfferText(locale)

  return (
    <GoogleAdsVariant waitForAssignment ads={(
      <div className="mt-8 max-w-xl">
        <p className="text-lg font-bold">{t.landing.aiReport}</p>
        <p className="mt-2 text-muted">{offer.landingSummary}</p>
        {t.reportScope && <p className="mt-3 text-sm text-muted">{t.reportScope}</p>}
        <LandingCheckout entry />
        <a href="#swiss-ai" className="mt-4 inline-block font-semibold text-accent underline underline-offset-4">{t.landing.cta2} →</a>
      </div>
    )}>{children}</GoogleAdsVariant>
  )
}
