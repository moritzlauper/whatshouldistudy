import type { Preferences } from '../engine/types.ts'

/**
 * Two sites from one codebase: the global English site and the Swiss German
 * site. The Swiss pages live under /schweiz; on its own domain (WSIS_CH_HOSTS)
 * proxy.ts serves them at the root.
 */

export type SiteId = 'global' | 'ch'
export type Locale = 'en' | 'de'

export interface SiteConf {
  id: SiteId
  locale: Locale
  /** BCP 47 tag for Intl formatting. */
  intl: string
  name: string
  /** The name split for the two-colour wordmark. */
  wordmark: [string, string]
  storeKey: string
  defaultPrefs: Preferences
  currency: string
}

export const CH_NAME = process.env.NEXT_PUBLIC_CH_NAME ?? 'wasstudiere'

export const SITES: Record<SiteId, SiteConf> = {
  global: {
    id: 'global',
    locale: 'en',
    intl: 'en',
    name: 'whatshouldistudy',
    wordmark: ['whatshouldi', 'study'],
    storeKey: 'wsis:v1',
    defaultPrefs: { level: 'bachelor', countries: [], maxTuitionEur: 0, origin: 'eu', englishOnly: false },
    currency: 'USD',
  },
  ch: {
    id: 'ch',
    locale: 'de',
    intl: 'de-CH',
    name: CH_NAME,
    wordmark: CH_NAME === 'wasstudiere' ? ['was', 'studiere'] : [CH_NAME, ''],
    storeKey: 'wsis:v1:ch',
    defaultPrefs: { level: 'bachelor', countries: ['CH'], maxTuitionEur: 0, origin: 'ch', englishOnly: false },
    currency: 'CHF',
  },
}

export interface Routes {
  home: string
  start: string
  results: string
  fields: string
  field: (id: string) => string
  how: string
  privacy: string
  terms: string
  unlocked: string
  callback: (provider: string) => string
  anchors: { sources: string; questionnaire: string; prefs: string; programmes: string; data: string }
}

/** Links for a site. `base` is '' on the site's own domain, '/schweiz' under the global one. */
export function routes(site: SiteId, base = ''): Routes {
  if (site === 'ch') {
    return {
      home: base || '/',
      start: `${base}/start`,
      results: `${base}/resultat`,
      fields: `${base}/faecher`,
      field: (id) => `${base}/faecher/${id}`,
      how: `${base}/so-funktionierts`,
      privacy: `${base}/datenschutz`,
      terms: `${base}/agb`,
      unlocked: `${base}/freigeschaltet`,
      callback: (p) => `${base}/callback/${p}`,
      anchors: { sources: 'quellen', questionnaire: 'fragebogen', prefs: 'wohin', programmes: 'studiengaenge', data: 'daten' },
    }
  }
  return {
    home: '/',
    start: '/start',
    results: '/results',
    fields: '/fields',
    field: (id) => `/fields/${id}`,
    how: '/how-it-works',
    privacy: '/privacy',
    terms: '/terms',
    unlocked: '/unlocked',
    callback: (p) => `/callback/${p}`,
    anchors: { sources: 'sources', questionnaire: 'questionnaire', prefs: 'preferences', programmes: 'programmes', data: 'data' },
  }
}

/** Props every shared view receives. */
export interface SiteProps {
  site: SiteId
  base: string
}
