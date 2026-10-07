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
    year: { CHF: 99, EUR: 99, USD: 99, GBP: 89, CAD: 129, AUD: 149, NZD: 169, SEK: 1119, NOK: 1119, DKK: 719, PLN: 429, CZK: 2499, HUF: 39500, RON: 499, ISK: 14500, JPY: 15200, KRW: 139000, SGD: 129, HKD: 789, INR: 6589, BRL: 519, MXN: 1839, ZAR: 1779, AED: 359, ILS: 359, TRY: 3289 },
    month: { CHF: 119, EUR: 119, USD: 119, GBP: 109, CAD: 159, AUD: 179, NZD: 199, SEK: 1339, NOK: 1339, DKK: 859, PLN: 519, CZK: 2999, HUF: 47400, RON: 599, ISK: 17400, JPY: 18200, KRW: 167000, SGD: 159, HKD: 949, INR: 7909, BRL: 619, MXN: 2209, ZAR: 2139, AED: 429, ILS: 429, TRY: 3949 },
  },
  school: {
    year: { CHF: 349, EUR: 349, USD: 349, GBP: 299, CAD: 469, AUD: 509, NZD: 579, SEK: 3929, NOK: 3929, DKK: 2539, PLN: 1509, CZK: 8819, HUF: 139000, RON: 1749, ISK: 51000, JPY: 53500, KRW: 489000, SGD: 469, HKD: 2769, INR: 23200, BRL: 1839, MXN: 6489, ZAR: 6259, AED: 1279, ILS: 1279, TRY: 11600 },
    month: { CHF: 419, EUR: 419, USD: 419, GBP: 359, CAD: 559, AUD: 609, NZD: 699, SEK: 4719, NOK: 4719, DKK: 3049, PLN: 1809, CZK: 10600, HUF: 167000, RON: 2099, ISK: 61200, JPY: 64200, KRW: 587000, SGD: 559, HKD: 3319, INR: 27800, BRL: 2209, MXN: 7789, ZAR: 7509, AED: 1539, ILS: 1539, TRY: 13900 },
  },
  institution: {
    year: { CHF: 949, EUR: 949, USD: 949, GBP: 819, CAD: 1269, AUD: 1389, NZD: 1579, SEK: 10700, NOK: 10700, DKK: 6899, PLN: 4109, CZK: 24000, HUF: 379000, RON: 4749, ISK: 139000, JPY: 146000, KRW: 1330000, SGD: 1269, HKD: 7529, INR: 63200, BRL: 4999, MXN: 17700, ZAR: 17000, AED: 3479, ILS: 3479, TRY: 31600 },
    month: { CHF: 1139, EUR: 1139, USD: 1139, GBP: 979, CAD: 1519, AUD: 1669, NZD: 1899, SEK: 12800, NOK: 12800, DKK: 8279, PLN: 4929, CZK: 28800, HUF: 455000, RON: 5699, ISK: 167000, JPY: 175000, KRW: 1600000, SGD: 1519, HKD: 9039, INR: 75800, BRL: 5999, MXN: 21200, ZAR: 20400, AED: 4179, ILS: 4179, TRY: 37900 },
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
