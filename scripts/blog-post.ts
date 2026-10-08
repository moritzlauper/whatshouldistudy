import Anthropic from '@anthropic-ai/sdk'
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkPost } from '../lib/blog-check.ts'
import type { Post } from '../lib/blog-check.ts'
import { FIELDS } from '../lib/taxonomy/fields.ts'

/**
 * Researches and writes the week's blog post (GitHub Action «whatshouldistudy
 * blog»). Two steps: Claude picks a topic that isn't on the blog yet and
 * researches it with web search and web fetch, then writes an English and a
 * Swiss German article from that brief as JSON. checkPost() and a check that
 * every source was actually opened decide whether it is published; otherwise
 * Claude gets the problems back, up to three times.
 *
 *   ANTHROPIC_API_KEY=… node scripts/blog-post.ts
 *
 * BLOG_TOPIC sets the topic instead of letting Claude choose, BLOG_DATE the
 * publication date (default today, UTC). Writes content/blog/<date>-<slug>.json
 * and content/blog/index.ts. With --index it only rewrites the index, e.g.
 * after deleting a post.
 */

const MODEL = 'claude-opus-5-5'
const DIR = join(import.meta.dirname, '..', 'content', 'blog')
const DATE = process.env.BLOG_DATE || new Date().toISOString().slice(0, 10)
const TOPIC = process.env.BLOG_TOPIC?.trim()
const FIELD_IDS = new Set(FIELDS.map((f) => f.id))

const postFiles = () => readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()

/** content/blog/index.ts imports every post, so the site needs no file system at runtime. */
function writeIndex() {
  const files = postFiles()
  const lines = [
    '// Written by scripts/blog-post.ts: every post in this folder, oldest first.',
    "import type { Post } from '../../lib/blog-check.ts'",
    ...files.map((f, i) => `import p${i} from './${f}' with { type: 'json' }`),
    '',
    `export const POSTS: Post[] = [${files.map((_, i) => `p${i}`).join(', ')}]`,
    '',
  ]
  writeFileSync(join(DIR, 'index.ts'), lines.join('\n'))
}

if (process.argv.includes('--index')) {
  writeIndex()
  process.exit(0)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY.')
  process.exit(1)
}
const client = new Anthropic()
// From the files, not the index: it may still list a post that was just deleted.
const existing: Post[] = postFiles().map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Post).sort((a, b) => b.date.localeCompare(a.date))

const SITE = `whatshouldistudy is a free tool that helps school leavers (about 16 to 20 years old) decide what to study. It compares their interests (questionnaire, optionally their YouTube, Spotify, Reddit or GitHub history, analysed in the browser) with 80 fields of study and lists matching degree programmes. There is a global English site and German-language sites for Switzerland, Germany and Austria. The blog publishes one article a week for these readers and their parents and teachers.`

const CATEGORIES = [
  'a field of study up close: what you actually do in it, who it suits, where it leads',
  'choosing between fields or programmes, and how to decide well',
  'admission and application: deadlines, requirements, numerus clausus, aptitude tests',
  'costs and financing: tuition, living costs, grants, scholarships, student loans',
  'labour market and salaries after graduation',
  'studying abroad or in another country of the German-speaking region',
  'types of higher education: university, university of applied sciences, teacher education, dual study',
  'gap years, changing programmes, dropping out and starting again',
  'what research says about study choice, satisfaction and success',
]

const fieldList = FIELDS.map((f) => `${f.id}: ${f.name}`).join('\n')
const postList = existing.length ? existing.map((p) => `- ${p.date}: ${p.en.title}`).join('\n') : '(none yet)'

