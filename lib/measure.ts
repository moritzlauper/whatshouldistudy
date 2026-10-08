import type { Price } from './pricing.ts'
import { SITE_URL } from './site.ts'
import { CH_FR_IT_URL, LOCAL_SITES, SITES } from './site/config.ts'

/**
 * Ad measurement: Google Analytics 4 and Google Ads conversions through the
 * Google tag (gtag.js) with Consent Mode v2, plus Vercel Web Analytics for
 * cookieless page counts. Everything is optional: without the ids nothing loads.
 *
 * Events carry the step, the price and the Stripe session id, never anything
 * derived from a visitor's sources or answers: no field ids, scores or topics.
 * Data from the YouTube API falls under Google's Limited Use rules and must not
 * reach advertising, not even as a derived result.
 */

// Literal process.env reads: Next inlines NEXT_PUBLIC_ values only when written out.
export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID ?? ''
export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? ''
const LABELS = {
  purchase: process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL ?? '',
  lead: process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL ?? '',
  checkout: process.env.NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_LABEL ?? '',
}
/**
 * Where consent is still missing (EU/EEA and UK before a choice, or after a refusal):
 * advanced loads the Google tag denied, so it sends cookieless pings Google
 * models conversions from; basic loads nothing until consent.
 */
export const CONSENT_MODE: 'basic' | 'advanced' = process.env.NEXT_PUBLIC_CONSENT_MODE === 'basic' ? 'basic' : 'advanced'
export const VERCEL_ANALYTICS = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === '1'
/** The id gtag.js is loaded with; further destinations are added with config. */
export const TAG_ID = GA4_ID || ADS_ID
export const GOOGLE_TAG = !!TAG_ID

export type Consent = 'granted' | 'denied'

/**
 * Countries whose law asks for consent before ad and analytics cookies: the
 * EU/EEA (ePrivacy Directive, in Germany § 25 TDDDG, in Austria § 165 TKG) and
 * the UK (PECR). Google's EU user consent policy covers the same countries.
 * Elsewhere, Switzerland included (Art. 45c FMG), informing and an easy
 * refusal are enough, so measurement runs until the visitor says no.
 */
const OPT_IN = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  'IS', 'LI', 'NO', 'GB',
])

export type ConsentRule = 'opt-in' | 'opt-out'

/** Unknown country: ask, to be safe. */
export const consentRule = (country: string | null | undefined): ConsentRule => (country && !OPT_IN.has(country.toUpperCase()) ? 'opt-out' : 'opt-in')

/** The choice that applies: the visitor's own, else the default of their country. */
export const effectiveConsent = (stored: Consent | null, rule: ConsentRule): Consent => stored ?? (rule === 'opt-out' ? 'granted' : 'denied')

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

// ── Consent ─────────────────────────────────────────────────────────────────

const KEY = 'wsis:consent'
/** Asked again after a year. */
const MAX_AGE = 365 * 24 * 3600 * 1000
const EVENT = 'wsis:consent'

export function readConsent(): Consent | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { c?: Consent; at?: number } | null
    if (!v || (v.c !== 'granted' && v.c !== 'denied') || !v.at || Date.now() - v.at > MAX_AGE) return null
    return v.c
  } catch {
    return null
  }
}

export function saveConsent(c: Consent | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify({ c, at: Date.now() }))
    else localStorage.removeItem(KEY)
  } catch {
    // Without storage the choice holds for this page only.
  }
  window.dispatchEvent(new Event(EVENT))
}

export function onConsent(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}

const consentState = (c: Consent) => ({ ad_storage: c, ad_user_data: c, ad_personalization: c, analytics_storage: c })

/** Removes Google's cookies (_ga, _gid, _gcl_*) from this host and its parent domains. */
export function clearGoogleCookies() {
  const names = document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => /^(_ga|_gid|_gat|_gcl_)/.test(n))
  const parts = location.hostname.split('.')
  const domains = ['', ...parts.map((_, i) => `.${parts.slice(i).join('.')}`).slice(0, -1)]
  for (const n of names) for (const d of domains) document.cookie = `${n}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`
}

// ── The Google tag ──────────────────────────────────────────────────────────

