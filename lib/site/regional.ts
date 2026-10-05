import type { Locale } from './config.ts'

/**
 * The German texts are written in Swiss Standard German. Germany and Austria
 * get the same texts with ß, „“ quotes, 10.000 and their own words. Content
 * that differs in substance (data sources, school types, law) is overridden in
 * dict.ts, not here.
 */

/** Swiss ss spellings that are ß elsewhere. Only whole words, so «muss» and «Wasser» stay. */
const ESZETT = [
  'gross', 'grosse', 'grossen', 'grosser', 'grosses', 'grösser', 'grösste', 'grössten', 'Grossbritannien', 'Grossen', 'Grosse',
  'weiss', 'Weisst', 'weisst', 'heisst', 'heissen', 'draussen', 'Draussen', 'ausser', 'ausserdem', 'Fussabdruck', 'Fussball',
  'regelmässig', 'regelmässige', 'mässig', 'Massstab', 'massgebend', 'Massgebend', 'Spass', 'liess', 'liessen', 'anreissen',
  'schliesst', 'schliessen', 'fliessen', 'fliesst', 'Strasse', 'Strassen', 'gemäss', 'Gruss', 'beissen', 'reissen', 'blosse', 'bloss',
]
const ESZETT_RE = new RegExp(`(?<![\\p{L}])(${ESZETT.join('|')})(?![\\p{L}])`, 'gu')

/** Words, longest first. Germany and Austria share most of them. */
const WORDS: Record<'de-DE' | 'de-AT', Array<[RegExp, string]>> = {
  'de-DE': [
    [/Resultate\b/g, 'Ergebnisse'],
    [/Resultat/g, 'Ergebnis'],
    [/Medianlohn/g, 'Mediangehalt'],
    [/Hoher Lohn/g, 'Hohes Gehalt'],
    [/\bLohn\b/g, 'Gehalt'],
    [/\binnert\b/g, 'innerhalb von'],
    [/Major-Minor-Studium/g, 'Zwei-Fach-Studium'],
    [/Bildnerisches Gestalten/g, 'Kunst'],
    [/\bim Spital\b/g, 'im Krankenhaus'],
    [/\bSpital\b/g, 'Krankenhaus'],
    [/Pflegefachperson/g, 'Pflegefachkraft'],
    [/\bDoktorat\b/g, 'Promotion'],
  ],
  'de-AT': [
    [/Resultate\b/g, 'Ergebnisse'],
    [/Resultat/g, 'Ergebnis'],
    [/Medianlohn/g, 'Mediangehalt'],
    [/Hoher Lohn/g, 'Hohes Gehalt'],
    [/\bLohn\b/g, 'Gehalt'],
    [/\binnert\b/g, 'innerhalb von'],
    [/Major-Minor-Studium/g, 'Erweiterungsstudium'],
    [/Bildnerisches Gestalten/g, 'Bildnerische Erziehung'],
    [/Pflegefachperson/g, 'Pflegefachkraft'],
  ],
}

export function regionalize(s: string, locale: Locale): string {
  if (locale !== 'de-DE' && locale !== 'de-AT') return s
  let out = s.replace(ESZETT_RE, (w) => w.replace(/ss/g, 'ß'))
  for (const [re, to] of WORDS[locale]) out = out.replace(re, to)
  return (
    out
      // «…» → „…“
      .replace(/«/g, '„')
      .replace(/»/g, '“')
      // 10’000 → 10.000
      .replace(/(\d)[’'](\d{3})/g, '$1.$2')
  )
}

/** The same object with every string (and every string a function returns) regionalized. */
export function regionalizeDeep<T>(value: T, locale: Locale): T {
  if (typeof value === 'string') return regionalize(value, locale) as T
  if (typeof value === 'function') {
    const fn = value as unknown as (...a: unknown[]) => unknown
    return ((...a: unknown[]) => regionalizeDeep(fn(...a), locale)) as T
  }
  if (Array.isArray(value)) return value.map((v) => regionalizeDeep(v, locale)) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, regionalizeDeep(v, locale)])) as T
  return value
}

/** Overrides on top of a dictionary: plain objects merge, everything else replaces. */
export function mergeDeep<T>(base: T, over: unknown): T {
  if (!over || typeof over !== 'object' || Array.isArray(over) || typeof base !== 'object' || base === null || Array.isArray(base)) return (over ?? base) as T
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) out[k] = mergeDeep(out[k], v)
  return out as T
}

export type DeepPartial<T> = T extends (...a: never[]) => unknown ? T : T extends Array<unknown> ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T
