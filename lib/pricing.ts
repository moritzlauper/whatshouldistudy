/**
 * One-time price of the full report: 17 in the local currency, rounded to a
 * price that looks deliberate there (£15, 189 kr, ¥2,600) instead of a raw
 * conversion. Country sites use their own currency; the global site follows
 * the visitor's country (Vercel geo header), with USD as its fallback.
 */

import { SITES } from './site/config.ts'
import type { SiteId } from './site/config.ts'

/** Price in major units per currency. */
export const PRICES: Record<string, number> = {
  CHF: 17,
  EUR: 17,
  USD: 17,
  GBP: 15,
  CAD: 23,
  AUD: 25,
  NZD: 29,
  SEK: 189,
  NOK: 189,
  DKK: 125,
  PLN: 75,
  CZK: 429,
  HUF: 6790,
  RON: 85,
  ISK: 2490,
  JPY: 2600,
  KRW: 24000,
  SGD: 23,
  HKD: 135,
  INR: 1099,
  BRL: 89,
  MXN: 319,
  ZAR: 299,
  AED: 65,
  ILS: 65,
  TRY: 569,
}

const EUROZONE = ['AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK']

const COUNTRY_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(EUROZONE.map((c) => [c, 'EUR'])),
  CH: 'CHF',
  LI: 'CHF',
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  IS: 'ISK',
  JP: 'JPY',
  KR: 'KRW',
  SG: 'SGD',
  HK: 'HKD',
  IN: 'INR',
  BR: 'BRL',
  MX: 'MXN',
  ZA: 'ZAR',
  AE: 'AED',
  IL: 'ILS',
  TR: 'TRY',
}

/** Stripe's zero-decimal currencies among ours (amounts are sent in major units). */
const ZERO_DECIMAL = new Set(['JPY', 'KRW'])

export interface Price {
  amount: number
  currency: string
}

export function priceFor(country: string | null | undefined, fallbackCurrency = 'USD'): Price {
  const cur = (country && COUNTRY_CURRENCY[country.toUpperCase()]) || fallbackCurrency
  const currency = PRICES[cur] ? cur : 'USD'
  return { amount: PRICES[currency], currency }
}

/** Keep displayed prices and both checkout flows on the same site currency. */
export function priceForSite(site: SiteId, visitorCountry?: string | null): Price {
  const conf = SITES[site]
  return priceFor(conf.country ?? visitorCountry, conf.currency)
}

/** Amount in Stripe's smallest unit. ISK and HUF use two decimals in Stripe's API. */
export function stripeAmount(p: Price): number {
  return ZERO_DECIMAL.has(p.currency) ? p.amount : p.amount * 100
}

/** Back from Stripe's smallest unit, e.g. amount_total of a Checkout session. */
export function fromStripeAmount(amount: number, currency: string): Price {
  const cur = currency.toUpperCase()
  return { currency: cur, amount: ZERO_DECIMAL.has(cur) ? amount : amount / 100 }
}

export function formatPrice(p: Price, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.amount)
  } catch {
    return `${p.amount} ${p.currency}`
  }
}

/**
 * Plans for organisations (schools, counselling services, universities): a
 * number of full reports a month for their students. Billed yearly by default;
 * monthly billing costs about 17% more (two months free on the yearly plan).
 * Amounts are per month in major units, derived from the same local price
 * levels as PRICES. scripts/stripe-setup.ts creates the matching Stripe prices.
 */
export type OrgTier = 'counsellor' | 'school' | 'institution'
export type Interval = 'year' | 'month'

export const ORG_TIERS: OrgTier[] = ['counsellor', 'school', 'institution']

/** Full reports per calendar month; null is unlimited. */
export const ORG_REPORTS: Record<OrgTier, number | null> = { counsellor: 100, school: 1000, institution: null }

/** Free trial on every organisation plan; each plan's normal monthly limit applies. */
export const TRIAL_DAYS = 14

