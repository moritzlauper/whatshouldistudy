'use client'

import { Suspense, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { isGoogleAdsEntry } from '@/lib/google-ads-entry.ts'
import { SALES_PAUSED } from '@/lib/site/config.ts'
import { reportOfferText } from '@/lib/site/report-offer.ts'
import { useSite } from './site-context.tsx'
import { LandingCheckout } from './landing-checkout.tsx'

function Variant({ children, ads }: { children: ReactNode; ads: ReactNode }) {
  const params = useSearchParams()
  const { site } = useSite()
  if (SALES_PAUSED[site] || !isGoogleAdsEntry(params)) return children
  return ads
}

export function GoogleAdsVariant({ children, ads }: { children: ReactNode; ads: ReactNode }) {
  return <Suspense fallback={children}><Variant ads={ads}>{children}</Variant></Suspense>
}

/** Keep the landing page prerendered; only its main CTA depends on the arrival URL. */
export function GoogleAdsEntry({ children }: { children: ReactNode }) {
  const { locale, t } = useSite()
  const offer = reportOfferText(locale)

  return (
    <GoogleAdsVariant ads={(
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
