import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// A small hook host: execute state, refs and effect cleanup for the real hook
// without a DOM or provider calls. All HTTP responses below are synthetic.
let host
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
globalThis.hookHost = {
  useState(initial) {
    const h = host, i = h.cursor++
    if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial
    return [h.slots[i], (value) => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; h.dirty = true }]
  },
  useRef(initial) {
    const i = host.cursor++
    return host.slots[i] ??= { current: initial }
  },
  useEffect(effect, deps) {
    const h = host, i = h.cursor++
    if (!same(h.slots[i]?.deps, deps)) h.pending.push(() => {
      h.slots[i]?.cleanup?.()
      h.slots[i] = { deps, cleanup: effect() }
    })
  },
}
const root = pathToFileURL(process.cwd() + '/')
registerHooks({
  resolve(s, c, next) {
    if (s === 'react') return { url: 'test:react', shortCircuit: true }
    if (s === 'next/link') return next('next/link.js', c)
    return next(s.startsWith('@/') ? new URL(s.slice(2), root).href : s, c)
  },
  load(url, c, next) {
    if (url === 'test:react') return { format: 'module', shortCircuit: true, source: `
      export * from ${JSON.stringify(new URL('node_modules/react/index.js', root).href)};
      export { default } from ${JSON.stringify(new URL('node_modules/react/index.js', root).href)};
      export const { useState, useEffect, useRef } = globalThis.hookHost;
    ` }
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText }
    return next(url, c)
  },
})
const { usePersonalComparison } = await import('../../app/ui/programmes.tsx')
function runner(render) {
  const h = { cursor: 0, slots: [], pending: [], dirty: false }
  return () => {
    let value
    do {
      h.dirty = false; h.cursor = 0; host = h
      value = render()
      for (const effect of h.pending.splice(0)) effect()
    } while (h.dirty)
    return value
  }
}
const calls = []
globalThis.fetch = (url, init) => new Promise((resolve) => calls.push({ url, body: JSON.parse(init.body), resolve }))
const programmes = [{ id: 'a', matchedField: 'sociology', country: 'CH' }]
let profile = { riasec: [0, 1, 0, 1, 0, 0], enjoy: { hist: 5 }, topics: { sociology: .8 } }
let context = 'Zurich/master'
let locale = 'de-CH', token = null
const search = runner(() => usePersonalComparison(programmes, profile, locale, token, context))
const top = runner(() => usePersonalComparison(programmes, profile, locale, token, 'top'))
assert.equal(search().on, false)
assert.equal(top().on, false)
assert.equal(calls.length, 0)
search().onChange(true)
assert.equal(calls.length, 1)
assert.equal(search().status, 'loading')
assert.equal(top().on, false)
assert.equal(calls[0].url, '/api/personal-fit')
assert.deepEqual(calls[0].body.profile.subjects, ['hist'])

// Even with identical programme IDs, changing a filter requires another click.
context = 'Bern/master'
assert.equal(search().on, false)
assert.equal(calls.length, 1)
context = 'Zurich/master'
assert.equal(search().on, false)
search().onChange(true) // The identical pending request is shared, not repeated.
assert.equal(calls.length, 1)
search().onChange(false)
calls[0].resolve(Response.json({ fits: [{ id: 'a', score: 80, reasons: ['Complete.'], fit: 5, thin: false }] }))
await new Promise(setImmediate)
assert.equal(search().map, null)
assert.equal(search().on, false)

// A late old reply cannot replace the result of a new search.
context = 'Lausanne/master'; programmes[0] = { ...programmes[0], id: 'b' }; search(); search().onChange(true)
context = 'Geneva/master'; programmes[0] = { ...programmes[0], id: 'c' }; search(); search().onChange(true)
assert.equal(calls.length, 3)
calls[2].resolve(Response.json({ fits: [{ id: 'c', score: 65, reasons: ['New.'], fit: 4, thin: false }] }))
await new Promise(setImmediate)
assert.equal(search().map.get('c').score, 65)
calls[1].resolve(Response.json({ fits: [{ id: 'b', score: 90, reasons: ['Old.'], fit: 5, thin: false }] }))
await new Promise(setImmediate)
assert.equal(search().map.get('c').score, 65)
assert.equal(top().on, false)

profile = { ...profile, topics: { politics: .9 } }
assert.equal(search().on, false)
assert.equal(calls.length, 3)
locale = 'en'; search(); token = 'synthetic-test-token'; search()
assert.equal(calls.length, 3)
context = 'Empty'; programmes.length = 0
search().onChange(true)
assert.equal(calls.length, 3)