/** The URLs Claude opened or found, so a post cites nothing it never saw. */
function seenUrls(content: Anthropic.Beta.BetaContentBlock[]): string[] {
  const out: string[] = []
  for (const b of content) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) out.push(...b.content.map((r) => r.url))
    if (b.type === 'web_fetch_tool_result' && b.content.type === 'web_fetch_result') out.push(b.content.url)
  }
  return out
}
const norm = (u: string) => u.replace(/#.*$/, '').replace(/\/$/, '').toLowerCase()

function text(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content.filter((b) => b.type === 'text').map((b) => b.text).join('')
}

let spent = { input: 0, output: 0 }
function count(m: Anthropic.Beta.BetaMessage) {
  spent = { input: spent.input + m.usage.input_tokens + (m.usage.cache_read_input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0), output: spent.output + m.usage.output_tokens }
}

/** One turn, streamed (long research turns), with Anthropic's server-side fallback on a refusal. */
async function turn(params: Omit<Anthropic.Beta.MessageCreateParamsStreaming, 'model' | 'stream' | 'betas' | 'fallbacks'>) {
  const m = await client.beta.messages.stream({ model: MODEL, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', ...params }).finalMessage()
  count(m)
  if (m.stop_reason === 'refusal') throw new Error(`Refused: ${m.stop_details?.explanation ?? 'no explanation'}`)
  if (m.stop_reason === 'max_tokens') throw new Error('Ran out of output tokens.')
  return m
}

async function research(): Promise<{ brief: string; urls: string[] }> {
  const recent = existing.slice(0, 6).map((p) => p.en.title).join('; ') || 'none'
  const task = TOPIC
    ? `The topic is set: ${TOPIC}`
    : `Choose the topic yourself. It must not repeat or closely overlap an existing post. Pick a category that the last posts (${recent}) did not cover, from these:\n${CATEGORIES.map((c) => `- ${c}`).join('\n')}\nPrefer an angle that is current in ${DATE.slice(0, 7)}: an upcoming application deadline, newly published statistics, a policy or fee change, the start of the academic year.`
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `${SITE}

Today is ${DATE}. Research next week's blog post.

${task}

Existing posts:
${postList}

Research with web search and open the pages you rely on with web fetch. Use primary sources wherever they exist: statistics offices (BFS, Destatis, Statistik Austria, OECD, Eurostat), ministries, swissuniversities, Hochschulrektorenkonferenz, the universities themselves, peer-reviewed studies. Use figures from the last three years and note the year each figure refers to. A fact you could not confirm in a page you saw stays out. The German article will be read in Switzerland, Germany and Austria, so where facts differ by country, research all three; the English article is for an international audience.

Finish with a brief for the writer, in English:
1. Topic, angle and working title.
2. The facts, one per line, each with its figure, the year it refers to and the URL it comes from.
3. What differs between Switzerland, Germany and Austria, and what applies internationally.
4. Up to four related fields of study, by id from this list:
${fieldList}
5. Every source used: title and URL.`,
    },
  ]
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 20 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 15 },
  ]
  const urls: string[] = []
  for (let i = 0; i < 8; i++) {
    const m = await turn({ max_tokens: 64000, thinking: { type: 'adaptive' }, output_config: { effort: 'high' }, tools, messages })
    urls.push(...seenUrls(m.content))
    if (m.stop_reason !== 'pause_turn') return { brief: text(m.content), urls }
    // The server paused its tool loop; sending the turn back resumes it.
    messages.push({ role: 'assistant', content: m.content })
  }
  throw new Error('Research did not finish.')
}

const STYLE = `Both articles:
- 900 to 1400 words of body. Readers are 16 to 20; write for them directly ("you", German "du") without talking down. Parents and teachers read along.
- Concrete beats general: names, figures with their year, programmes, deadlines, institutions. No claim that is not in the brief.
- Plain declarative sentences of varying length. No rhetorical hooks, no stacked short sentences or fragments for effect, no "not X, but Y", no groups of three adjectives, no summary at the end; the last paragraph says something new or stops.
- No dashes as sentence connectors or for asides: no em dash (—), no en dash (–) except in number ranges such as 2024–2026, no spaced hyphen. Use a full stop, comma or colon.
- Avoid filler and these words: delve, intricate, tapestry, pivotal, underscore, landscape, foster, testament, enhance, crucial, seamless, robust, leverage, "it is important to note", "in today's world", "in conclusion". German: essenziell, vielfältig, nahtlos, massgeschneidert, ganzheitlich, wegweisend, robust, facettenreich, Mehrwert, Synergie, revolutionär, transformativ, innovativ, entscheidend, zentral (for important), "spielt eine Rolle", "Es ist wichtig zu beachten", "Zusammenfassend", "Darüber hinaus", "In der heutigen Zeit".
- Markdown subset only: paragraphs, "## " and "### " headings (3 to 6 "## " sections), "- " or "1. " lists where items really are parallel, **bold** sparingly. No title heading, no italics, no tables, no images, no emojis.
- Links: [text](field:<id>) links a field page, [text](start) the free questionnaire (link it once, where it helps the reader), [text](https://…) a source from the brief. Two to five links in total, no bare URLs.
- title at most 90 characters, no clickbait. description 80 to 170 characters: what the reader learns. slug: lower-case ascii words joined by hyphens, at most 60 characters, in the article's language (German: ä → ae, ö → oe, ü → ue).
- sources: every source the article relies on, 3 or more, title and URL exactly as in the brief.
- fields: 1 to 4 field ids the article is about.

English article (en): international audience, plain international English. Where the brief has country facts, use those of several countries.

German article (de): written in its own right, not translated, for readers in Switzerland, Germany and Austria; where things differ, say how in each country (e.g. Matura in Switzerland and Austria, Abitur in Germany; CHF and EUR). Swiss Standard German spelling, which the site converts for Germany and Austria:
- No ß, always ss (gross, heisst, Strasse, dass).
- Quotation marks «…».
- Thousands with an apostrophe: 1’250, 8’419’550. Decimal point, never a comma: 14.7, CHF 1’250.50. Percent without a space: 83%.
- After a colon always continue with a capital letter, even after a fragment.
- Swiss words where they are neutral: Lohn rather than Gehalt, innert, Resultat; but no dialect.`

const textSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['slug', 'title', 'description', 'body'],
  properties: { slug: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, body: { type: 'string' } },
}
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['fields', 'sources', 'en', 'de'],
  properties: {
    fields: { type: 'array', items: { type: 'string', enum: [...FIELD_IDS] } },
    sources: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'url'], properties: { title: { type: 'string' }, url: { type: 'string' } } } },
    en: textSchema,
    de: textSchema,
  },
}

/** Mechanical fixes the model gets wrong now and then and that need no judgement. */
function tidy(post: Post): Post {
  const de = (s: string) => s.replace(/ß/g, 'ss').replace(/(\d) %/g, '$1%')
  return { ...post, de: { ...post.de, title: de(post.de.title), description: de(post.de.description), body: de(post.de.body) } }
}

async function write(brief: string, urls: string[]): Promise<Post> {
  const seen = new Set(urls.map(norm))
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `${SITE}\n\nWrite the blog post of ${DATE} from this research brief.\n\n<brief>\n${brief}\n</brief>\n\nExisting posts (do not reuse their slugs):\n${existing.map((p) => `- ${p.en.slug} / ${p.de.slug}`).join('\n') || '(none)'}\n\n${STYLE}`,
    },
  ]
  for (let attempt = 1; attempt <= 3; attempt++) {
    const m = await turn({ max_tokens: 32000, thinking: { type: 'adaptive' }, output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } }, messages })
    const post = tidy({ date: DATE, ...(JSON.parse(text(m.content)) as Omit<Post, 'date'>) })
    const errors = checkPost(post, existing, FIELD_IDS)
    if (seen.size) {
      const cited = [...post.sources.map((s) => s.url), ...[post.en.body, post.de.body].flatMap((b) => [...b.matchAll(/\]\((https:[^)]+)\)/g)].map((x) => x[1]))]
      for (const u of cited) if (!seen.has(norm(u))) errors.push(`${u} was not opened or found during research; cite only sources from the brief`)
    } else console.warn('No URLs recorded from the research tools, skipping the source check.')
    if (!errors.length) return post
    console.warn(`Attempt ${attempt}:\n- ${errors.join('\n- ')}`)
    messages.push({ role: 'assistant', content: m.content }, { role: 'user', content: `Fix these problems and return the whole post again:\n- ${errors.join('\n- ')}` })
  }
  throw new Error('No publishable post after three attempts.')
}

if (existing.some((p) => p.date === DATE)) {
  console.log(`There already is a post of ${DATE}.`)
  process.exit(0)
}
const { brief, urls } = await research()
console.log(`Research done, ${new Set(urls).size} pages seen.\n\n${brief}\n`)
const post = await write(brief, urls)
const file = `${DATE}-${post.en.slug}.json`
writeFileSync(join(DIR, file), `${JSON.stringify(post, null, 2)}\n`)
writeIndex()
console.log(`Wrote content/blog/${file}: ${post.en.title} / ${post.de.title}`)
console.log(`Tokens: ${spent.input.toLocaleString('en')} in, ${spent.output.toLocaleString('en')} out`)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `title=${post.de.title.replace(/\n/g, ' ')}\nfile=content/blog/${file}\n`)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${post.en.title}\n\n${post.de.title}\n\n${post.sources.map((s) => `- [${s.title}](${s.url})`).join('\n')}\n\nTokens: ${spent.input} in, ${spent.output} out\n`)
