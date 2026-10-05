import { CH_ADMISSION } from './ch-institutions.ts'

/**
 * Kinds of higher education institution in Switzerland, Germany and Austria,
 * with what they are called and who gets in. Programmes carry the kind in
 * `institutionType`; the admission rule is stored in German and shown in the
 * site's language from here.
 */

export type InstType = 'uni' | 'eth' | 'fh' | 'ph' | 'dual' | 'art' | 'priv' | 'theo' | 'admin'
type Text = { de: string; en: string }

export const TYPE_LABEL: Record<InstType, Text & { short: string }> = {
  uni: { de: 'Universität', en: 'University', short: 'UNI' },
  eth: { de: 'ETH', en: 'Federal Institute of Technology', short: 'ETH' },
  fh: { de: 'Fachhochschule', en: 'University of Applied Sciences', short: 'FH' },
  ph: { de: 'Pädagogische Hochschule', en: 'University of Teacher Education', short: 'PH' },
  dual: { de: 'Duale Hochschule', en: 'Cooperative university', short: 'DUAL' },
  art: { de: 'Kunst- und Musikhochschule', en: 'University of Art and Music', short: 'KUNST' },
  priv: { de: 'Privathochschule', en: 'Private university', short: 'PRIVAT' },
  theo: { de: 'Theologische Hochschule', en: 'Theological college', short: 'THEO' },
  admin: { de: 'Verwaltungshochschule', en: 'College of public administration', short: 'VERW' },
}

/** Germany calls them Hochschulen für angewandte Wissenschaften. */
export function typeLabel(type: InstType, country: string | undefined, locale: 'de' | 'en'): string {
  if (type === 'fh' && country === 'DE') return locale === 'de' ? 'Hochschule für angewandte Wissenschaften' : 'University of Applied Sciences'
  return TYPE_LABEL[type][locale]
}

export function typeShort(type: InstType, country: string | undefined): string {
  return type === 'fh' && country === 'DE' ? 'HAW' : TYPE_LABEL[type].short
}

export const ADMISSION: Record<string, Partial<Record<InstType, Text>>> = {
  CH: CH_ADMISSION,
  DE: {
    uni: {
      de: 'Abitur oder fachgebundene Hochschulreife · beruflich Qualifizierte nach Landesrecht · bei Zulassungsbeschränkung Auswahl nach Note',
      en: 'Abitur or subject-specific entrance qualification · vocationally qualified applicants under state law · selection by grade where places are limited',
    },
    fh: {
      de: 'Fachhochschulreife oder Abitur · beruflich Qualifizierte nach Landesrecht',
      en: 'Fachhochschulreife or Abitur · vocationally qualified applicants under state law',
    },
    dual: {
      de: 'Hochschulreife plus Studienvertrag mit einem Partnerunternehmen',
      en: 'Entrance qualification plus a study contract with a partner company',
    },
    art: {
      de: 'Künstlerische Eignungsprüfung, meist zusätzlich Hochschulreife',
      en: 'Artistic aptitude test, usually plus an entrance qualification',
    },
    ph: { de: 'Abitur oder fachgebundene Hochschulreife', en: 'Abitur or subject-specific entrance qualification' },
    theo: { de: 'Abitur, je nach Hochschule kirchliche Voraussetzungen', en: 'Abitur, plus church requirements at some colleges' },
    admin: { de: 'Ausbildungsplatz bei einer Behörde (Anwärter:in)', en: 'A traineeship with a public authority' },
    priv: { de: 'Hochschulreife und Aufnahmeverfahren der Hochschule', en: 'Entrance qualification and the university’s own admission' },
  },
  AT: {
    uni: {
      de: 'Matura, Berufsreifeprüfung oder Studienberechtigungsprüfung · in vielen Fächern Aufnahmeverfahren (z. B. MedAT, Psychologie)',
      en: 'Matura, Berufsreifeprüfung or Studienberechtigungsprüfung · entrance procedures in many subjects (e.g. MedAT, psychology)',
    },
    art: {
      de: 'Zulassungsprüfung (künstlerische Eignung), Matura nicht immer nötig',
      en: 'Admission exam (artistic aptitude), Matura not always required',
    },
    fh: {
      de: 'Matura oder einschlägige berufliche Qualifikation · Aufnahmeverfahren, begrenzte Plätze',
      en: 'Matura or relevant vocational qualification · admission procedure, limited places',
    },
    ph: { de: 'Matura · Eignungsfeststellung', en: 'Matura · aptitude assessment' },
    priv: { de: 'Matura · Aufnahmeverfahren der Privathochschule', en: 'Matura · the private university’s admission procedure' },
  },
}

export function admissionText(country: string | undefined, type: string | undefined, locale: 'de' | 'en'): string | undefined {
  return country && type ? ADMISSION[country]?.[type as InstType]?.[locale] : undefined
}

/** The kinds shown on a country site's landing page. */
export const SCHOOL_TYPES: Record<string, InstType[]> = {
  CH: ['uni', 'eth', 'fh', 'ph'],
  DE: ['uni', 'fh', 'dual', 'art'],
  AT: ['uni', 'fh', 'ph', 'priv'],
}

export const TYPE_STYLE: Record<InstType, { color: string; glyph: string }> = {
  uni: { color: 'var(--sky)', glyph: '🏛️' },
  eth: { color: 'var(--pink)', glyph: '🔬' },
  fh: { color: 'var(--lime)', glyph: '🛠️' },
  ph: { color: 'var(--yellow)', glyph: '🍎' },
  dual: { color: 'var(--orange)', glyph: '🏭' },
  art: { color: 'var(--violet)', glyph: '🎨' },
  priv: { color: 'var(--pink)', glyph: '🔑' },
  theo: { color: 'var(--yellow)', glyph: '🕊️' },
  admin: { color: 'var(--sky)', glyph: '🏢' },
}
