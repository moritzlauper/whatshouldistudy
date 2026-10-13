/**
 * Pure helpers for finding a programme's own page on its institution's site
 * (scrapers/discover-programme-pages.ts): comparing names, reading a page's title and
 * first heading, and reading a sitemap. Automatic matches additionally need explicit
 * degree evidence; manually checked exceptions stay in lib/official-pages.ts.
 */

/** A text in plain letters: no accents, no capitals, no punctuation. */
export function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** The name without its level words and without brackets: «Master Historische und Kulturwissenschaften (fächerübergreifend)» becomes «historische und kulturwissenschaften». */
export function coreName(name: string): string {
  return plain(name.replace(/\([^)]*\)/g, ' '))
    .replace(/\b(bachelor|master)(?: s)?(?: of (?:science|arts|engineering|technology))?(?: in| of| i)?\b/g, ' ')
    .replace(/\b(bsc|msc|bs|ms|ba|ma|beng|meng|phd|doctorate|licence|licenciatura|kandidaatti|kandidat|maisteri)\b/g, ' ')
    .replace(/(?:학사|석사|박사|학부)(?:\s*과정)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The levels a text names: bachelor, master, or both. */
export function levelsIn(text: string): Set<'bachelor' | 'master'> {
  const t = plain(text)
  const out = new Set<'bachelor' | 'master'>()
  // «Masterstudium» and «Bachelorstudium» count too: the level word starts the word.
  if (/\b(bachelor|bsc)|\bba\b/.test(t)) out.add('bachelor')
  if (/\b(master|msc)|\bma\b/.test(t)) out.add('master')
  return out
}

/** Whether a page's title or first heading names the programme, and does not name the other level. */
export function namesProgramme(programme: { name: string; level: string }, title: string, heading: string): boolean {
  const core = coreName(programme.name)
  if (core.length < 4) return false
  // The title has to name it; the first heading only backs that up, since a heading can be a menu.
  if (!` ${plain(title)} `.includes(` ${core} `)) return false
  const levels = levelsIn(`${heading} ${title}`)
  const other = programme.level === 'master' ? 'bachelor' : 'master'
  return !levels.has(other) || levels.has(programme.level as 'bachelor' | 'master')
}

/** The title and first heading of an HTML page, as plain text. */
export function headingsOf(html: string): { title: string; heading: string } {
  const clean = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return {
    title: clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? ''),
    heading: clean(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? ''),
  }
}

/** The addresses listed in a sitemap, the <loc> entries. */
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+?)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'))
}

/** Pages about events, news or single people are not a programme's own page. */
export const NOT_A_PROGRAMME = /(veranstaltung|event|news|medien|press|presse|testimonial|podcast|blog|magazin|aktuell|feier|archiv|kosten)/i

/** The words that mark a study page in an address, in the languages of the country. */
export const STUDY_PATH = /(studium|studien|studies|study|formation|formazione|etude|étude|corsi|studi|programm|program|bachelor|master|angebot|offre|offerta|ausbildung|course|degree|academic|major|opleiding|utdanning|studie|koulutus|tutkinto|opiskelu|학과|전공|대학|학부)/i

/** Automatic discovery needs positive degree evidence, not just a matching subject. */
export function verifiedProgrammeTitle(p: { name: string; level: string }, title: string, heading: string): boolean {
  if (!namesProgramme(p, title, heading)) return false
  // A joint degree such as «Computer Science with Mathematics» must not be
  // silently assigned to the plain «Computer Science» programme.
  const core = coreName(p.name)
  if (!title.split(/\s*[|–—]\s*|\s+-\s+/).some((part) => coreName(part) === core)) return false
  const text = plain(`${title} ${heading}`)
  const evidence: Record<string, RegExp> = {
    bachelor: /\b(bachelor\w*|bsc|bs|ba|beng|undergraduate|licence|kandidaatti|kandidat)\b|학사|학부/,
    master: /\b(master\w*|msc|ms|ma|meng|maisteri)\b|석사/,
    doctorate: /\b(phd|doctor\w*|tohtori|ph d)\b|박사/,
    short: /\b(associate|foundation|hnd|bts|dut)\b/,
    integrated: /\b(integrated|integre|diplomi insinoori)\b/,
    professional: /\b(medicine|dentistry|veterinary|medecine|medisin)\b/,
  }
  return evidence[p.level]?.test(text) ?? false
}
