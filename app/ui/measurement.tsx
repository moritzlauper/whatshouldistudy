'use client'

import Link from 'next/link'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useSyncExternalStore } from 'react'
import { Analytics } from '@vercel/analytics/next'
import type { BeforeSendEvent } from '@vercel/analytics/next'
import { CONSENT_MODE, GOOGLE_TAG, TAG_ID, VERCEL_ANALYTICS, cleanUrl, clearGoogleCookies, effectiveConsent, onConsent, pageView, readConsent, saveConsent, startGoogleTag, unmeasured, updateConsent } from '@/lib/measure.ts'
import type { Consent, ConsentRule } from '@/lib/measure.ts'
import { useConfig } from './price.tsx'
import { useSite } from './site-context.tsx'

/** The stored choice; 'none' before one is made, 'unknown' while rendering on the server. */
function useStoredConsent(): Consent | 'none' | 'unknown' {
  return useSyncExternalStore(
    onConsent,
    () => readConsent() ?? 'none',
    () => 'unknown',
  )
}

/** Cookieless page counts: without OAuth callbacks and with only campaign parameters in the address. */
function cleanVercel(e: BeforeSendEvent): BeforeSendEvent | null {
  return unmeasured(new URL(e.url).pathname) ? null : { ...e, url: cleanUrl(e.url) }
}

/** Loads the Google tag as far as the visitor's country and choice allow, sends page views and asks or informs once. */
export function Measurement() {
  const { site } = useSite()
  const config = useConfig(site)
  const path = usePathname()
  const stored = useStoredConsent()
  const rule = config?.consent
  const ready = GOOGLE_TAG && stored !== 'unknown' && !!rule
  const consent = ready ? effectiveConsent(stored === 'none' ? null : stored, rule) : 'denied'
  const skip = unmeasured(path)
  const load = ready && !skip && (CONSENT_MODE === 'advanced' || consent === 'granted')

  // In this order: the queue first, then the consent state, then the page view.
  useEffect(() => {
    if (load) startGoogleTag(consent)
  }, [load, consent])
  useEffect(() => {
    if (ready) updateConsent(consent)
  }, [ready, consent])
  useEffect(() => {
    if (load) pageView()
  }, [load, path])

  return (
    <>
      {load && <Script src={`https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`} strategy="afterInteractive" />}
      {VERCEL_ANALYTICS && <Analytics beforeSend={cleanVercel} />}
      {ready && stored === 'none' && !skip && <ConsentNotice rule={rule} />}
    </>
  )
}

function refuse() {
  saveConsent('denied')
  clearGoogleCookies()
  // Basic mode promises no Google requests without consent: drop the loaded tag.
  if (CONSENT_MODE === 'basic' && window.gtag) location.reload()
}

/** In the EU/EEA and the UK a question before anything is set; elsewhere a notice with a way to refuse. */
function ConsentNotice({ rule }: { rule: ConsentRule }) {
  const { t, r } = useSite()
  const ask = rule === 'opt-in'
  return (
    <div role="dialog" aria-live="polite" aria-label={t.consent.settings} className="card-sm fixed inset-x-3 bottom-3 z-40 max-w-md bg-surface p-4 text-sm shadow-lg sm:left-auto sm:right-5 sm:bottom-5">
      <p>
        {ask ? t.consent.ask : t.consent.info}{' '}
        <Link href={r.privacy} className="font-semibold underline">
          {t.consent.more}
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => saveConsent('granted')}>
          {ask ? t.consent.accept : t.consent.ok}
        </button>
        <button type="button" className={ask ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={refuse}>
          {t.consent.deny}
        </button>
      </div>
    </div>
  )
}

/** Footer link that brings the notice back, to change the choice. */
export function ConsentLink() {
  const { t } = useSite()
  if (!GOOGLE_TAG) return null
  return (
    <button type="button" onClick={() => saveConsent(null)} className="text-left opacity-80 hover:opacity-100">
      {t.consent.settings}
    </button>
  )
}
