import type { Preferences } from '../engine/types.ts'

/**
 * One codebase, four sites: the global English site and a German-language site
 * each for Switzerland, Germany and Austria. A country site lives at its
 * mount (/schweiz, /deutschland, /oesterreich) until it gets its own domain;
 * proxy.ts then serves it at that domain's root through its domain mount.
 */

export type SiteId = 'global' | 'ch' | 'de' | 'at'
export type LocalSiteId = Exclude<SiteId, 'global'>
/** Language and region: Swiss, German and Austrian Standard German differ in spelling and words. */
export type Locale = 'en' | 'de-CH' | 'de-DE' | 'de-AT'

export interface SiteConf {
  id: SiteId
  locale: Locale
  /** BCP 47 tag for Intl formatting. */
  intl: string
  ogLocale: string
  name: string
  /** The name split for the two-colour wordmark. */
  wordmark: [string, string]
  storeKey: string
  defaultPrefs: Preferences
  currency: string
  /** Country sites only. */
  country?: string
  mount?: string
  domainMount?: string
  /** The site's own domain, once it has one (e.g. https://wasstudiere.ch). */
  domainUrl: string
}

const clean = (u: string | undefined) => (u ?? '').trim().replace(/\/$/, '')
const wordmark = (name: string, fallback: string, split: [string, string]): [string, string] => (name === fallback ? split : [name, ''])

// Literal process.env reads: Next inlines NEXT_PUBLIC_ values only when written out.
export const CH_NAME = process.env.NEXT_PUBLIC_CH_NAME || 'wasstudiere'
export const DE_NAME = process.env.NEXT_PUBLIC_DE_NAME || 'wassollichstudieren'
export const AT_NAME = process.env.NEXT_PUBLIC_AT_NAME || 'wasstudierich'

const prefs = (countries: string[], origin: Preferences['origin']): Preferences => ({ level: 'bachelor', countries, maxTuitionEur: 0, origin, englishOnly: false })

export const SITES: Record<SiteId, SiteConf> = {
  global: {
    id: 'global',
    locale: 'en',
    intl: 'en',
    ogLocale: 'en',
    name: 'whatshouldistudy',
    wordmark: ['whatshouldi', 'study'],
    storeKey: 'wsis:v1',
    defaultPrefs: prefs([], 'eu'),
    currency: 'USD',
    domainUrl: '',
  },
  ch: {
    id: 'ch',
    locale: 'de-CH',
    intl: 'de-CH',
    ogLocale: 'de_CH',
    name: CH_NAME,
    wordmark: wordmark(CH_NAME, 'wasstudiere', ['was', 'studiere']),
    storeKey: 'wsis:v1:ch',
    defaultPrefs: prefs(['CH'], 'ch'),
    currency: 'CHF',
    country: 'CH',
    mount: 'schweiz',
    domainMount: 'ch-site',
    domainUrl: clean(process.env.NEXT_PUBLIC_CH_URL),
  },
  de: {
    id: 'de',
    locale: 'de-DE',
    intl: 'de-DE',
    ogLocale: 'de_DE',
    name: DE_NAME,
    wordmark: wordmark(DE_NAME, 'wassollichstudieren', ['wassollich', 'studieren']),
    storeKey: 'wsis:v1:de',
    defaultPrefs: prefs(['DE'], 'eu'),
    currency: 'EUR',
    country: 'DE',
    mount: 'deutschland',
    domainMount: 'de-site',
    domainUrl: clean(process.env.NEXT_PUBLIC_DE_URL),
  },
  at: {
    id: 'at',
    locale: 'de-AT',
    intl: 'de-AT',
    ogLocale: 'de_AT',
    name: AT_NAME,
    wordmark: wordmark(AT_NAME, 'wasstudierich', ['was', 'studierich']),
    storeKey: 'wsis:v1:at',
    defaultPrefs: prefs(['AT'], 'eu'),
    currency: 'EUR',
    country: 'AT',
    mount: 'oesterreich',
    domainMount: 'at-site',
    domainUrl: clean(process.env.NEXT_PUBLIC_AT_URL),
  },
}

export const LOCAL_SITES: LocalSiteId[] = ['ch', 'de', 'at']
export const isLocal = (site: SiteId): site is LocalSiteId => site !== 'global'
export const isGerman = (locale: Locale) => locale !== 'en'

export interface Routes {
  home: string
  start: string
  results: string
  fields: string
  field: (id: string) => string
  how: string
  privacy: string
  terms: string
  imprint: string
  unlocked: string
  /** Plans for schools and counselling services, and where their subscription lands. */
  orgs: string
  orgWelcome: string
  callback: (provider: string) => string
  anchors: { sources: string; questionnaire: string; prefs: string; programmes: string; data: string }
}

/** Links inside a site. `base` is '' on the site's own domain, '/schweiz' etc. under the global one. */
export function routes(site: SiteId, base = ''): Routes {
  if (isLocal(site)) {
    return {
      home: base || '/',
      start: `${base}/start`,
      results: `${base}/resultat`,
      fields: `${base}/faecher`,
      field: (id) => `${base}/faecher/${id}`,
      how: `${base}/so-funktionierts`,
      privacy: `${base}/datenschutz`,
      terms: `${base}/agb`,
      imprint: `${base}/impressum`,
      unlocked: `${base}/freigeschaltet`,
      orgs: `${base}/organisationen`,
      orgWelcome: `${base}/organisationen/willkommen`,
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
    imprint: '/imprint',
    unlocked: '/unlocked',
    orgs: '/organisations',
    orgWelcome: '/organisations/welcome',
    callback: (p) => `/callback/${p}`,
    anchors: { sources: 'sources', questionnaire: 'questionnaire', prefs: 'preferences', programmes: 'programmes', data: 'data' },
  }
}

/** Props every shared view receives. */
export interface SiteProps {
  site: SiteId
  base: string
}
