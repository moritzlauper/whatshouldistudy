import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { CONTENT_MAX, CONTENT_SAMPLE, contentPlan, contentRequest, contentVerdicts, type ContentVerdict } from '../lib/engine/content-analysis.ts'
import { accumulate } from '../lib/engine/accumulate.ts'
import { score } from '../lib/engine/scoring.ts'
import { userTopics, topicWeights } from '../lib/engine/topics.ts'
import { localFit } from '../lib/engine/programme-fit.ts'
import { readTexts } from '../lib/sources/exports.ts'
import { DEFAULT_PREFS, effectiveSummaries } from '../lib/store.ts'
import type { SignalItem } from '../lib/engine/types.ts'

const year = new Date().getFullYear()
const watch = (text: string, channel = 'elliot sang again', month = 0): SignalItem => ({ kind: 'watch', text: `${text}\n${channel}`, label: channel, group: channel, weight: .3, time: Date.UTC(year, month, 1) })
const reason = 'Der Titel kritisiert die Verehrung von Politikern.'

test('semantic subjects reach field ranking, evidence and programme fit without double counting views', () => {
  const items = Array.from({ length: 10 }, (_, i) => watch('Stop stanning politicians.', 'elliot sang again', i % 8))
  const plain = accumulate(items, { source: 'takeout', label: 'Test' })
  assert.equal(plain.fields['political-science'], undefined)
  const plan = contentPlan(items)
  assert.equal(plan.items.length, 1, 'one title is classified once, however often it was watched')
  const interpreted = plan.apply([{ id: '0', fields: { 'political-science': .95 }, reason }])
  const enhanced = accumulate(interpreted, { source: 'takeout', label: 'Test' })
  assert.equal(enhanced.totalWeight, plain.totalWeight)
  assert.equal(enhanced.dataPoints, plain.dataPoints)
  assert.equal(enhanced.fields['political-science'].items, 10)
  assert.equal(enhanced.fields['political-science'].months.length, 8)
  assert.equal(score({ summaries: [enhanced] }).fields[0].id, 'political-science')
  assert.equal(score({ summaries: [enhanced] }).fields[0].evidence[0].interpretation, reason)
  const topics = topicWeights(userTopics([enhanced]))
  assert.ok(topics['political-science'] > 0)
  const fit = localFit({ id: 'politics', enough: true, riasec: [1, 4, 2, 3, 3, 2], subjects: [], topics: ['political-science'], check: '' }, { riasec: [0, 1, 0, 1, 0, 0], enjoy: {}, topics })
  assert.ok(fit.reasons.some((r) => r.kind === 'topics'))
  assert.equal(items[0].meaning, undefined, 'the original remains available')
})

test('the maximum classifies up to 2000 titles; their four-digit ids reach the server, the default stays at 240', () => {
  const items = Array.from({ length: 2100 }, (_, i) => watch(`Titel ${i} über Soziologie`, `Kanal ${i % 120}`, i % 12))
  const plan = contentPlan(items, Date.now(), CONTENT_MAX)
  assert.equal(plan.items.length, CONTENT_MAX)
  assert.equal(plan.items[plan.items.length - 1].id, String(CONTENT_MAX - 1))
  assert.ok(contentRequest(plan.items.slice(CONTENT_MAX - 40)), 'the last batch passes the server check')
  assert.equal(contentRequest([{ id: '12345', kind: 'watch', title: 'Titel', channel: 'Kanal', context: [] }]), null)
  assert.equal(contentPlan(items).items.length, CONTENT_SAMPLE)
})

