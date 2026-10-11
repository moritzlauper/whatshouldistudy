/**
 * The checks behind the facts read from a programme's official page
 * (lib/server/official-facts.ts): whether the page may be read, its visible
 * text, and which of Claude's answers the page backs up word for word.
 */

export interface OfficialFacts {
  /** Specialisations, majors, profiles or tracks, by their names on the page. */
  specialisations: string[]
  /** The page says there are no fixed specialisations; modules are chosen freely. */
  freeChoice: boolean
  partTime: boolean
  /** Semesters in which the programme can be started. */
  start: Array<'autumn' | 'spring'>
  /** An internship or practical semester is part of the programme. */
  internship: boolean
  /** The degree as the page names it, e.g. «Bachelor of Science UZH in Psychologie». */
  degree?: string
}

/** Both addresses belong to the same institution (uzh.ch, www.psychologie.uzh.ch). */
export function sameSite(a: string, b: string): boolean {
  // Three labels where the second-level name is a shared suffix (ox.ac.uk, not ac.uk).
  const root = (u: string) => {
    const parts = new URL(u).hostname.replace(/^www\./, '').split('.')
    const shared = parts.length > 2 && /^(ac|co|com|edu|gov|org|net)$/.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2
    return parts.slice(shared ? -3 : -2).join('.')
  }
  try {
    return root(a) === root(b)
  } catch {
    return false
  }
}

/** Whether robots.txt lets any crawler read `url` (the rules for `*`, with `*` and `$` patterns). */
export function robotsAllow(robots: string, url: string): boolean {
  const path = new URL(url).pathname + new URL(url).search
  let applies = false
  let inAgents = false
  const rules: Array<[boolean, string]> = []
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line)
    if (!m) continue
    const key = m[1].toLowerCase()
    if (key === 'user-agent') {
      if (!inAgents) applies = false
      inAgents = true
      if (m[2].trim() === '*') applies = true
      continue
    }
    inAgents = false
    if (applies && (key === 'allow' || key === 'disallow') && m[2].trim()) rules.push([key === 'allow', m[2].trim()])
  }
  // The longest matching rule wins, as with the major search engines.
  let best: [boolean, string] | undefined
  for (const rule of rules) {
    const re = new RegExp(`^${rule[1].replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`)
    if (re.test(path) && (!best || rule[1].length > best[1].length)) best = rule
  }
  return best ? best[0] : true
}

// Named entities on university pages: accents of German, French and Italian, and punctuation.
const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', shy: '', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•',
  ...Object.fromEntries(
    [...'aeiouAEIOU'].flatMap((v) => [
      [`${v}acute`, `${v}\u0301`], [`${v}grave`, `${v}\u0300`], [`${v}circ`, `${v}\u0302`], [`${v}uml`, `${v}\u0308`],
    ]).map(([k, x]) => [k, x.normalize('NFC')]),
  ),
  ccedil: 'ç', Ccedil: 'Ç', szlig: 'ß', ntilde: 'ñ', oelig: 'œ', aelig: 'æ', yuml: 'ÿ',
}

/** The visible text of a page, without scripts, navigation and footer. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|header|footer|form)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|dd|dt|section|br)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name] ?? m)
    .normalize('NFC')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[\s ]+/g, ' ').replace(/[’']/g, "'").trim()


/** Claude's answer: each yes comes with a quote from the page. */
export interface Raw {
  specialisations: string[]
  free_choice: { value: boolean; quote: string }
  part_time: { value: boolean; quote: string }
  start_autumn: { value: boolean; quote: string }
  start_spring: { value: boolean; quote: string }
  internship: { value: boolean; quote: string }
  degree: string
}

/** Keeps only what the page backs up word for word. */
export function verified(raw: Raw, text: string): OfficialFacts {
  const page = norm(text)
  const on = (s: string) => s.trim().length > 0 && page.includes(norm(s))
  // A quote may end in a slightly different form of the page's last word or two (Berufszielen for Berufsziele);
  // the first words must still match the page word for word.
  const quoted = (q: string) => {
    const words = q.trim().split(/\s+/)
    if (words.length < 3) return false
    if (on(q)) return true
    for (let n = words.length - 1; n >= Math.max(4, words.length - 2); n--) if (on(words.slice(0, n).join(' '))) return true
    return false
  }
  const yes = (c: { value: boolean; quote: string }) => c.value && quoted(c.quote)
  const specialisations = [...new Set(raw.specialisations.map((s) => s.trim()))].filter((s) => s.length > 1 && s.length <= 80 && s.split(/\s+/).length <= 8 && on(s)).slice(0, 15)
  const start: OfficialFacts['start'] = []
  if (yes(raw.start_autumn)) start.push('autumn')
  if (yes(raw.start_spring)) start.push('spring')
  const degree = raw.degree.trim()
  return {
    specialisations,
    // A list of names and «no fixed specialisations» can't both be true.
    freeChoice: !specialisations.length && yes(raw.free_choice),
    partTime: yes(raw.part_time),
    start,
    internship: yes(raw.internship),
    degree: degree && degree.length <= 120 && on(degree) ? degree : undefined,
  }
}

