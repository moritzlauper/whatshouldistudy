import type { Preferences } from '../engine/types.ts'
import { fieldSlugDe } from './slugs-de.ts'
import { countrySlug } from '../catalogue.ts'

/**
 * One codebase, four sites: the global English site and a German-language site
 * each for Switzerland, Germany and Austria. A country site lives at its
 * mount (/schweiz, /deutschland, /oesterreich) until it gets its own domain;
 * proxy.ts then serves it at that domain's root through its domain mount.
 */

export type SiteId = 'global' | 'ch' | 'de' | 'at'
export type LocalSiteId = Exclude<SiteId, 'global'>
/** Language and region: Swiss, German and Austrian Standard German differ in spelling and words. */
export type Locale = 'en' | 'de-CH' | 'de-DE' | 'de-AT' | 'fr-CH' | 'it-CH'

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
  /** The site's own domain, once it has one (e.g. https://wasstudieren.ch). */
  domainUrl: string
}

const clean = (u: string | undefined) => (u ?? '').trim().replace(/\/$/, '')
const wordmark = (name: string, fallback: string, split: [string, string]): [string, string] => (name === fallback ? split : [name, ''])

// Literal process.env reads: Next inlines NEXT_PUBLIC_ values only when written out.
export const CH_NAME = process.env.NEXT_PUBLIC_CH_NAME || 'wasstudieren'
export const DE_NAME = process.env.NEXT_PUBLIC_DE_NAME || 'findemeinstudium'
export const AT_NAME = process.env.NEXT_PUBLIC_AT_NAME || 'wasstudieren'

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
    wordmark: wordmark(CH_NAME, 'wasstudieren', ['was', 'studieren']),
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
    wordmark: wordmark(DE_NAME, 'findemeinstudium', ['findemein', 'studium']),
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
    wordmark: wordmark(AT_NAME, 'wasstudieren', ['was', 'studieren']),
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
export const isGerman = (locale: Locale) => locale.startsWith('de-')

/** Path prefixes of the Swiss site's French and Italian versions, on its own domain. */
export const CH_LANGUAGES = ['fr', 'it'] as const
export const isChFrIt = (locale: Locale) => locale === 'fr-CH' || locale === 'it-CH'
/** A domain of their own for the French and Italian versions (e.g. https://whatshouldistudy.ch), since the Swiss name is German. Without it they live on the Swiss domain. */
export const CH_FR_IT_URL = clean(process.env.NEXT_PUBLIC_CH_FR_IT_URL)
export const CH_FR_IT_NAME = process.env.NEXT_PUBLIC_CH_FR_IT_NAME || 'whatshouldistudy'

/** A site's settings in one of its languages: the Swiss French and Italian versions have their own name. */
export function siteConf(site: SiteId, locale = SITES[site].locale): SiteConf {
  const c = SITES[site]
  if (locale === c.locale) return c
  const name = isChFrIt(locale) ? { name: CH_FR_IT_NAME, wordmark: wordmark(CH_FR_IT_NAME, 'whatshouldistudy', ['whatshouldi', 'study']) } : {}
  return { ...c, locale, intl: locale, ogLocale: locale.replace('-', '_'), ...name }
}

const ANCHORS: Record<'de' | 'fr' | 'it', Routes['anchors']> = {
  de: { sources: 'quellen', questionnaire: 'fragebogen', prefs: 'wohin', programmes: 'studiengaenge', data: 'daten' },
  fr: { sources: 'sources', questionnaire: 'questionnaire', prefs: 'preferences', programmes: 'programmes', data: 'donnees' },
  it: { sources: 'fonti', questionnaire: 'questionario', prefs: 'preferenze', programmes: 'corsi', data: 'dati' },
}

export interface Routes {
  home: string
  start: string
  results: string
  fields: string
  field: (id: string) => string
  /** The free programme catalogue: every country on the global site, the site's own country on a country site. */
  programmes: string
  country: (cc: string) => string
  countryField: (cc: string, id: string) => string
  how: string
  /** The free lesson for teachers and the link for school websites. */
  teachers: string
  /** The weekly articles (German and English only). */
  blog: string
  post: (slug: string) => string
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
export function routes(site: SiteId, base = '', locale = SITES[site].locale): Routes {
  if (isLocal(site)) {
    // French and Italian live below /fr and /it of the Swiss site, with the same page names.
    const lang = locale === 'fr-CH' ? 'fr' : locale === 'it-CH' ? 'it' : ''
    const root = lang ? `${base}/${lang}` : base
    return {
      home: root || '/',
      start: `${root}/start`,
      results: `${root}/resultat`,
      fields: `${root}/faecher`,
      field: (id) => `${root}/faecher/${fieldSlugDe(id)}`,
      // A country site lists its own country only.
      programmes: `${root}/studiengaenge`,
      country: () => `${root}/studiengaenge`,
      countryField: (_cc, id) => `${root}/studiengaenge/${fieldSlugDe(id)}`,
      how: `${root}/so-funktionierts`,
      teachers: `${root}/lehrpersonen`,
      blog: `${root}/blog`,
      post: (slug) => `${root}/blog/${slug}`,
      privacy: `${root}/datenschutz`,
      terms: `${root}/agb`,
      imprint: `${root}/impressum`,
      unlocked: `${root}/freigeschaltet`,
      orgs: `${root}/organisationen`,
      orgWelcome: `${root}/organisationen/willkommen`,
      callback: (p) => `${root}/callback/${p}`,
      anchors: ANCHORS[lang || 'de'],
    }
  }
  return {
    home: '/',
    start: '/start',
    results: '/results',
    fields: '/fields',
    field: (id) => `/fields/${id}`,
    programmes: '/programmes',
    country: (cc) => `/programmes/${countrySlug(cc)}`,
    countryField: (cc, id) => `/programmes/${countrySlug(cc)}/${id}`,
    how: '/how-it-works',
    teachers: '/teachers',
    blog: '/blog',
    post: (slug) => `/blog/${slug}`,
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
  locale?: Locale
}
