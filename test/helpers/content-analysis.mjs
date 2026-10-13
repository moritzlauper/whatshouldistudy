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
    return next(s.startsWith('@/') ? new URL(s.slice(2), root).href : s, c)
  },
  load(url, c, next) {
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
const storage = new Map()
globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, sessionStorage: {} }
const { kit } = await import('../../lib/site/kit.ts')
globalThis.testSite = kit('ch', '', 'de-CH')
const { readTexts } = await import('../../lib/sources/exports.ts')
const { setSummary, getState, update, removeSummary, clearAll, loadContentInput, configureStore, DEFAULT_PREFS } = await import('../../lib/store.ts')
const { ContentAnalysisPanel, ContentAnalysisChanges } = await import('../../app/ui/content-analysis.tsx')
const { score } = await import('../../lib/engine/scoring.ts')
const { effectiveSummaries } = await import('../../lib/store.ts')
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
function text(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node !== 'object') return String(node)
  return Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children)
}
const a = globalThis.testSite.t.contentAi
const click = (tree, label) => {
  const button = elements(tree).find(n => n.type === 'button' && text(n) === label)
  assert.ok(button, `Missing button: ${label}`)
  button.props.onClick()
}
const tick = () => new Promise(setImmediate)
const calls = []
globalThis.fetch = (url, init) => new Promise(resolve => calls.push({ url, body: JSON.parse(init.body), signal: init.signal, resolve }))
async function imported(title = 'An indirect invented title') {
  return readTexts([{ name: 'watch-history.json', text: JSON.stringify(Array.from({ length: 6 }, (_, i) => ({
    header: 'YouTube', title: `Watched ${title}`, titleUrl: 'https://www.youtube.com/watch?v=synthetic123', subtitles: [{ name: 'Invented channel' }], time: new Date(Date.UTC(new Date().getFullYear(), i, 1)).toISOString(),
  }))) }])
}
const result = await imported()
const base = result.summaries[0]
await setSummary(base, result.contentInput)
const saved = getState()
assert.ok(saved.contentImportId)
assert.ok(!JSON.stringify([...storage.values()]).includes('An indirect invented title'), 'raw titles never go into localStorage')
assert.ok(await loadContentInput(saved), 'memory fallback works without IndexedDB')
configureStore('test-other-site', DEFAULT_PREFS)
assert.equal(await loadContentInput(getState()), null)
configureStore('wsis:v1', DEFAULT_PREFS)
assert.ok(await loadContentInput(getState()))
const panel = runner(() => ContentAnalysisPanel({ token: 'test-only-not-an-unlock' }))
panel(); await tick()
let tree = panel()
assert.ok(text(tree).includes(a.ready))
assert.ok(!elements(tree).some(n => n.type === 'input'))
assert.equal(calls.length, 0)
click(tree, a.cancel)
assert.equal(calls.length, 0)
click(panel(), a.ask)
tree = panel()
click(tree, a.agree)
click(tree, a.agree) // A stale click handler cannot duplicate the request.
assert.equal(calls.length, 1)
assert.equal(calls[0].body.consent, true)
assert.equal(calls[0].body.items[0].title, 'An indirect invented title')
assert.ok(calls[0].body.items.every(item => !('time' in item) && !('url' in item)))
calls[0].resolve(Response.json({ items: calls[0].body.items.map(it => ({ id: it.id, fields: { physics: .95 }, reason: 'Synthetic physics explanation.' })) }))
await tick(); tree = panel()
assert.ok(getState().contentAnalysis?.enabled)
assert.deepEqual(getState().summaries.takeout, JSON.parse(JSON.stringify(base)), 'the existing original summary is preserved')
assert.equal(score({ summaries: effectiveSummaries(getState()) }).fields[0].id, 'physics')
assert.ok(text(tree).includes(a.active))
assert.ok(!text(tree).includes(a.unavailable))
const enhanced = getState().contentAnalysis.summary
click(tree, a.disable)
assert.deepEqual(effectiveSummaries(getState()), [getState().summaries.takeout])
click(panel(), a.enable)
assert.equal(effectiveSummaries(getState())[0], enhanced)
click(panel(), a.remove)
panel(); await tick()
click(panel(), a.agree)
assert.equal(calls.length, 2)
removeSummary('takeout'); panel()
assert.equal(calls[1].signal.aborted, true)
calls[1].resolve(Response.json({ items: calls[1].body.items.map(it => ({ id: it.id, fields: { physics: .95 }, reason: 'Late.' })) }))
await tick(); panel()
assert.equal(getState().contentAnalysis, undefined)
assert.equal(getState().summaries.takeout, undefined)
assert.equal(await loadContentInput(saved), null)