test('sampling includes subscriptions with channel examples and balances channels, not repeated autoplay', () => {
  const items = [...Array.from({ length: 300 }, (_, i) => watch(`Episode ${i}`, 'Big channel')), watch('Stop stanning politicians.'),
    { kind: 'subscription', text: 'elliot sang again', label: 'elliot sang again', group: 'elliot sang again', weight: 3 },
    { ...watch('An email user@example.com https://example.com'), kind: 'comment' },
    { ...watch('Official music video'), isMusic: true },
  ]
  const plan = contentPlan(items)
  assert.equal(plan.items.length, CONTENT_SAMPLE)
  assert.ok(plan.items.some((x) => x.title === 'Stop stanning politicians.'))
  assert.deepEqual(plan.items.find((x) => x.kind === 'subscription')?.context, ['Stop stanning politicians.'])
  assert.ok(plan.items.every((x) => !('time' in x) && !('group' in x) && !('url' in x)))
  assert.ok(!JSON.stringify(plan.items).includes('Official music'))
  assert.ok(!JSON.stringify(plan.items).includes('user@example.com'))
  const unnamed = contentPlan([watch('First title without channel', ''), watch('Second title without channel', '')])
  assert.ok(unnamed.items.every((x) => x.kind === 'watch'))
  assert.ok(contentRequest(unnamed.items), 'missing channel names must not create an invalid empty context record')
})

test('YouTube API enrichment cannot enter the separate export-only AI sample', async () => {
  const channel = 'UC1234567890123456789012'
  const original = await readTexts([{ name: 'watch-history.json', text: JSON.stringify([{ header: 'YouTube', title: 'Watched Stop stanning politicians.', titleUrl: 'https://www.youtube.com/watch?v=abcdef12345', subtitles: [{ name: 'elliot sang again', url: `https://www.youtube.com/channel/${channel}` }], time: new Date().toISOString() }]) }])
  const enriched = original.rebuild(new Map([[channel, { title: 'private-api-title', text: 'private-api-metadata', topics: ['Politics'] }]]), new Map([['abcdef12345', { id: 'abcdef12345', snippet: { title: 'private-api-video', description: 'private-api-description' } }]]))
  const sample = enriched.contentAnalysis().items
  assert.equal(sample[0].title, 'Stop stanning politicians.')
  assert.ok(!JSON.stringify(sample).includes('private-api'))
  assert.ok(!JSON.stringify(sample).includes(channel))
})

test('a channel sample gives unseen titles weaker context without inventing activity or overriding a reviewed video', () => {
  const items = Array.from({ length: 300 }, (_, i) => watch(`An indirect title ${i}`, 'Example channel'))
  const plan = contentPlan(items)
  const verdicts = plan.items.map((it): ContentVerdict => ({ id: it.id, fields: it.id === '0' ? { physics: .9 } : { 'political-science': .9 }, reason: it.kind === 'channel' ? 'Mehrere Kanalbeispiele behandeln politische Institutionen.' : 'Einordnung des Titels.' }))
  const interpreted = plan.apply(verdicts)
  assert.equal(interpreted.length, items.length)
  assert.ok(interpreted.some((it) => it.contextMeaning && !it.meaning))
  const first = accumulate([interpreted[0]], { source: 'takeout', label: 'Test' })
  assert.ok(first.fields.physics)
  assert.equal(first.fields['political-science'], undefined)
  const unseen = interpreted.find((it) => it.contextMeaning && !it.meaning)!
  const context = accumulate([unseen], { source: 'takeout', label: 'Test' })
  const direct = accumulate([{ ...unseen, contextMeaning: undefined, meaning: unseen.contextMeaning }], { source: 'takeout', label: 'Test' })
  assert.ok(context.fields['political-science'].score < direct.fields['political-science'].score)
  assert.equal(context.fields['political-science'].top[0].interpretationFromChannel, true)
  assert.equal(accumulate(interpreted, { source: 'takeout', label: 'Test' }).totalWeight, accumulate(items, { source: 'takeout', label: 'Test' }).totalWeight)
})

