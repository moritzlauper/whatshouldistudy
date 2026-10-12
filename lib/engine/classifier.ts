import { FIELDS, FIELD_COUNT } from '../taxonomy/fields.ts'
import { ENTERTAINMENT_TERMS, LEARNING_TERMS, LEXICON } from '../taxonomy/lexicon.ts'
import { normalize, parseWeighted, rawTokens, tokens } from './text.ts'

/**
 * Lexicon matcher. Compiles LEXICON once into lookup tables (exact phrases,
 * token prefixes, token suffixes, case-sensitive tokens) and scores a text
 * against every field in one pass over its tokens.
 */

const LEARNING = -1
const ENTERTAINMENT = -2

interface Hit {
  term: number
  field: number
  weight: number
}

interface Affix {
  stem: string
  hits: Hit[]
}

interface Compiled {
  phrases: Map<string, Hit[]>
  /** Every proper prefix of a multi-token phrase, to stop extending n-grams early. */
  partial: Set<string>
  prefixes: Map<string, Affix[]>
  suffixes: Map<string, Affix[]>
  caseSensitive: Map<string, Hit[]>
  terms: string[]
  /** Stable key per term (the lexicon entry), for matching topics across texts. */
  keys: string[]
  keyIndex: Map<string, number>
  /** Fields per term and the strongest weight it has in any of them. */
  termFields: number[][]
  termWeight: number[]
}

let compiled: Compiled | null = null

function compile(): Compiled {
  const c: Compiled = {
    phrases: new Map(),
    partial: new Set(),
    prefixes: new Map(),
    suffixes: new Map(),
    caseSensitive: new Map(),
    terms: [],
    keys: [],
    keyIndex: new Map(),
    termFields: [],
    termWeight: [],
  }
  const termIds = c.keyIndex
  const termId = (key: string, display: string) => {
    let id = termIds.get(key)
    if (id === undefined) {
      id = c.terms.length
      termIds.set(key, id)
      c.terms.push(display)
      c.keys.push(key)
      c.termFields.push([])
      c.termWeight.push(0)
    }
    return id
  }
  const note = (hit: Hit) => {
    if (hit.field < 0) return
    if (!c.termFields[hit.term].includes(hit.field)) c.termFields[hit.term].push(hit.field)
    c.termWeight[hit.term] = Math.max(c.termWeight[hit.term], hit.weight)
  }
  const push = <K>(map: Map<K, Hit[]>, key: K, hit: Hit) => {
    note(hit)
    const list = map.get(key)
    if (list) list.push(hit)
    else map.set(key, [hit])
  }
  const pushAffix = (map: Map<string, Affix[]>, key: string, stem: string, hit: Hit) => {
    note(hit)
    let list = map.get(key)
    if (!list) map.set(key, (list = []))
    let affix = list.find((a) => a.stem === stem)
    if (!affix) list.push((affix = { stem, hits: [] }))
    affix.hits.push(hit)
  }

  const add = (field: number, source: string) => {
    for (const entry of source.split('|')) {
      if (!entry.trim()) continue
      const { term, weight } = parseWeighted(entry)
      if (term.startsWith('=')) {
        const raw = term.slice(1)
        push(c.caseSensitive, raw, { term: termId('=' + raw, raw), field, weight })
        continue
      }
      const isPrefix = term.endsWith('*')
      const isSuffix = term.startsWith('*')
      const core = normalize(term.replace(/^\*|\*$/g, ''))
      if (!core) continue
      if (isPrefix || isSuffix) {
        if (core.includes(' ') || core.length < 3) continue
        const display = isPrefix ? core + '…' : '…' + core
        const hit = { term: termId((isPrefix ? 'p:' : 's:') + core, display), field, weight }
        if (isPrefix) pushAffix(c.prefixes, core.slice(0, 3), core, hit)
        else pushAffix(c.suffixes, core.slice(-3), core, hit)
        continue
      }
      // Show the term as written in the lexicon, umlauts and all.
      push(c.phrases, core, { term: termId(core, term.toLowerCase()), field, weight })
      const parts = core.split(' ')
      for (let i = 1; i < parts.length; i++) c.partial.add(parts.slice(0, i).join(' '))
    }
  }

  FIELDS.forEach((f, i) => {
    const src = LEXICON[f.id]
    if (src) add(i, src)
  })
  add(LEARNING, LEARNING_TERMS)
  add(ENTERTAINMENT, ENTERTAINMENT_TERMS)
  return c
}

function lexicon(): Compiled {
  if (!compiled) compiled = compile()
  return compiled
}

export interface Classification {
  /** Raw weight per field (sum of distinct matched terms). */
  raw: Float32Array
  learning: number
  entertainment: number
  /** Matched (term, field) pairs encoded as term * 256 + field + 2, for evidence. */
  matched: number[]
  /** For stems (soziolog…): the word that actually matched, as written in the text. */
  words?: Map<number, string>
}