await setSummary(base, result.contentInput)
panel(); await tick(); click(panel(), a.agree)
const replacement = await imported('Replacement title')
await setSummary(replacement.summaries[0], replacement.contentInput)
panel(); await tick()
assert.ok(text(panel()).includes('Replacement title'))
assert.equal(calls[2].signal.aborted, true)
calls[2].resolve(Response.json({ items: calls[2].body.items.map(it => ({ id: it.id, fields: { physics: .95 }, reason: 'Stale.' })) }))
await tick(); panel()
assert.equal(getState().contentAnalysis, undefined)
click(panel(), a.agree)
calls[3].resolve(new Response('', { status: 429 }))
await tick()
assert.ok(text(panel()).includes(a.limit))
assert.equal(getState().contentAnalysis, undefined)
click(panel(), a.agree)
click(panel(), a.cancel)
assert.equal(calls[4].signal.aborted, true)
calls[4].resolve(Response.json({ items: calls[4].body.items.map(it => ({ id: it.id, fields: { physics: .95 }, reason: 'Cancelled.' })) }))
await tick(); panel()
assert.equal(getState().contentAnalysis, undefined)
const beforeClear = getState()
clearAll(); panel()
assert.equal(await loadContentInput(beforeClear), null)
panel.unmount()

// Existing AI summaries need no recovered raw input or extra upload.
await setSummary(base)
update(s => ({ ...s, contentAnalysis: { baseCollectedAt: base.collectedAt, summary: enhanced, enabled: true } }))
const legacy = runner(() => ContentAnalysisPanel({ token: null }))
assert.ok(text(legacy()).includes(a.active))
assert.ok(!text(legacy()).includes(a.unavailable))
legacy.unmount()

// The visible comparison distinguishes identical ranks from identical points.
const fields = score({ summaries: [enhanced] }).fields
const changes = runner(() => ContentAnalysisChanges({ comparison: { before: fields.map(f => ({ ...f, score: f.score - 5 })), after: fields } }))
const comparison = changes()
assert.ok(text(comparison).includes(a.unchanged))
assert.ok(text(comparison).includes(a.changes))
assert.equal(elements(comparison).filter(n => n.type === 'tr').length, 11)
assert.ok(text(comparison).includes(String(fields[0].score - 5)))
const changed = runner(() => ContentAnalysisChanges({ comparison: { before: [...fields].reverse(), after: fields } }))
assert.ok(text(changed()).includes(a.changed))

// A separately uploaded News file stays local in the first run and needs maximum-run consent.
clearAll()
await setSummary(base, result.contentInput)
const newsImport = await readTexts([{ name: 'My Activity.json', text: JSON.stringify([
  { header: 'Google News', title: 'Read Invented news headline', titleUrl: 'https://example.org/news', time: new Date().toISOString() },
]) }])
await setSummary(newsImport.summaries[0], newsImport.contentInput)
assert.ok((await loadContentInput(getState())).google)
const newsPanel = runner(() => ContentAnalysisPanel({ token: 'test-only-not-an-unlock' }))
newsPanel(); await tick()
const firstCall = calls.length
click(newsPanel(), a.agree)
assert.ok(calls[firstCall].body.items.every(it => it.kind !== 'read'))
calls[firstCall].resolve(Response.json({ items: calls[firstCall].body.items.map(it => ({ id: it.id, fields: { physics: .9 }, reason: 'Test' })) }))
await tick(); newsPanel(); await tick()
const maximumCount = Number(getState().contentAnalysis.summary.stats.aiExpandable)
click(newsPanel(), a.more(maximumCount))
await tick()
const expandedTree = newsPanel()
assert.ok(text(expandedTree).includes(a.newsMaximum))
assert.ok(text(expandedTree).includes('Invented news headline'))
assert.equal(calls.length, firstCall + 1, 'choosing maximum only previews; it does not send News')
click(expandedTree, a.agree)
assert.ok(calls[firstCall + 1].body.items.some(it => it.kind === 'read'))
calls[firstCall + 1].resolve(Response.json({ items: calls[firstCall + 1].body.items.map(it => ({ id: it.id, fields: it.kind === 'read' ? { sociology: .9 } : { physics: .9 }, reason: 'Test' })) }))
await tick(); newsPanel()
assert.ok(getState().contentAnalysis.google.summary.fields.sociology)
removeSummary('google-search'); newsPanel(); await tick()
assert.equal((await loadContentInput(getState())).google, undefined, 'removing News also removes its raw local AI input')
assert.equal(effectiveSummaries(getState()).length, 1)
newsPanel.unmount()
clearAll()
