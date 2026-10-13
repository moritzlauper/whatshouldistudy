import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import assert from 'node:assert/strict'

const root = new URL('../../', import.meta.url)
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/link') return { url: 'mock:link', shortCircuit: true }
    if (specifier === '@/lib/store.ts') return { url: 'mock:store', shortCircuit: true }
    if (specifier.endsWith('/ui/site-context.tsx')) return { url: 'mock:site', shortCircuit: true }
    return next(specifier.startsWith('@/') ? new URL(specifier.slice(2), root).href : specifier, context.parentURL?.startsWith('mock:') ? { ...context, parentURL: import.meta.url } : context)
  },
  load(url, context, next) {
    let source
    if (url === 'mock:link') source = `import React from 'react'; export default function Link({children,...props}) { return React.createElement('a',props,children) }`
    if (url === 'mock:store') source = `
      import { RIASEC_ITEMS } from '${new URL('lib/engine/questionnaire.ts', root).href}';
      export function useAppState() { return {answers:{riasec:Object.fromEntries(RIASEC_ITEMS.map(i=>[i.id,i.key==='I'?5:i.key==='C'?4:2])),values:{tech:5}},summaries:{},prefs:{}} }
      export function effectiveSummaries() { return [] }
      export function update() {}
    `
    if (url === 'mock:site') source = `import {kit} from '${new URL('lib/site/kit.ts', root).href}'; export function useSite(){ return kit('ch','/schweiz') }`
    if (source !== undefined) return { source, format: 'module', shortCircuit: true }
    if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('/node_modules/')) {
      const content = readFileSync(fileURLToPath(url), 'utf8')
      return { source: ts.transpileModule(content, { fileName: fileURLToPath(url), compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, format: 'module', shortCircuit: true }
    }
    return next(url, context)
  },
})

const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const { WorkView } = await import('../../app/views/work.tsx')
const html = renderToStaticMarkup(React.createElement(WorkView, { data: { version: 1, generatedAt: '', jobs: [], sources: [] }, unavailable: false }))
assert.match(html, /Tätigkeiten, die dir gefallen:/)
assert.match(html, /Forschend/)
assert.match(html, /Momentan komplett gratis/)
assert.doesNotMatch(html, /\[object Object\]|undefined|NaN/)
assert.match(html, /href="\/schweiz\/resultat"/)
