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
  useMemo(fn, deps) {
    const i = host.cursor++
    if (!same(host.slots[i]?.deps, deps)) host.slots[i] = { deps, value: fn() }
    return host.slots[i].value
  },
  useCallback(fn, deps) { return globalThis.hookHost.useMemo(() => fn, deps) },
  useSyncExternalStore(_subscribe, get) { return get() },
  useContext(ctx) { return ctx._currentValue === null ? globalThis.testResults : ctx._currentValue instanceof Map ? ctx._currentValue : globalThis.testSite },
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
      export const { useState, useEffect, useRef, useMemo, useCallback, useSyncExternalStore, useContext } = globalThis.hookHost;
    ` }
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8') + (url.endsWith('/app/ui/programmes.tsx') ? '\nexport { Explorer, ProgrammeRow }' : ''), {
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
assert.equal(calls[0].body.consent, true)
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


// Exercise the actual search and top-list candidate selection with twelve matches,
// including thin readings and a completely unavailable facts store.
const { kit } = await import('../../lib/site/kit.ts')
const { DEFAULT_PREFS } = await import('../../lib/store.ts')
const { Explorer, TopProgrammes, ProgrammeRow } = await import('../../app/ui/programmes.tsx')
const { OwnDataPanel, AiBlock } = await import('../../app/ui/readings.tsx')
globalThis.testSite = kit('ch', '', 'de-CH')
globalThis.testResults = { fields: [{ id: 'sociology', score: 88 }], riasec: { profile: [0, 1, 0, 1, 0, 0] } }
const matches = Array.from({ length: 12 }, (_, i) => ({ id: `basel-${i}`, fields: ['sociology'], matchedField: 'sociology', match: 88 - i, country: 'CH', name: `Synthetic programme ${i}`, institution: 'Test University', level: 'master' }))
const nodes = n => !n || typeof n !== 'object' ? [] : Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)]
const tick = () => new Promise(setImmediate)
for (const mode of ['thin', 'unavailable']) {
  const sent = []
  globalThis.fetch = async (url, init) => {
    if (url.startsWith('/api/facts?')) return mode === 'unavailable' ? new Response('', { status: 503 }) : Response.json({ items: matches.map(p => ({ id: p.id, enough: false, riasec: [0, 0, 0, 0, 0, 0], subjects: [], check: '' })), updated: '' })
    if (url === '/api/programmes') return Response.json({ items: matches, total: matches.length, facets: { countries: {}, levels: {} }, updated: '' })
    assert.equal(url, '/api/personal-fit')
    const data = JSON.parse(init.body); sent.push(data)
    return Response.json({ fits: data.programmes.map(p => ({ id: p.id, score: 50, fit: 3, thin: true, reasons: ['Catalogue explanation.'] })) })
  }
  const props = { token: `synthetic-${mode}`, fields: globalThis.testResults.fields, prefs: { ...DEFAULT_PREFS, countries: ['CH'] }, onInvalid() { throw new Error('Unexpected auth failure') } }
  const searchView = runner(() => Explorer(props))
  searchView()
  await new Promise(resolve => setTimeout(resolve, 220))
  let tree = searchView()
  const baselineRow = nodes(tree).find(n => n.type === ProgrammeRow)
  const panel = nodes(tree).find(n => n.type === OwnDataPanel)
  assert.ok(panel, mode)
  assert.equal(panel.props.disabled, false)
  assert.equal(panel.props.count, 12)
  assert.equal(sent.length, 0)
  const buttonView = runner(() => OwnDataPanel(panel.props))
  const ask = nodes(buttonView()).find(n => n.type === 'button')
  assert.equal(ask.props.disabled, false)
  ask.props.onClick() // Open the consent first.
  assert.equal(sent.length, 0)
  const consent = nodes(buttonView()).find(n => n.type === 'button' && n.props.children === globalThis.testSite.t.programmes.ai.own.agree)
  assert.ok(consent)
  consent.props.onClick()
  assert.equal(sent.length, 1)
  assert.equal(sent[0].programmes.length, 12)
  await tick()
  tree = searchView()
  const row = nodes(tree).find(n => n.type === ProgrammeRow)
  assert.equal(row.props.personalStatus, 'rated')
  assert.deepEqual(row.props.personal.reasons, ['Catalogue explanation.'])
  assert.equal(row.props.p.id, baselineRow.props.p.id)
  assert.equal(row.props.score, baselineRow.props.score, 'catalogue explanations must preserve the displayed score')
  const rowView = runner(() => ProgrammeRow(row.props))
  nodes(rowView()).find(n => n.type === 'button').props.onClick()
  const details = nodes(rowView()).find(n => n.props.aiBlock)
  assert.equal(details.props.aiBlock.type, AiBlock)
  assert.equal(details.props.aiBlock.props.personal.thin, true)
  // New filters invalidate the old explanations without sending another request.
  nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: 'new search' } })
  assert.equal(nodes(searchView()).find(n => n.type === OwnDataPanel).props.on, false)
  assert.equal(sent.length, 1)
  const topView = runner(() => TopProgrammes({ ...props, results: globalThis.testResults, unlocked: true }))
  topView(); await tick(); topView(); await tick()
  assert.equal(nodes(topView()).find(n => n.type === OwnDataPanel).props.count, 12)
}
