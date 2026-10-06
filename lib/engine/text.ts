/**
 * Text normalisation shared by the lexicon compiler, the classifier and the
 * scrapers: lowercase, accents stripped, everything that isn't a letter or a
 * digit becomes a single space.
 */

const SPECIAL: Array<[RegExp, string]> = [
  [/c\+\+/gi, ' cplusplus '],
  [/c#/gi, ' csharp '],
  [/\.net\b/gi, ' dotnet '],
  // French "j'ai" would otherwise leave a stray "ai" token behind.
  [/\bj['’]ai\b/gi, ' jai '],
]

const LIGATURES: Record<string, string> = { ß: 'ss', œ: 'oe', æ: 'ae', ø: 'o', ł: 'l', đ: 'd', ı: 'i' }

export function normalize(text: string, opts: { splitCamel?: boolean } = {}): string {
  let s = text
  for (const [re, rep] of SPECIAL) s = s.replace(re, rep)
  if (opts.splitCamel) s = s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ßœæøłđı]/g, (c) => LIGATURES[c] ?? c)
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function tokens(normalized: string): string[] {
  return normalized ? normalized.split(' ') : []
}

/** Case-preserving tokens for case-sensitive terms such as `=AI`. */
export function rawTokens(text: string): Set<string> {
  return new Set(text.split(/[^\p{L}\p{N}]+/u).filter(Boolean))
}

/** Splits `term:2.5` into term and weight. */
export function parseWeighted(entry: string): { term: string; weight: number } {
  const m = /^(.*?):(\d+(?:\.\d+)?)$/.exec(entry.trim())
  if (m) return { term: m[1], weight: Number(m[2]) }
  return { term: entry.trim(), weight: 1 }
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'
}

/**
 * Searches and pages about studying itself: programmes, universities,
 * deadlines, admission. Looking up «soziologie uzh master» shows a decision
 * already being made, so it mustn't feed the recommendation.
 */
export const STUDY_INTENT =
  /\b(studium|studieren|studiengang|studiengänge|studienplan|studienordnung|bachelor|master|msc|bsc|doktorat|phd|vorlesungsverzeichnis|anmeldefrist|anmeldung studium|immatrikulation|zulassung|numerus clausus|minor|major|semestergebühr\w*|university|universität|universitaet|hochschule|fachhochschule|degree|admission|uzh|ethz?|epfl|unibe|unibas|unifr|unige|unil|unilu|unisg|hsg|usi|zhaw|fhnw|bfh|hslu|supsi|hes-so|zhdk|phzh|lmu|tum|kit|rwth|uni wien|tu wien|jku)\b/i
