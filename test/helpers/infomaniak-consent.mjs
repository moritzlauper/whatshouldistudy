import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const root = new URL('../../', import.meta.url)
const effects = []
let state, requests = 0
const profile = { riasec: [0, 1, 0, 1, 0, 0], enjoy: {}, topics: {} }
globalThis.consentTest = {
  state: () => state,
  update: fn => { state = fn(state) },
  effect: fn => effects.push(fn),
  profile,
  programmes: async () => { requests++; return { items: [], total: 0 } },
}
registerHooks({
  resolve(s, c, next) {
    if (s === 'react') return { url: 'mock:react', shortCircuit: true }
    return next(s.startsWith('@/') ? new URL(s.slice(2), root).href : s, c)
  },
  load(url, c, next) {
    const source = url === 'mock:react' ? `export * from '${new URL('node_modules/react/index.js', root)}'; export const useMemo = fn => fn(), useEffect = globalThis.consentTest.effect;`
      : url.endsWith('/lib/store.ts') ? `export const useAppState = globalThis.consentTest.state, update = globalThis.consentTest.update, saveCompareRows = async () => {};`
      : url.endsWith('/app/ui/site-context.tsx') ? `import {kit} from '${new URL('lib/site/kit.ts', root)}'; export const useSite = () => kit('ch', '', 'de-CH');`
      : url.endsWith('/app/ui/readings.tsx') ? `export const useReadings = () => ({ status: 'done', byId: {} }), useFitScores = () => ({ scoreOf: () => 50, hasScores: false });`
      : url.endsWith('/app/ui/programmes.tsx') ? `export const useLocalProfile = () => globalThis.consentTest.profile, useCompareRows = () => null, requestFields = () => [], hasReadings = () => false, limitOf = () => undefined, allProgrammes = globalThis.consentTest.programmes, askPersonal = async () => [];`
      : null
    if (source) return { format: 'module', shortCircuit: true, source }
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText }
    return next(url, c)
  },
})
const { ProgrammeChanges } = await import('../../app/ui/programme-changes.tsx')
const input = { prefs: {}, unlocked: true, before: { results: {}, topics: [] }, after: { results: {}, topics: [] } }
const mount = async () => {
  ProgrammeChanges({ input, token: 'synthetic-unused' })
  for (const effect of effects.splice(0)) effect()
  await new Promise(setImmediate)
}
for (const compare of [{ status: 'pending' }, { status: 'done', at: 'old', key: '{"v":2}' }]) {
  state = { answers: {}, prefs: {}, summaries: {}, contentAnalysis: { enabled: true, compare } }
  await mount()
  assert.equal(requests, 0, 'old Anthropic consent must never trigger new provider requests')
  assert.equal(state.contentAnalysis.compare, compare)
}
state.contentAnalysis = { ...state.contentAnalysis, provider: 'infomaniak', compare: { status: 'pending' } }
await mount()
assert.equal(requests, 2, 'explicit current-provider consent starts both programme lookups')
assert.equal(state.contentAnalysis.compare.status, 'done')