/** Our own domains, for the linker that keeps one visitor across them. */
function linkDomains(): string[] {
  const hosts = [SITE_URL, CH_FR_IT_URL, ...LOCAL_SITES.map((s) => SITES[s].domainUrl)].map((u) => {
    try {
      return u ? new URL(u).hostname.replace(/^www\./, '') : ''
    } catch {
      return ''
    }
  })
  return [...new Set(hosts.filter(Boolean))]
}

let started = false
let current: Consent = 'denied'

/** Sets up the command queue before gtag.js arrives; it works through the queue once loaded. */
export function startGoogleTag(consent: Consent) {
  if (started || !GOOGLE_TAG) return
  started = true
  current = consent
  window.dataLayer = window.dataLayer ?? []
  window.gtag = function gtag() {
    // gtag.js expects the arguments object itself, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  const g = window.gtag
  g('consent', 'default', { ...consentState('denied'), wait_for_update: 500 })
  g('set', 'ads_data_redaction', true)
  if (consent === 'granted') g('consent', 'update', consentState('granted'))
  g('js', new Date())
  // Page views are sent by hand on every route change, with a cleaned address.
  if (GA4_ID) g('config', GA4_ID, { send_page_view: false, linker: { domains: linkDomains() } })
  if (ADS_ID) g('config', ADS_ID, { send_page_view: false, allow_enhanced_conversions: true })
}

export function updateConsent(c: Consent) {
  if (c === current) return
  current = c
  window.gtag?.('consent', 'update', consentState(c))
}

/** Query parameters that may reach analytics: campaign tags and ad click ids. Everything else (OAuth codes, Stripe sessions) stays out. */
const KEEP = /^(utm_[a-z_]+|gclid|gbraid|wbraid|gad_source|gad_campaignid)$/

export function cleanUrl(href: string): string {
  const u = new URL(href)
  const q = new URLSearchParams()
  for (const [k, v] of u.searchParams) if (KEEP.test(k)) q.set(k, v)
  const s = q.toString()
  return `${u.origin}${u.pathname}${s ? `?${s}` : ''}`
}

/** Sign-in callbacks carry OAuth codes and tokens in the address: never measured. */
export const unmeasured = (path: string) => /\/callback\//.test(path)

export function pageView() {
  const g = window.gtag
  if (!g || unmeasured(location.pathname)) return
  const page_location = cleanUrl(location.href)
  g('set', { page_location })
  g('event', 'page_view', { page_location, page_title: document.title })
}

// ── Funnel events ───────────────────────────────────────────────────────────

function event(name: string, params: Record<string, unknown> = {}) {
  window.gtag?.('event', name, params)
}

function conversion(label: string, params: Record<string, unknown> = {}) {
  if (ADS_ID && label) event('conversion', { send_to: `${ADS_ID}/${label}`, ...params })
}

const item = (p: Price) => ({ item_id: 'full-report', item_name: 'Full programme report', price: p.amount, quantity: 1 })

/** A source was connected or an export dropped. Only which kind, never what came out. */
export function measureConnect(source: 'youtube' | 'spotify' | 'reddit' | 'github' | 'export') {
  event('connect_source', { source })
}

/** The visitor's own result was shown (not a shared one). Once per browser session. */
export function measureResult() {
  try {
    if (sessionStorage.getItem('wsis:lead')) return
    sessionStorage.setItem('wsis:lead', '1')
  } catch {
    // Counted once per page load then.
  }
  event('generate_lead', { lead_source: 'analysis' })
  conversion(LABELS.lead)
}

export function measureCheckout(p: Price) {
  event('begin_checkout', { currency: p.currency, value: p.amount, items: [item(p)] })
  conversion(LABELS.checkout, { value: p.amount, currency: p.currency })
}

/** A paid unlock. The Stripe session id deduplicates reloads in GA4 and Google Ads. */
export function measurePurchase(p: { id: string; amount: number; currency: string; emailHash?: string }) {
  const price = { currency: p.currency, amount: p.amount }
  // Enhanced conversions: the address is hashed on our server and sent only while ad data use is allowed.
  if (p.emailHash && current === 'granted') window.gtag?.('set', 'user_data', { sha256_email_address: p.emailHash })
  event('purchase', { transaction_id: p.id, currency: p.currency, value: p.amount, items: [item(price)] })
  conversion(LABELS.purchase, { transaction_id: p.id, value: p.amount, currency: p.currency })
}
