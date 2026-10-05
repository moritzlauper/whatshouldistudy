import type { Programme } from './programmes.ts'
import type { Preferences } from './engine/types.ts'

/**
 * Countries the site knows by name, with the fee category rules used to show
 * what a programme costs *you*. Typical public tuition is per year, approximate,
 * and only shown where we have no programme-level fee.
 */

export type Region = 'eu' | 'eea' | 'ch' | 'uk' | 'us' | 'other'

export interface CountryInfo {
  name: string
  region: Region
  currency: string
  /** Typical public university tuition per year, approximate. */
  typicalTuition?: string
  /** Programme-level data available from an official source. */
  programmeData?: boolean
}

export const COUNTRIES: Record<string, CountryInfo> = {
  US: { name: 'United States', region: 'us', currency: 'USD', typicalTuition: 'Public in-state ~$11k, out-of-state ~$29k, private ~$40k+', programmeData: true },
  GB: { name: 'United Kingdom', region: 'uk', currency: 'GBP', typicalTuition: 'Home £9,535 (England); international £15k–£40k', programmeData: true },
  FR: { name: 'France', region: 'eu', currency: 'EUR', typicalTuition: 'Public €178 (bachelor), €254 (master) for EU; higher for non-EU', programmeData: true },
  DE: { name: 'Germany', region: 'eu', currency: 'EUR', typicalTuition: 'Free at public universities (semester fee ~€150–400); Baden-Württemberg €1,500/semester for non-EU', programmeData: true },
  AT: { name: 'Austria', region: 'eu', currency: 'EUR', typicalTuition: 'Free for EU (within standard duration); ~€1,500/yr non-EU', programmeData: true },
  CH: { name: 'Switzerland', region: 'ch', currency: 'CHF', typicalTuition: 'CHF 1,000–4,000/yr at public universities', programmeData: true },
  NL: { name: 'Netherlands', region: 'eu', currency: 'EUR', typicalTuition: '~€2,600 for EU; €9k–€20k non-EU' },
  BE: { name: 'Belgium', region: 'eu', currency: 'EUR', typicalTuition: '~€1,000 for EU; €4k+ non-EU' },
  LU: { name: 'Luxembourg', region: 'eu', currency: 'EUR', typicalTuition: '€400–800' },
  IE: { name: 'Ireland', region: 'eu', currency: 'EUR', typicalTuition: '€3,000 student contribution for EU; €10k–€25k non-EU' },
  IT: { name: 'Italy', region: 'eu', currency: 'EUR', typicalTuition: '€0–4,000, income-based' },
  ES: { name: 'Spain', region: 'eu', currency: 'EUR', typicalTuition: '€700–2,500 at public universities' },
  PT: { name: 'Portugal', region: 'eu', currency: 'EUR', typicalTuition: '~€700 for EU; €3k–€7k non-EU' },
  GR: { name: 'Greece', region: 'eu', currency: 'EUR', typicalTuition: 'Free for EU (bachelor); fees for most master’s' },
  SE: { name: 'Sweden', region: 'eu', currency: 'SEK', typicalTuition: 'Free for EU; SEK 80k–295k non-EU' },
  DK: { name: 'Denmark', region: 'eu', currency: 'DKK', typicalTuition: 'Free for EU; €6k–€16k non-EU' },
  FI: { name: 'Finland', region: 'eu', currency: 'EUR', typicalTuition: 'Free for EU; €8k–€18k non-EU' },
  NO: { name: 'Norway', region: 'eea', currency: 'NOK', typicalTuition: 'Free for EU/EEA; NOK 130k+ non-EU' },
  IS: { name: 'Iceland', region: 'eea', currency: 'ISK', typicalTuition: 'Registration fee ~€500' },
  PL: { name: 'Poland', region: 'eu', currency: 'PLN', typicalTuition: 'Free in Polish; €2k–€4k in English' },
  CZ: { name: 'Czechia', region: 'eu', currency: 'CZK', typicalTuition: 'Free in Czech; €2k–€10k in English' },
  SK: { name: 'Slovakia', region: 'eu', currency: 'EUR', typicalTuition: 'Free in Slovak; fees in English' },
  HU: { name: 'Hungary', region: 'eu', currency: 'HUF', typicalTuition: '€2k–€8k in English; scholarships common' },
  SI: { name: 'Slovenia', region: 'eu', currency: 'EUR', typicalTuition: 'Free for EU (full-time)' },
  HR: { name: 'Croatia', region: 'eu', currency: 'EUR', typicalTuition: '€1k–€4k' },
  RO: { name: 'Romania', region: 'eu', currency: 'RON', typicalTuition: '€2k–€5k' },
  BG: { name: 'Bulgaria', region: 'eu', currency: 'BGN', typicalTuition: '€500–€4k' },
  EE: { name: 'Estonia', region: 'eu', currency: 'EUR', typicalTuition: 'Free in Estonian; €2k–€8k in English' },
  LV: { name: 'Latvia', region: 'eu', currency: 'EUR', typicalTuition: '€2k–€6k' },
  LT: { name: 'Lithuania', region: 'eu', currency: 'EUR', typicalTuition: '€2k–€6k' },
  CY: { name: 'Cyprus', region: 'eu', currency: 'EUR', typicalTuition: 'Free for EU (public, Greek-taught)' },
  MT: { name: 'Malta', region: 'eu', currency: 'EUR', typicalTuition: 'Free for EU' },
  CA: { name: 'Canada', region: 'other', currency: 'CAD', typicalTuition: 'CAD 7k domestic; CAD 20k–60k international' },
  AU: { name: 'Australia', region: 'other', currency: 'AUD', typicalTuition: 'AUD 20k–50k international' },
  NZ: { name: 'New Zealand', region: 'other', currency: 'NZD', typicalTuition: 'NZD 25k–45k international' },
  JP: { name: 'Japan', region: 'other', currency: 'JPY', typicalTuition: '¥535,800 at national universities' },
  KR: { name: 'South Korea', region: 'other', currency: 'KRW', typicalTuition: 'KRW 4–10 million' },
  CN: { name: 'China', region: 'other', currency: 'CNY', typicalTuition: 'CNY 20k–40k international' },
  HK: { name: 'Hong Kong', region: 'other', currency: 'HKD', typicalTuition: 'HKD 140k–200k non-local' },
  SG: { name: 'Singapore', region: 'other', currency: 'SGD', typicalTuition: 'SGD 17k–40k (with/without grant)' },
  TW: { name: 'Taiwan', region: 'other', currency: 'TWD', typicalTuition: 'TWD 100k–150k' },
  IN: { name: 'India', region: 'other', currency: 'INR' },
  IL: { name: 'Israel', region: 'other', currency: 'ILS' },
  TR: { name: 'Türkiye', region: 'other', currency: 'TRY' },
  AE: { name: 'United Arab Emirates', region: 'other', currency: 'AED' },
  SA: { name: 'Saudi Arabia', region: 'other', currency: 'SAR' },
  ZA: { name: 'South Africa', region: 'other', currency: 'ZAR' },
  EG: { name: 'Egypt', region: 'other', currency: 'EGP' },
  NG: { name: 'Nigeria', region: 'other', currency: 'NGN' },
  KE: { name: 'Kenya', region: 'other', currency: 'KES' },
  MA: { name: 'Morocco', region: 'other', currency: 'MAD' },
  BR: { name: 'Brazil', region: 'other', currency: 'BRL', typicalTuition: 'Free at federal universities' },
  MX: { name: 'Mexico', region: 'other', currency: 'MXN' },
  AR: { name: 'Argentina', region: 'other', currency: 'ARS', typicalTuition: 'Free at public universities' },
  CL: { name: 'Chile', region: 'other', currency: 'CLP' },
  CO: { name: 'Colombia', region: 'other', currency: 'COP' },
  PE: { name: 'Peru', region: 'other', currency: 'PEN' },
  RU: { name: 'Russia', region: 'other', currency: 'RUB' },
  UA: { name: 'Ukraine', region: 'other', currency: 'UAH' },
  RS: { name: 'Serbia', region: 'other', currency: 'RSD' },
  MY: { name: 'Malaysia', region: 'other', currency: 'MYR' },
  TH: { name: 'Thailand', region: 'other', currency: 'THB' },
  ID: { name: 'Indonesia', region: 'other', currency: 'IDR' },
  VN: { name: 'Vietnam', region: 'other', currency: 'VND' },
  PH: { name: 'Philippines', region: 'other', currency: 'PHP' },
  PK: { name: 'Pakistan', region: 'other', currency: 'PKR' },
  BD: { name: 'Bangladesh', region: 'other', currency: 'BDT' },
  IR: { name: 'Iran', region: 'other', currency: 'IRR' },
}

