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

/** Lines of a video or podcast description that are promotion, not content. */
const PROMO_LINE =
  /https?:\/\/|www\.|(^|\s)[@#]\w|\b(instagram|insta|tiktok|twitter|facebook|discord|patreon|twitch|spotify|apple podcasts|podcast|merch|shop|sponsor\w*|gesponsert|werbung|anzeige|affiliate|rabatt\w*|discount|promo|code|abonnier\w*|abo|subscribe|folg[te]? (uns|mir)|follow (us|me)|business|kontakt|contact|impressum|newsletter|link in bio|links|musik|music by|credits?|editor|schnitt|kamera|camera|gear|equipment|timestamps?|kapitel|chapters?)\b/i

/** A description without its promotion lines (links, socials, sponsors, credits). */
export function cleanDescription(text: string): string {
  return text
    .split(/\n+/)
    .filter((l) => l.trim() && !PROMO_LINE.test(l))
    .join(' \n ')
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'
}

/**
 * Choosing or living a degree, in any source: «Psychologie studieren: lohnt
 * sich das?», «day in the life of a psychology student», «was verdient ein
 * Psychologe», «Mein erstes Semester». That's the decision (or the degree you
 * are already in), not an interest in the subject, so it never counts.
 * Narrower than STUDY_INTENT: a watched «Stanford lecture on game theory» is
 * interest and stays.
 */
export const STUDY_CHOICE = new RegExp(
  '\\b(?:' +
    [
      // Psychologiestudium, Masterstudiengang, Studienwahl, Erstsemester …
      '\\w*(?:studium|studiums|studiengang|studiengangs|studiengänge|studienplatz|studienplätze|studienwahl|studienberatung|studienfach|studienfächer|studienführer|studienbeginn|studienstart|studienanfänger\\w*|studienordnung|studieninfo\\w*|semester\\w*)',
      'studier(?:en|e|st|t|te|ten|ende)',
      'student(?:in|innen|en|s)?',
      'studis?',
      'erstis?',
      'freshm[ae]n',
      'undergrad\\w*',
      'grad(?:uate)? school',
      'college (?:tour|life|vlog|application\\w*|essay\\w*|admission\\w*|decision\\w*)',
      'uni (?:vlog|tour|leben|alltag|life|day|start|bewerbung)',
      'campus ?(?:tour|life|leben)',
      'day in (?:the|my) life',
      'what i wish i knew before (?:studying|college|uni|university|starting)',
      'should (?:you|i) (?:study|major)',
      'was soll ich studieren',
      'welches studium',
      'what should i study',
      'which (?:degree|major)',
      '(?:bachelor|master)\'?s? (?:degree|of|in|programm?e?|thesis|abschluss|student)',
      'degree (?:in|worth|programm?e?|options|requirements)',
      '(?:college|university|online|bachelor\'?s?|master\'?s?|\\w+ology|\\w+ics) degree',
      'a degree in',
      'with a degree',
      'major(?:ing)? in',
      'minor in',
      'nebenfach',
      'hauptfach',
      'zulassung\\w*',
      'aufnahme(?:prüfung|test|verfahren)\\w*',
      'eignungs(?:test|abklärung|prüfung)\\w*',
      'numerus clausus',
      'nc',
      'admission\\w*',
      'anmeldefrist\\w*',
      'immatrikulation\\w*',
      'einschreibung',
      'infotag\\w*',
      'info ?abend\\w*',
      'informationsveranstaltung\\w*',
      'open day',
      'tag der offenen tür',
      'berufsaussicht\\w*',
      'jobaussicht\\w*',
      'karriere ?(?:chancen|möglichkeiten|aussichten)',
      'career (?:path|options|prospects|advice)',
      'careers? (?:in|as|with)',
      'jobs? (?:with|for|als|mit)',
      'was verdient',
      'verdienst',
      'lohn',
      'löhne',
      'einstiegslohn',
      'gehalt',
      'gehälter',
      'salary',
      'salaries',
      'wie wird man',
      'how to become',
      '(?:uni(?:versity|versities)?|college) rankings?',
      'best (?:universities|unis|colleges) (?:for|in)',
      'top (?:universities|unis|colleges)',
      'berufsberatung',
      'laufbahnberatung',
      'berufswahl',
      'bsc',
      'msc',
      'mba',
    ].join('|') +
    ')\\b',
  'i',
)

/**
 * Searches and pages about studying itself: programmes, universities,
 * deadlines, admission, and the coursework of a degree you're already in.
 * Looking up «soziologie uzh master» or «psychologie prüfung zusammenfassung»
 * is the study, not an interest, so it mustn't feed the recommendation.
 * Broader than STUDY_CHOICE, so only for searches and visited pages.
 */
export const STUDY_INTENT =
  /\b(studium|studieren|studiengang|studiengänge|studienplan|studienordnung|bachelor|master|msc|bsc|doktorat|phd|vorlesungsverzeichnis|anmeldefrist|anmeldung studium|immatrikulation|zulassung|numerus clausus|minor|major|semestergebühr\w*|uni|university|universität|universitaet|hochschule|fachhochschule|degree|admission|uzh|ethz?|epfl|unibe|unibas|unifr|unige|unil|unilu|unisg|hsg|usi|zhaw|fhnw|bfh|hslu|supsi|hes-so|zhdk|phzh|lmu|tum|kit|rwth|uni wien|tu wien|jku|klausur\w*|prüfung\w*|pruefung\w*|zusammenfassung|skript|hausarbeit|seminararbeit|bachelorarbeit|masterarbeit|moodle|ilias|olat|zitieren|literaturverzeichnis|exam|assignment|syllabus|studyprogrammes|berufsberatung|hochschulkompass|studycheck|studis-online)\b|\.edu\b|\.ac\.[a-z]{2}\b|\buni-[a-z]+\.(de|at)\b/i

/** Study info for one item: STUDY_CHOICE anywhere, STUDY_INTENT in searches and visited pages. */
export function isStudyInfo(text: string, kind: string): boolean {
  return STUDY_CHOICE.test(text) || ((kind === 'search' || kind === 'google' || kind === 'visit') && STUDY_INTENT.test(text))
}
