/**
 * One-time price of the full report: 15 in the local currency, rounded to a
 * price that looks deliberate there (£13, 169 kr, ¥2,300) instead of a raw
 * conversion. The currency follows the visitor's country (Vercel geo header);
 * everything else pays USD.
 */

/** Price in major units per currency. */
export const PRICES: Record<string, number> = {
  CHF: 15,
  EUR: 15,
  USD: 15,
  GBP: 13,
  CAD: 20,
  AUD: 22,
  NZD: 25,
  SEK: 169,
  NOK: 169,
  DKK: 109,
  PLN: 65,
  CZK: 379,
  HUF: 5990,
  RON: 75,
  ISK: 2190,
  JPY: 2300,
  KRW: 21000,
  SGD: 20,
  HKD: 119,
  INR: 999,
  BRL: 79,
  MXN: 279,
  ZAR: 269,
  AED: 55,
  ILS: 55,
  TRY: 499,
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

/** Amount in Stripe's smallest unit. ISK and HUF use two decimals in Stripe's API. */
export function stripeAmount(p: Price): number {
  return ZERO_DECIMAL.has(p.currency) ? p.amount : p.amount * 100
}

export function formatPrice(p: Price, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.amount)
  } catch {
    return `${p.amount} ${p.currency}`
  }
}
