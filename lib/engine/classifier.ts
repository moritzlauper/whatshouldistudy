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
  }
  const termIds = new Map<string, number>()
  const termId = (key: string, display: string) => {
    let id = termIds.get(key)
    if (id === undefined) {
      id = c.terms.length
      termIds.set(key, id)
      c.terms.push(display)
    }
    return id
  }
  const push = <K>(map: Map<K, Hit[]>, key: K, hit: Hit) => {
    const list = map.get(key)
    if (list) list.push(hit)
    else map.set(key, [hit])
  }
  const pushAffix = (map: Map<string, Affix[]>, key: string, stem: string, hit: Hit) => {
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
  /\b(samsung\s+galaxy|galaxy\s+(?:s|a|z|m|note|tab|watch|buds|fold|flip)\s*\d*\w*|apple\s+watch|iphone\s*\d*\w*|mercedes[\s-]benz|jaguar\s+land\s+rover|ford\s+mustang|red\s+bull|monster\s+energy|amazon\s+prime|apple\s+music|galaxus|python\s+(?:monty|flying circus))\b/gi

const cache = new Map<string, Classification>()
const CACHE_LIMIT = 60_000

export function classify(text: string, opts: { splitCamel?: boolean } = {}): Classification {
  if (!text) return EMPTY
  const key = (opts.splitCamel ? '1' : '0') + text
  const hit = cache.get(key)
  if (hit) return hit

  const lx = lexicon()
  const norm = normalize(text.replace(BRANDS, ' '), opts)
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