const EMPTY: Classification = {
  raw: new Float32Array(FIELD_COUNT),
  learning: 0,
  entertainment: 0,
  matched: [],
}

/**
 * Product names that look like subject words: a «Samsung Galaxy S7» is not
 * astronomy, an «Apple Watch» not botany. Removed before matching.
 */
const BRANDS =
  /\b(samsung\s+galaxy|galaxy\s+(?:s|a|z|m|note|tab|watch|buds|fold|flip)\s*\d*\w*|apple\s+watch|iphone\s*\d*\w*|mercedes[\s-]benz|jaguar\s+land\s+rover|ford\s+mustang|red\s+bull|monster\s+energy|amazon\s+prime|apple\s+music|opera\s+(?:gx|mini|browser)|(?:home|movie)\s+theat(?:er|re)s?|galaxus|python\s+(?:monty|flying circus))\b/gi

/**
 * Words that look like a subject but here name something else: a singer
 * (Frank Ocean), a film or series (Ocean's Eleven, Prison Break, Nocturnal
 * Animals, Predator), or a costume («Pfarrer Kostüm», «nurse outfit»: the
 * word before is what someone dresses up as). Removed before matching.
 */
const FALSE_FRIENDS =
  /\b(frank\s+ocean|ocean'?s\s+(?:eleven|twelve|thirteen|eight|8|11|12|13)|prison\s+break|orange\s+is\s+the\s+new\s+black|nocturnal\s+animals|(?:the\s+)?predator(?:s)?\s+(?:\d+|film|movie|prey|badlands|trailer)|grey'?s\s+anatomy|dr\.?\s+house|breaking\s+bad|criminal\s+minds|save\s+the\s+planet|our\s+planet|unseren?\s+planeten|planet\s+based|planetary\s+health|judge\s+(?:rinder|judy|mathis|jules)|cat\s+tv|katzen[\s-]?tv|(?:rain|thunder|ocean|jungle|forest|desert|nature|white|brown|fire|night|study|sleep)\s+(?:sounds?|noises?|ambien\w*)|ambient\s+(?:music|sounds?)|white\s+noise|[\p{L}-]+\s+(?:outfits?|kost(?:ü|u|ue)m\w*|costumes?|verkleidung\w*|halloween))\b/giu

/** Team names, tuning/coordination and business alliances are not subject interest. */
const SOCIAL_FALSE_FRIENDS =
  /\b(?:m[aā]ori(?=\s+(?:all\s+blacks|rugby)\b)|abstimmung(?:en)?(?=\s+(?:der|von)\s+(?:instrument(?:e|en)?|termin(?:e|en)?|farbe(?:n)?|prozess(?:e|en)?)\b)|koalition(?:en)?(?=\s+(?:von|der|aus)\s+unternehmen\b)|coalitions?(?=\s+of\s+(?:companies|businesses)\b))\b/giu

/**
 * Looking something up on a film or series database is choosing what to
 * watch, not interest in the subject: «best true crime imdb» counts as
 * entertainment only.
 */
const MEDIA_LOOKUP = /\b(imdb|rotten\s+tomatoes|letterboxd|netflix|disney\+|staffel\s+\d+|season\s+\d+|episode\s+\d+|folge\s+\d+|ganze\s+folge|full\s+episode|stream\s+deutsch|serien?stream|bs\.to)\b/i
const MEDIA_STUDY = /\b(tutorial|explain\w*|erklär\w*|erklar\w*|algorithm\w*|machine learning|cinematograph\w*|film editing|schnitttechnik|analyse|analysis|recommendation systems?|empfehlungssystem\w*)\b/i
const MEDIA_ONLY: Classification = { raw: new Float32Array(FIELD_COUNT), learning: 0, entertainment: 2, matched: [] }

const cache = new Map<string, Classification>()
const CACHE_LIMIT = 60_000

