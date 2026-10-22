import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withoutRedirects } from '../scrapers/ch-hochschulen.ts'
import type { Listed } from '../scrapers/ch-hochschulen.ts'

const base = 'https://www.epfl.ch/education/master/programs/'
const listed: Listed[] = [
  { name: 'Master Applied Physics', level: 'master', url: `${base}applied-physic/` },
  { name: 'Master Applied Physics', level: 'master', url: `${base}applied-physics/` },
  { name: 'Master Physics', level: 'master', url: `${base}physics/` },
]

test('a listed link that redirects to another listed programme counts once', () => {
  const kept = withoutRedirects(listed, new Map([[`${base}applied-physic/`, `${base}applied-physics/`], [`${base}applied-physics/`, `${base}applied-physics/`]]))
  assert.deepEqual(kept.map((x) => x.url), [`${base}applied-physics/`, `${base}physics/`])
})

test('links that end on a page that is not listed, or on a programme of another level, all stay', () => {
  const general = withoutRedirects(listed, new Map([[`${base}applied-physic/`, `${base}overview/`], [`${base}physics/`, `${base}overview/`]]))
  assert.equal(general.length, 3)
  const bachelor: Listed = { name: 'Bachelor Physics', level: 'bachelor', url: 'https://www.epfl.ch/education/bachelor/programs/physics/' }
  const otherLevel = withoutRedirects([...listed, bachelor], new Map([[bachelor.url, `${base}physics/`]]))
  assert.equal(otherLevel.length, 4)
})
