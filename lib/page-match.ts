/**
 * Pure helpers for finding a programme's own page on its institution's site
 * (scrapers/discover-programme-pages.ts): comparing names, reading a page's title and
 * first heading, and reading a sitemap. A page is only a candidate; a person checks it
 * before it is listed in lib/official-pages.ts.
 */

/** A text in plain letters: no accents, no capitals, no punctuation. */
export function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** The name without its level words and without brackets: «Master Historische und Kulturwissenschaften (fächerübergreifend)» becomes «historische und kulturwissenschaften». */
export function coreName(name: string): string {
  return plain(name.replace(/\([^)]*\)/g, ' '))
    .replace(/\b(bachelor|master|bsc|msc|ba|ma)\b/g, ' ')
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
export const STUDY_PATH = /(studium|studien|studies|study|formation|etude|étude|corsi|studi|studiengang|programm|program|bachelor|master|angebot|offre|offerta|ausbildung)/i