export const ORG_PRICES: Record<OrgTier, Record<Interval, Record<string, number>>> = {
  counsellor: {
    year: { CHF: 49, EUR: 49, USD: 49, GBP: 44, CAD: 64, AUD: 74, NZD: 84, SEK: 559, NOK: 559, DKK: 359, PLN: 214, CZK: 1249, HUF: 19750, RON: 249, ISK: 7250, JPY: 7600, KRW: 69500, SGD: 64, HKD: 394, INR: 3294, BRL: 259, MXN: 919, ZAR: 889, AED: 179, ILS: 179, TRY: 1644 },
    month: { CHF: 59, EUR: 59, USD: 59, GBP: 54, CAD: 79, AUD: 89, NZD: 99, SEK: 669, NOK: 669, DKK: 429, PLN: 259, CZK: 1499, HUF: 23700, RON: 299, ISK: 8700, JPY: 9100, KRW: 83500, SGD: 79, HKD: 474, INR: 3954, BRL: 309, MXN: 1104, ZAR: 1069, AED: 214, ILS: 214, TRY: 1974 },
  },
  school: {
    year: { CHF: 174, EUR: 174, USD: 174, GBP: 149, CAD: 234, AUD: 254, NZD: 289, SEK: 1964, NOK: 1964, DKK: 1269, PLN: 754, CZK: 4409, HUF: 69500, RON: 874, ISK: 25500, JPY: 26750, KRW: 244500, SGD: 234, HKD: 1384, INR: 11600, BRL: 919, MXN: 3244, ZAR: 3129, AED: 639, ILS: 639, TRY: 5800 },
    month: { CHF: 209, EUR: 209, USD: 209, GBP: 179, CAD: 279, AUD: 304, NZD: 349, SEK: 2359, NOK: 2359, DKK: 1524, PLN: 904, CZK: 5300, HUF: 83500, RON: 1049, ISK: 30600, JPY: 32100, KRW: 293500, SGD: 279, HKD: 1659, INR: 13900, BRL: 1104, MXN: 3894, ZAR: 3754, AED: 769, ILS: 769, TRY: 6950 },
  },
  institution: {
    year: { CHF: 474, EUR: 474, USD: 474, GBP: 409, CAD: 634, AUD: 694, NZD: 789, SEK: 5350, NOK: 5350, DKK: 3449, PLN: 2054, CZK: 12000, HUF: 189500, RON: 2374, ISK: 69500, JPY: 73000, KRW: 665000, SGD: 634, HKD: 3764, INR: 31600, BRL: 2499, MXN: 8850, ZAR: 8500, AED: 1739, ILS: 1739, TRY: 15800 },
    month: { CHF: 569, EUR: 569, USD: 569, GBP: 489, CAD: 759, AUD: 834, NZD: 949, SEK: 6400, NOK: 6400, DKK: 4139, PLN: 2464, CZK: 14400, HUF: 227500, RON: 2849, ISK: 83500, JPY: 87500, KRW: 800000, SGD: 759, HKD: 4519, INR: 37900, BRL: 2999, MXN: 10600, ZAR: 10200, AED: 2089, ILS: 2089, TRY: 18950 },
  },
}

/** Monthly amount of a plan in a currency (falls back to USD like priceFor). */
export function orgPrice(tier: OrgTier, interval: Interval, currency: string): Price {
  const table = ORG_PRICES[tier][interval]
  const cur = table[currency] ? currency : 'USD'
  return { currency: cur, amount: table[cur] }
}

/** What Stripe bills per interval: twelve months at once on the yearly plan. */
export const orgBilled = (tier: OrgTier, interval: Interval, currency: string): Price => {
  const p = orgPrice(tier, interval, currency)
  return interval === 'year' ? { ...p, amount: p.amount * 12 } : p
}

/** Lookup keys of the Stripe prices; scripts/stripe-setup.ts moves them to a new price when amounts change. */
export const REPORT_LOOKUP_KEY = 'wsis_report'
export const orgLookupKey = (tier: OrgTier, interval: Interval) => `wsis_org_${tier}_${interval}`