export const REGION_GROUPS: Array<{ id: string; label: string; countries: string[] }> = [
  { id: 'us', label: 'United States', countries: ['US'] },
  { id: 'uk', label: 'United Kingdom', countries: ['GB'] },
  {
    id: 'eu',
    label: 'European Union',
    countries: Object.entries(COUNTRIES)
      .filter(([, c]) => c.region === 'eu')
      .map(([k]) => k),
  },
  { id: 'dach', label: 'Germany, Austria, Switzerland', countries: ['DE', 'AT', 'CH'] },
  { id: 'nordics', label: 'Nordics', countries: ['SE', 'DK', 'FI', 'NO', 'IS'] },
  { id: 'anglo', label: 'English-speaking', countries: ['US', 'GB', 'IE', 'CA', 'AU', 'NZ'] },
]

export function countryName(code: string): string {
  return COUNTRIES[code]?.name ?? code
}

export function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
}

/** The fee that applies to a student from `origin` for this programme. */
export function feeFor(p: Programme, origin: Preferences['origin']): { amount: number; currency: string; estimated: boolean } | null {
  const t = p.tuition
  if (!t) return null
  const region = COUNTRIES[p.country]?.region
  let amount: number | undefined
  if (p.country === 'US') {
    // Nobody choosing from abroad is in-state; US students outside the state aren't either.
    amount = t.international ?? t.domestic
  } else if (p.country === 'GB') {
    amount = origin === 'uk' ? t.domestic : (t.international ?? undefined)
  } else if (p.country === 'CH') {
    amount = origin === 'ch' ? t.domestic : (t.international ?? t.domestic)
  } else if (region === 'eu' || region === 'eea') {
    const euLike = origin === 'eu' || origin === 'ch'
    amount = euLike ? (t.eu ?? t.domestic) : (t.international ?? t.eu ?? t.domestic)
  } else {
    amount = t.international ?? t.domestic
  }
  if (amount === undefined) return null
  return { amount, currency: t.currency, estimated: !!t.estimated }
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${Math.round(amount).toLocaleString('en')} ${currency}`
  }
}