export function classify(text: string, opts: { splitCamel?: boolean } = {}): Classification {
  if (!text) return EMPTY
  const key = (opts.splitCamel ? '1' : '0') + text
  const hit = cache.get(key)
  if (hit) return hit

  if (MEDIA_LOOKUP.test(text) && !MEDIA_STUDY.test(text)) return MEDIA_ONLY
  const lx = lexicon()
  const norm = normalize(text.replace(BRANDS, ' ').replace(FALSE_FRIENDS, ' ').replace(SOCIAL_FALSE_FRIENDS, ' '), opts)
  const toks = tokens(norm)
  const seen = new Set<number>()
  const raw = new Float32Array(FIELD_COUNT)
  let learning = 0
  let entertainment = 0

  let words: Map<number, string> | undefined
  const apply = (hits: Hit[], word?: string) => {
    for (const h of hits) {
      if (word && !words?.has(h.term)) (words ??= new Map()).set(h.term, surface(text, word))
      const k = h.term * 256 + (h.field + 2)
      if (seen.has(k)) continue
      seen.add(k)
      if (h.field === LEARNING) learning += h.weight
      else if (h.field === ENTERTAINMENT) entertainment += h.weight
      else raw[h.field] += h.weight
    }
  }

  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i]
    // Exact tokens and phrases starting here.
    let phrase = tok
    for (let j = i; ; ) {
      const hits = lx.phrases.get(phrase)
      if (hits) apply(hits)
      if (!lx.partial.has(phrase) || ++j >= toks.length) break
      phrase += ' ' + toks[j]
    }
    if (tok.length >= 4) {
      const pre = lx.prefixes.get(tok.slice(0, 3))
      if (pre) for (const a of pre) if (tok.length >= a.stem.length && tok.startsWith(a.stem)) apply(a.hits, tok)
      const suf = lx.suffixes.get(tok.slice(-3))
      if (suf) for (const a of suf) if (tok.length > a.stem.length && tok.endsWith(a.stem)) apply(a.hits, tok)
    }
  }
  if (lx.caseSensitive.size) {
    for (const t of rawTokens(text)) {
      const hits = lx.caseSensitive.get(t)
      if (hits) apply(hits)
    }
  }

  const result: Classification = {
    raw,
    learning,
    entertainment,
    matched: [...seen],
    words,
  }
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, result)
  return result
}

/** The word in the original text whose normalised form is `tok`, lowercased. */
function surface(text: string, tok: string): string {
  for (const w of text.split(/[^\p{L}\p{N}]+/u)) if (w && normalize(w) === tok) return w.toLowerCase()
  return tok
}

/** Maps raw weights to 0..1 per field: one strong term ≈ 0.7, two ≈ 0.9. */
export function saturate(raw: number): number {
  return raw <= 0 ? 0 : 1 - Math.exp(-raw / 2.5)
}

export function fieldVector(c: Classification): Float32Array {
  const v = new Float32Array(FIELD_COUNT)
  for (let i = 0; i < FIELD_COUNT; i++) v[i] = saturate(c.raw[i])
  return v
}

/** The display strings of matched terms that count towards a given field. */
export function termsForField(c: Classification, field: number): string[] {
  const lx = lexicon()
  const out: string[] = []
  for (const k of c.matched) {
    if ((k % 256) - 2 !== field) continue
    const term = Math.floor(k / 256)
    out.push(c.words?.get(term) ?? lx.terms[term])
  }
  return [...new Set(out)]
}

/**
 * Topics: the lexicon terms a text matched, by stable key, with the word as
 * written. Only terms that say something on their own (weight ≥ 1 in some
 * field), so «media» or «food» don't make two things look alike.
 */
export function topics(c: Classification): Array<{ key: string; word: string }> {
  const lx = lexicon()
  // One topic per word: «Psychologie» matches both «psychologie» and the stem
  // «psycholog…»; the stem wins, so «psychologisch» elsewhere meets it too.
  const byWord = new Map<string, { key: string; word: string; stem: boolean }>()
  for (const k of c.matched) {
    const field = (k % 256) - 2
    if (field < 0) continue
    const term = Math.floor(k / 256)
    if (lx.termWeight[term] < 1) continue
    const key = lx.keys[term]
    const word = c.words?.get(term) ?? lx.terms[term].replace(/…/g, '')
    const stem = /^[ps]:/.test(key)
    const id = normalize(word)
    const prev = byWord.get(id)
    if (!prev || (stem && (!prev.stem || key.length < prev.key.length))) byWord.set(id, { key, word, stem })
  }
  const out = new Map<string, string>()
  for (const t of byWord.values()) if (!out.has(t.key)) out.set(t.key, t.word)
  return [...out].map(([key, word]) => ({ key, word }))
}

/** Topic keys of a text, e.g. a programme's name and description. */
export function textTopics(text: string): string[] {
  return topics(classify(text)).map((t) => t.key)
}

/** The fields a topic counts towards. */
export function topicFields(key: string): string[] {
  const lx = lexicon()
  const i = lx.keyIndex.get(key) ?? -1
  return i < 0 ? [] : lx.termFields[i].map((f) => FIELDS[f].id)
}

/** How a topic reads when there is no example word for it. */
export function topicLabel(key: string): string {
  const lx = lexicon()
  const i = lx.keyIndex.get(key) ?? -1
  return i < 0 ? key.replace(/^[ps=]:?/, '') : lx.terms[i].replace(/…/g, '')
}

/** Top fields of a single text, for quick checks and the scrapers. */
export function topFields(text: string, n = 3, opts: { splitCamel?: boolean } = {}): Array<{ id: string; score: number }> {
  const c = classify(text, opts)
  return [...c.raw]
    .map((score, i) => ({ id: FIELDS[i].id, score }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}

export function learningScore(c: Classification, prior = 0.3): number {
  const l = 1 - Math.exp(-c.learning / 2)
  const e = 1 - Math.exp(-c.entertainment / 2)
  return Math.min(1, Math.max(0, prior * 0.6 + l * 0.6 - e * 0.4))
}