test('unknown or incomplete model classifications are rejected and uncertain subjects stay unassigned', () => {
  const ids = new Set(['0'])
  const raw = { id: '0', reason: 'Unclear title.', fields: [{ id: 'political-science', confidence: .2 }] }
  assert.deepEqual(contentVerdicts([raw], ids)[0].fields, {})
  for (const invalid of [[], [raw, raw], [{ ...raw, id: 'other' }], [{ ...raw, fields: [{ id: 'invented', confidence: 1 }] }], [{ ...raw, fields: [{ id: 'sociology', confidence: 2 }] }]]) assert.throws(() => contentVerdicts(invalid, ids))
  assert.deepEqual(contentRequest([{ id: '0', kind: 'watch', title: 'Stop stanning politicians.', channel: 'channel', context: [], account: 'must-not-leave' }]), [{ id: '0', kind: 'watch', title: 'Stop stanning politicians.', channel: 'channel', context: [] }])
  assert.equal(contentRequest([{ id: '0', kind: 'google', title: 'private search', channel: '', context: [] }]), null)
})

test('content explanations remain complete beyond 300 characters', () => {
  const reason = 'Diese Inhalte behandeln gesellschaftliche Fragen und die Arbeit politischer Institutionen. '.repeat(4)
  assert.equal(contentVerdicts([{ id: '0', reason, fields: [{ id: 'sociology', confidence: .9 }] }], new Set(['0']))[0].reason, reason.trim())
})

test('disabling AI restores the original exactly; stale AI does not affect a newer import', () => {
  const base = accumulate([watch('Stop stanning politicians.')], { source: 'takeout', label: 'Test' })
  const plan = contentPlan([watch('Stop stanning politicians.')])
  const enhanced = accumulate(plan.apply([{ id: '0', fields: { 'political-science': .9 }, reason }]), { source: 'takeout', label: 'Test' })
  const state = { summaries: { takeout: base }, answers: {}, prefs: DEFAULT_PREFS, contentAnalysis: { baseCollectedAt: base.collectedAt, summary: enhanced, enabled: true } }
  assert.equal(effectiveSummaries(state)[0], enhanced)
  assert.equal(effectiveSummaries({ ...state, contentAnalysis: { ...state.contentAnalysis, enabled: false } })[0], base)
  assert.equal(effectiveSummaries({ ...state, contentAnalysis: { ...state.contentAnalysis, baseCollectedAt: 'older-import' } })[0], base)
})

test('content endpoint requires the existing paid unlock before calling an AI provider', () => {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test' }
  delete env.ANTHROPIC_API_KEY
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    import { pathToFileURL } from 'node:url';
    const root = pathToFileURL(process.cwd() + '/');
    registerHooks({ resolve(s, c, next) { return next(s.startsWith('@/') ? new URL(s.slice(2), root).href : s, c); } });
    globalThis.fetch = () => { throw new Error('No network call is allowed'); };
    const { POST } = await import('./app/api/content-analysis/route.ts');
    const response = await POST(new Request('http://localhost/api/content-analysis', { method: 'POST', body: '{}' }));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  `], { cwd: process.cwd(), env, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

test('the content control has no second uploader and does not assume programme consent', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    import { pathToFileURL } from 'node:url';
    import { readFileSync } from 'node:fs';
    import ts from 'typescript';
    const root = pathToFileURL(process.cwd() + '/');
    registerHooks({
      resolve(s, c, next) { return next(s === 'next/link' ? 'next/link.js' : s.startsWith('@/') ? new URL(s.slice(2), root).href : s, c); },
      load(url, c, next) {
        if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
          source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText };
        return next(url, c);
      },
    });
    globalThis.fetch = () => { throw new Error('Rendering must not send data'); };
    const React = (await import('react')).default;
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { SiteProvider } = await import('./app/ui/site-context.tsx');
    const { ContentAnalysisPanel } = await import('./app/ui/content-analysis.tsx');
    const html = renderToStaticMarkup(React.createElement(SiteProvider, { site: 'ch', base: '', locale: 'de-CH' }, React.createElement(ContentAnalysisPanel, { token: null })));
    assert.ok(html.includes('Zum Datenimport'));
    assert.ok(!html.includes('type="file"'));
    assert.ok(!html.includes('Diese Titel an Claude senden'));
  `], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})


test('existing imports are previewed locally, sent only on consent, and stale replies are ignored', () => {
  const result = spawnSync(process.execPath, ['test/helpers/content-analysis.mjs'], { cwd: process.cwd(), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})
