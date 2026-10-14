import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Exercise the real import, store and component with synthetic data and deferred HTTP.
let host
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
globalThis.hookHost = {
  useState(initial) {
    const h = host, i = h.cursor++
    if (!(i in h.slots)) h.slots[i] = typeof initial === 'function' ? initial() : initial
    return [h.slots[i], value => { h.slots[i] = typeof value === 'function' ? value(h.slots[i]) : value; h.dirty = true }]
  },
  useRef(initial) { const i = host.cursor++; return host.slots[i] ??= { current: initial } },
  useEffect(effect, deps) {
    const h = host, i = h.cursor++
    if (!same(h.slots[i]?.deps, deps)) h.pending.push(() => { h.slots[i]?.cleanup?.(); h.slots[i] = { deps, cleanup: effect() } })
  },
  useSyncExternalStore(_subscribe, get) { return get() },
  useContext() { return globalThis.testSite },
}
const root = pathToFileURL(process.cwd() + '/')
registerHooks({
  resolve(s, c, next) {
    if (s === 'react') return { url: 'test:react', shortCircuit: true }
    if (s === 'next/link') return next('next/link.js', c)
    if (s.endsWith('/site-context.tsx')) return { url: 'test:site', shortCircuit: true }
    if (s.endsWith('/store.ts')) throw new Error('Session imported the persistent store')
    return next(s.startsWith('@/') ? new URL(s.slice(2), root).href : s, c)
  },
  load(url, c, next) {
    if (url === 'test:site') return {format: 'module', shortCircuit: true, source: 'export function useSite() { return globalThis.testSite }'}
    if (url === 'test:react') return { format: 'module', shortCircuit: true, source: `
      export * from ${JSON.stringify(new URL('node_modules/react/index.js', root).href)};
      export { default } from ${JSON.stringify(new URL('node_modules/react/index.js', root).href)};
      export const { useState, useEffect, useRef, useSyncExternalStore, useContext } = globalThis.hookHost;
    ` }
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText }
    return next(url, c)
  },
})
function runner(render) {
  const h = { cursor: 0, slots: [], pending: [], dirty: false }
  const run = () => {
    let value
    do { h.dirty = false; h.cursor = 0; host = h; value = render(); for (const effect of h.pending.splice(0)) effect() } while (h.dirty)
    return value
  }
  run.unmount = () => h.slots.forEach(s => s?.cleanup?.())
  return run
}

function elements(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(elements)
  return [node, ...elements(node.props?.children)]
}
const events = new Map()
const forbidden = () => { throw new Error('Session accessed storage or network') }
globalThis.window = { localStorage: {getItem: forbidden, setItem: forbidden}, sessionStorage: {getItem: forbidden, setItem: forbidden}, addEventListener: (k, v) => events.set(k,v), removeEventListener: k => events.delete(k), scrollTo() {} }
globalThis.fetch = forbidden
const { kit } = await import('../../lib/site/kit.ts')
const { RIASEC_ITEMS } = await import('../../lib/engine/questionnaire.ts')
const { CounsellingView } = await import('../../app/views/counselling.tsx')
const { QuestionnaireForm } = await import('../../app/ui/questionnaire-form.tsx')
globalThis.testSite = kit('ch', '/schweiz', 'de-CH')
const { instrumentText } = await import('../../lib/site/assessment-text.ts')
const text = instrumentText('de-CH')
const render = runner(() => CounsellingView())
const button = (tree, label) => elements(tree).find(e => e.type === 'button' && e.props.children === label)
let tree = render()
assert.ok(button(tree, text.start))
assert.ok(!elements(tree).some(e => e.type === QuestionnaireForm))
button(tree, text.start).props.onClick()
tree = render()
let form = elements(tree).find(e => e.type === QuestionnaireForm)
assert.deepEqual(form.props.answers, {})
assert.equal(button(tree, text.result).props.disabled, true)
const synthetic = { riasec: Object.fromEntries(RIASEC_ITEMS.map((i,n) => [i.id,n%5+1])), big5: Object.fromEntries(Array.from({length:20},(_,i)=>['b'+(i+1),3])) }
form.props.onChange(synthetic)
tree = render()
assert.equal(button(tree, text.result).props.disabled, false)
button(tree, text.result).props.onClick()
tree = render()
assert.ok(elements(tree).some(e => e.type === 'dd'))
let download
URL.createObjectURL = blob => { download = blob; return 'blob:synthetic' }
URL.revokeObjectURL = () => {}
globalThis.document = { createElement: () => ({ click() {} }) }
button(tree, text.save).props.onClick()
assert.deepEqual(JSON.parse(await download.text()).answers.riasec, synthetic.riasec)
button(tree, text.end).props.onClick()
tree = render()
assert.ok(!elements(tree).some(e => e.type === 'dd'))
button(tree, text.start).props.onClick()
tree = render()
form = elements(tree).find(e => e.type === QuestionnaireForm)
assert.deepEqual(form.props.answers, {})
form.props.onChange(synthetic)
render()
events.get('pageshow')({persisted:true})
tree=render()
assert.ok(button(tree,text.start))
render.unmount()
assert.equal(events.size,0)
