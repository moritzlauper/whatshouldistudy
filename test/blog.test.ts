import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allPosts, blogLang } from '../lib/blog.ts'
import { checkPost, linkTarget } from '../lib/blog-check.ts'
import type { Post } from '../lib/blog-check.ts'
import { FIELDS } from '../lib/taxonomy/fields.ts'

const IDS = new Set(FIELDS.map((f) => f.id))
const field = FIELDS[0].id
const words = (sentence: string, n: number) => Array.from({ length: n }, () => sentence).join(' ')

function post(over: Partial<{ en: Partial<Post['en']>; de: Partial<Post['de']> }> = {}): Post {
  return {
    date: '2026-10-12',
    fields: [field],
    sources: [1, 2, 3].map((i) => ({ title: `Source ${i}`, url: `https://example.org/${i}` })),
    en: { slug: 'how-to-choose', title: 'How to choose a degree', description: 'What the numbers say about choosing a degree, and how to use them for your own decision this autumn.', body: `## Start\n\n${words('Most students choose their degree in the last year of school.', 80)} [Try it](start).`, ...over.en },
    de: { slug: 'studienwahl-so-gehts', title: 'So findest du dein Studium', description: 'Was die Zahlen über die Studienwahl sagen und wie du sie für deine eigene Entscheidung in diesem Herbst nutzt.', body: `## Anfang\n\n${words('Die meisten wählen ihr Studium im letzten Schuljahr, 83% davon im Herbst.', 70)} [Mehr](field:${field}).`, ...over.de },
  }
}

test('a clean post passes', () => {
  assert.deepEqual(checkPost(post(), [], IDS), [])
})

test('taken slugs, unknown fields and few sources are caught', () => {
  const p = { ...post(), fields: ['no-such-field'], sources: [] }
  const errors = checkPost(p, [post()], IDS)
  assert.ok(errors.some((e) => e.includes('en: slug how-to-choose is taken')))
  assert.ok(errors.some((e) => e.includes('unknown field id')))
  assert.ok(errors.some((e) => e.includes('at least 3 sources')))
})

test('dashes as connectors are caught, ranges are fine', () => {
  const body = (s: string) => `${post().en.body} ${s}`
  assert.deepEqual(checkPost(post({ en: { body: body('Between 2024–2026 it grew.') } }), [], IDS), [])
  assert.ok(checkPost(post({ en: { body: body('It grew — a lot.') } }), [], IDS).some((e) => e.includes('em dash')))
  assert.ok(checkPost(post({ en: { body: body('It grew – a lot.') } }), [], IDS).some((e) => e.includes('en dash')))
  assert.ok(checkPost(post({ en: { body: body('It grew - a lot.') } }), [], IDS).some((e) => e.includes('spaced hyphen')))
})

test('the German text follows Swiss spelling', () => {
  const body = (s: string) => `${post().de.body} ${s}`
  const problems = (s: string) => checkPost(post({ de: { body: body(s) } }), [], IDS)
  assert.ok(problems('Das ist groß.').some((e) => e.includes('ß')))
  assert.ok(problems('Sie sagt „ja“.').some((e) => e.includes('quotes')))
  assert.ok(problems('Es sind 83 % aller.').some((e) => e.includes('%')))
  assert.ok(problems('Im Schnitt 14,7 Wochen.').some((e) => e.includes('decimal comma')))
  assert.ok(problems('Rund 1.250 Franken.').some((e) => e.includes('thousands')))
  assert.ok(problems('Der Plan: erst die Daten.').some((e) => e.includes('colon')))
  assert.deepEqual(problems('Rund 1’250 Franken, im Schnitt 14.7 Wochen. Sie sagt «ja». Der Plan: Erst die Daten.'), [])
})

test('links go to fields, the questionnaire or https only', () => {
  assert.deepEqual(linkTarget(`field:${field}`, IDS), { kind: 'field', id: field })
  assert.deepEqual(linkTarget('start', IDS), { kind: 'start' })
  assert.deepEqual(linkTarget('https://www.bfs.admin.ch/', IDS), { kind: 'url' })
  assert.equal(linkTarget('field:nope', IDS), null)
  assert.equal(linkTarget('http://example.org', IDS), null)
  assert.equal(linkTarget('javascript:alert(1)', IDS), null)
})

test('French and Italian have no blog', () => {
  assert.equal(blogLang('en'), 'en')
  assert.equal(blogLang('de-AT'), 'de')
  assert.equal(blogLang('fr-CH'), null)
})

test('every published post passes the checks against the others', () => {
  const posts = allPosts()
  for (const p of posts) assert.deepEqual(checkPost(p, posts.filter((o) => o !== p), IDS), [], `${p.date} ${p.en.slug}`)
})
