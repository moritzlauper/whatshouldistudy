/**
 * Offline fixtures + the exact current production prompts/schemas.
 * Dry run: node scripts/ai-comparison.mjs
 * Live: node --env-file=.env.local scripts/ai-comparison.mjs --run
 * Optional: --case content-1-de-CH --repeats 1 --out scrapers/out/ai-smoke
 * Additional model: --run --with-gemma --resume (reuses completed requests)
 * Re-evaluate saved replies without API calls: --with-gemma --resume
 * Diagnostic only: --run --provider haiku --task personal --personal-max-tokens 4000 --out scrapers/out/ai-haiku-4000
 * No application routes, user exports, database access or unlock tokens.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import Anthropic from '@anthropic-ai/sdk'
import { complete, AI_MODEL } from '../lib/infomaniak.ts'
import { FIELDS } from '../lib/taxonomy/fields.ts'
import { contentRequest, contentVerdicts } from '../lib/engine/content-analysis.ts'
import { aiPersonalFit, fitBand, localFit } from '../lib/engine/programme-fit.ts'
import { fitReasonText } from '../lib/engine/fit-reason.ts'
import { topicFields, topicLabel } from '../lib/engine/classifier.ts'
import { fieldName } from '../lib/site/labels.ts'
import { dict } from '../lib/site/dict.ts'
import { exactBatch } from '../lib/ai-batch.ts'
import { FACTS_SYSTEM, FACTS_SCHEMA, hashText, normaliseFact } from '../scrapers/lib/facts.ts'
import { storedFactProblem } from '../lib/facts-store.ts'
import { contentGroups, profiles, personalProgrammes, pages } from './fixtures/ai-comparison.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const arg = (key, fallback) => process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback
const repeats = Number(arg('--repeats', '2'))
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3) throw new Error('repeats must be 1..3')
const personalMaxTokens = Number(arg('--personal-max-tokens', '4000'))
if (!Number.isInteger(personalMaxTokens) || personalMaxTokens < 2500 || personalMaxTokens > 8000) throw new Error('personal-max-tokens must be 2500..8000')
const sourceHashes = {}
function constants(file, names, context = {}) {
  const source = readFileSync(join(root, file), 'utf8')
  sourceHashes[file] = hashText(source)
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const result = {}
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      const name = declaration.name.getText(ast)
      if (names.includes(name) && declaration.initializer) {
        result[name] = runInNewContext(`(${declaration.initializer.getText(ast)})`, context)
      }
    }
  }
  if (names.some(name => !(name in result))) throw new Error(`Missing production constant in ${file}`)
  return result
}
const content = constants('lib/server/content-analysis.ts', ['CONTENT_SYSTEM', 'SCHEMA'], { FIELDS })
const personal = constants('lib/server/personal-fit.ts', ['PERSONAL_SYSTEM', 'PERSONAL_SCHEMA'])
sourceHashes['scrapers/lib/facts.ts'] = hashText(readFileSync(join(root, 'scrapers/lib/facts.ts'), 'utf8'))

const cases = []
function contentCase(group, locale, label) {
  const items = group.map(x => x.input)
  if (!contentRequest(items)) throw new Error(`Invalid fixture ${label}`)
  cases.push({ id: `content-${label}-${locale}`, task: 'content', locale, system: content.CONTENT_SYSTEM, schema: content.SCHEMA,
    input: JSON.stringify({ locale, fields: FIELDS.map(f => ({ id: f.id, name: f.name })), items }),
    expected: group, maxTokens: 7000, productionTimeoutMs: 45000 })
}
contentGroups.forEach((group, index) => contentCase(group, 'de-CH', index + 1))
for (const locale of ['en', 'fr-CH', 'it-CH']) contentCase(contentGroups[1], locale, 2)
for (const [profileName, locale] of [['social', 'de-CH'], ['technical', 'de-CH'], ['social', 'en'], ['social', 'fr-CH'], ['social', 'it-CH']]) {
  const profile = profiles[profileName]
  const programmes = structuredClone(personalProgrammes).map(p => {
    if (profileName === 'technical' && p.reading) p.computedScore = { social: 30, cs: 85, psych: 45 }[p.id]
    p.catalogue.fields = p.catalogue.fields.map(f => ({ id: f.id, name: fieldName(f.id, locale) }))
    p.fieldConnections = Object.entries(profile.topics).filter(([, w]) => w > 0).flatMap(([key]) => {
      const fields = p.catalogue.fields.map(f => f.id).filter(id => id === key || topicFields(key).includes(id))
      return fields.length ? [{ topic: topicLabel(key), fields }] : []
    })
    const fit = p.reading ? localFit({ ...p.reading, id: p.id, enough: true, check: '' }, { riasec: profile.riasec, topics: profile.topics, enjoy: Object.fromEntries(profile.subjects.map(s => [s, 5])) }) : null
    p.reasons = (fit?.reasons ?? []).map((r, id) => ({ id, text: fitReasonText(r, locale, dict(locale).programmes.ai) }))
    return p
  })
  cases.push({ id: `personal-${profileName}-${locale}`, task: 'personal', locale,
    system: personal.PERSONAL_SYSTEM, schema: personal.PERSONAL_SCHEMA, input: JSON.stringify({ locale, profile, programmes }),
    expected: programmes, strongest: profileName === 'social' ? 'social' : 'cs', maxTokens: personalMaxTokens, productionTimeoutMs: 40000 })
}
for (let i = 0; i < pages.length; i += 3) {
  const group = pages.slice(i, i + 3)
  cases.push({ id: `readings-multilingual-${i / 3 + 1}`, task: 'readings', locale: 'de/fr/it/en', system: FACTS_SYSTEM, schema: FACTS_SCHEMA,
    input: 'Programmes:\n' + group.map(p => `<programme id="${p.id}">\nName: ${p.name}\nInstitution: Invented Test University\nLevel: ${p.level}\nOfficial page text:\n${p.text}\n</programme>`).join('\n\n'),
    expected: group, maxTokens: 16000, productionTimeoutMs: 120000 })
}

const selected = cases.filter(c => (!arg('--case', '') || c.id === arg('--case', '')) && (!arg('--task', '') || c.task === arg('--task', '')))
if (!selected.length) throw new Error('Unknown case')
let providers = [
  { id: 'haiku', model: 'claude-haiku-5-5', currency: 'USD', inputRate: .10, outputRate: .50, cacheReadRate: .01 },
  { id: 'infomaniak', model: 'mistralai/Mistral-Small-4-119B-2603', currency: 'CHF', inputRate: .20, outputRate: .75 },
]
if (process.argv.includes('--with-gemma')) providers.push({ id: 'infomaniak-gemma', model: 'google/gemma-4-31B-it', currency: 'CHF', inputRate: .20, outputRate: .40 })
if (arg('--provider', '')) providers = providers.filter(p => p.id === arg('--provider', ''))
if (!providers.length) throw new Error('Unknown provider')


// All constructs used by the production schemas; no implicit coercion or repair.
function schemaErrors(value, schema, path = '$') {
  const errors = []
  const type = schema.type
  const valid = type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : type === 'array' ? Array.isArray(value) : type === 'integer' ? Number.isInteger(value)
    : type === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === type
  if (!valid) return [`${path}: expected ${type}`]
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: enum`)
  if (typeof value === 'string' && schema.minLength && value.length < schema.minLength) errors.push(`${path}: too short`)
  if (type === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key}: missing`)
    for (const [key, v] of Object.entries(value)) {
      if (schema.properties[key]) errors.push(...schemaErrors(v, schema.properties[key], `${path}.${key}`))
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: extra`)
    }
  }
  if (type === 'array') value.forEach((v, i) => errors.push(...schemaErrors(v, schema.items, `${path}[${i}]`)))
  return errors
}
function evaluate(c, raw) {
  const checks = []
  const check = (id, pass, detail = '') => checks.push({ id, pass: Boolean(pass), detail,
    heuristic: id.startsWith('context:') || id.startsWith('limited-evidence:') })
  const errors = schemaErrors(raw, c.schema)
  check('schema', !errors.length, errors.join('; '))
  let rows = raw[c.task === 'content' ? 'items' : 'programmes']
  try {
    rows = exactBatch(raw[c.task === 'content' ? 'items' : 'programmes'], new Set(c.expected.map(x => c.task === 'content' ? x.input.id : x.id)))
    check('all-ids-once', true)
  } catch {
    check('all-ids-once', false)
    // Content analysis accepts partial batches in production; personal/readings do not.
    if (c.task !== 'content') return { checks, normalized: [] }
  }
  if (errors.length) return { checks, normalized: [] }
  let normalized = []
  if (c.task === 'content') {
    normalized = contentVerdicts(rows, new Set(c.expected.map(x => x.input.id)))
    for (const expected of c.expected) {
      const r = rows.find(x => x.id === expected.input.id)
      if (!r) {
        check(`valid:${expected.input.id}`, false, 'Missing item')
        check(`subject:${expected.input.id}`, false, 'Missing item')
        continue
      }
      const n = normalized.find(x => x.id === r.id)
      const fields = Object.keys(n?.fields ?? {})
      check(`valid:${r.id}`, n && r.fields.length <= 3 && r.fields.every(f => f.confidence >= 0 && f.confidence <= 1))
      check(`subject:${r.id}`, n && (expected.expected.length ? expected.expected.some(f => fields.includes(f)) : fields.length === 0), fields.join(', '))
      if (expected.input.kind !== 'watch' && fields.length) check(`context:${r.id}`, /beispiel|titel|exampl|exempl|titles|vidéo|video|esemp|contenut|kontext|context|contesto/i.test(r.reason), r.reason)
      if (c.locale === 'de-CH') check(`swiss-spelling:${r.id}`, !r.reason.includes('ß'))
    }
  } else if (c.task === 'personal') {
    for (const p of c.expected) {
      const r = rows.find(x => x.id === p.id)
      const thin = p.basis === 'catalogue'
      check(`score:${p.id}`, thin ? r.score === 50 : r.score >= Math.max(0, p.computedScore - 30) && r.score <= Math.min(100, p.computedScore + 30), String(r.score))
      check(`reasons:${p.id}`, r.reasons.length >= 2 && r.reasons.length <= 3 && r.reasons.every(s => s.trim() && /[.!?][»”"']?$/.test(s.trim())))
      check(`no-numeric-weights:${p.id}`, !/\b0[.,]\d+\b/.test(r.reasons.join(' ')))
      if (c.locale === 'de-CH') check(`swiss-spelling:${p.id}`, !r.reasons.join(' ').includes('ß'))
      if (thin) check(`limited-evidence:${p.id}`, /katalog|catalog|limit|fehl|keine|ohne|nicht genügend|insuff|manqu|manc|aucun|sans domaine|ne dispose pas|only the name|only a starting|not enough|no detailed|no sufficient|lack|unavailable/i.test(r.reasons.join(' ')), r.reasons.join(' '))
      normalized.push(aiPersonalFit(r, { id: p.id, score: p.computedScore, fit: fitBand(p.computedScore), reasons: [], thin }))
    }
    const read = normalized.filter(x => !x.thin).sort((a, b) => b.score - a.score)
    check('clear-match-ranks-first', read[0].id === c.strongest, read.map(x => `${x.id}:${x.score}`).join(', '))
  } else {
    const sent = new Map(c.expected.map(p => [p.id, { text: p.text, url: `https://example.org/${p.id}`, hash: hashText(p.text) }]))
    normalized = rows.map(r => normaliseFact(r, sent, '2026-10-13'))
    for (const p of c.expected) {
      const r = rows.find(x => x.id === p.id)
      const n = normalized.find(x => x?.id === p.id)
      check(`stored:${p.id}`, n && !storedFactProblem(n))
      check(`enough:${p.id}`, n?.enough === p.expected.enough)
      check(`tracks:${p.id}`, n && [...n.specialisations.map(s => s.name)].sort().join('|') === [...p.expected.tracks].sort().join('|'), JSON.stringify(n?.specialisations))
      check(`raw-tracks:${p.id}`, r.specialisations.map(s => s.name).sort().join('|') === [...p.expected.tracks].sort().join('|'), JSON.stringify(r.specialisations))
      if (p.expected.enough) {
        check(`topic:${p.id}`, p.expected.topics.some(t => n?.topics.includes(t)), n?.topics.join(', '))
        check(`checks:${p.id}`, n && ['de', 'fr', 'it', 'en'].every(l => n.checks[l].length > 0))
      } else check(`abstain:${p.id}`, !r.enough_info && r.subjects.length === 0 && r.topics.length === 0 && Object.values(r.riasec).every(x => x === 0) && Object.values(r.checks).every(x => x === ''))
    }
  }
  return { checks, normalized }
}

const report = { createdAt: new Date().toISOString(), syntheticOnly: true, sourceHashes, providers, repeats,
  evaluatorHash: hashText(readFileSync(fileURLToPath(import.meta.url), 'utf8')),
  method: { samePromptsAndSchemas: true, temperature: 'provider default (matches current app)',
    personalMaxTokens, productionPersonalMaxTokens: 4000,
    reasoning: 'Haiku low; Infomaniak models none (latency/cost-oriented deployment settings)', retries: 0,
    observedTimeoutMs: 90000, productionTimeoutsRecordedSeparately: true, concurrency: 'one request per model; requests for the same case run concurrently; added models run after the baseline',
    limits: 'Small synthetic sample, not real-user accuracy or a load test. Content checks accept any expected subject, not all plausible subjects. Language and factual fidelity require manual review. Offline readings are not generated on a results-page visit. Translation belongs to programme detail pages and is excluded.',
    pricesAsOf: '2026-10-13', prices: ['https://www.anthropic.com/claude-haiku-5-5', 'https://www.infomaniak.com/de/hosting/ai-services/tarife'],
  }, cases: selected, results: [] }
const output = resolve(root, arg('--out', 'scrapers/out/ai-comparison'))
if (process.argv.includes('--resume')) {
  const previous = JSON.parse(readFileSync(join(output, 'results.json'), 'utf8'))
  if (JSON.stringify(previous.sourceHashes) !== JSON.stringify(sourceHashes)) throw new Error('Production source changed; use a new output directory')
  report.createdAt = previous.createdAt
  report.results = previous.results
  for (const r of report.results) {
    const c = selected.find(c => c.id === r.case)
    if (!c || !providers.some(p => p.id === r.provider && p.model === r.model) || r.repeat > repeats) throw new Error('Saved run configuration differs')
    if (previous.cases.find(x => x.id === r.case)?.maxTokens !== c.maxTokens) throw new Error('Saved token limit differs')
    const hash = createHash('sha256').update(c.system + c.input + JSON.stringify(c.schema)).digest('hex')
    if (hash !== r.inputHash) throw new Error('Saved input differs')
    if (r.raw && !r.error) {
      r.evaluation = evaluate(c, r.raw)
      r.evaluation.checks.unshift({ id: 'complete', pass: ['end_turn', 'stop'].includes(r.stop), detail: r.stop })
    }
  }
}
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
function save() {
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  const summary = providers.flatMap(p => ['content', 'personal', 'readings'].map(task => {
    const rows = report.results.filter(r => r.provider === p.id && r.task === task)
    const successes = rows.filter(r => !r.error)
    return { provider: p.id, model: p.model, task, calls: rows.length, successes: successes.length,
      withinProductionTimeout: successes.filter(r => r.ms <= r.productionTimeoutMs).length,
      completeWithinProductionTimeout: successes.filter(r => r.ms <= r.productionTimeoutMs && ['end_turn', 'stop'].includes(r.stop) && r.evaluation.checks.some(c => c.id === 'all-ids-once' && c.pass)).length,
      averageSeconds: successes.length ? successes.reduce((s, r) => s + r.ms, 0) / successes.length / 1000 : null,
      averageSecondsAllCalls: rows.length ? rows.reduce((s, r) => s + r.ms, 0) / rows.length / 1000 : null,
      inputTokens: rows.reduce((s, r) => s + (r.usage?.input ?? 0), 0), outputTokens: rows.reduce((s, r) => s + (r.usage?.output ?? 0), 0),
      cost: rows.reduce((s, r) => s + (r.cost ?? 0), 0), currency: p.currency,
      unknownCostCalls: rows.filter(r => r.cost === undefined).length,
      expectedRows: rows.reduce((sum, r) => sum + selected.find(c => c.id === r.case).expected.length, 0),
      usableRows: successes.reduce((sum, r) => sum + r.evaluation.normalized.filter(Boolean).length, 0),
      completeBatches: successes.filter(r => r.evaluation.checks.some(c => c.id === 'all-ids-once' && c.pass)).length,
      subjectHits: successes.flatMap(r => r.evaluation.checks).filter(c => c.id.startsWith('subject:') && c.pass).length,
      passed: successes.flatMap(r => r.evaluation.checks).filter(c => !c.heuristic && c.pass).length,
      checks: successes.flatMap(r => r.evaluation.checks).filter(c => !c.heuristic).length,
      heuristicFlags: successes.flatMap(r => r.evaluation.checks).filter(c => c.heuristic && !c.pass).length,
      failures: rows.flatMap(r => r.error ? [{ case: r.case, repeat: r.repeat, error: r.error }] : r.evaluation.checks.filter(c => !c.pass).map(c => ({ case: r.case, repeat: r.repeat, ...c }))),
    }
  }))
  writeFileSync(join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
  const rows = summary.map(s => `<tr><td>${escape(s.provider)}</td><td>${escape(s.task)}</td><td>${s.successes}/${s.calls}</td><td>${s.usableRows}/${s.expectedRows}</td><td>${s.withinProductionTimeout}/${s.calls}</td><td>${s.averageSeconds?.toFixed(2) ?? '–'}</td><td>${s.passed}/${s.checks}</td><td>${s.cost.toFixed(5)} ${s.currency}</td></tr>`).join('')
  const details = selected.map(c => `<section><h2>${escape(c.id)}</h2><details><summary>Identische Eingabe und vorab festgelegte Erwartungen</summary><pre>${escape(c.input)}</pre><pre>${escape(JSON.stringify(c.expected, null, 2))}</pre></details>${Array.from({ length: repeats }, (_, i) => `<h3>Lauf ${i + 1}</h3><div class="pair">${providers.map(p => {
    const r = report.results.find(r => r.case === c.id && r.repeat === i + 1 && r.provider === p.id)
    if (!r) return `<article>${escape(p.model)}: ausstehend</article>`
    return `<article><h4>${escape(p.model)}</h4><p>${(r.ms / 1000).toFixed(2)} s · ${r.cost?.toFixed(5) ?? '–'} ${p.currency}</p><pre>${escape(r.error ? JSON.stringify({ error: r.error, stop: r.stop, text: r.text }, null, 2) : JSON.stringify(r.raw, null, 2))}</pre><details><summary>Prüfungen und normalisiertes Ergebnis</summary><pre>${escape(JSON.stringify(r.evaluation, null, 2))}</pre></details></article>`
  }).join('')}</div>`).join('')}</section>`).join('')
  const review = existsSync(join(output, 'review.json')) ? JSON.parse(readFileSync(join(output, 'review.json'), 'utf8')) : null
  const reviewHtml = review ? `<section><h2>Einordnung der Ergebnisse</h2><p>${escape(review.conclusion)}</p>${review.findings.map(f => `<p><strong>${escape(f.label)}:</strong> ${escape(f.text)}</p>`).join('')}<p><small>${escape(review.limits)}</small></p></section>` : ''
  writeFileSync(join(output, 'report.html'), `<!doctype html><html lang="de"><meta charset="utf-8"><title>Haiku / Infomaniak – Resultatseite</title><style>body{font:16px/1.5 system-ui;margin:32px;max-width:1800px;color:#182331}table{border-collapse:collapse}td,th{padding:8px 16px;border:1px solid #ccd5df;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 ui-monospace}section{margin-top:40px;border-top:2px solid #ddd}.pair{display:grid;grid-template-columns:repeat(${providers.length},1fr);gap:24px}article{background:#f3f6f9;padding:16px;min-width:0}summary{cursor:pointer}h4{margin:0}small{color:#596579}</style><h1>Haiku 5.5 / Infomaniak</h1><p>Identische Produktionsprompts und Schemas; ausschliesslich erfundene Testdaten. Zwei direkte KI-Aufgaben der Resultatseite sowie die vorgelagerten Studiengang-Lesungen.</p><p>Die Prüfquote ist keine allgemeine Genauigkeit. Sprache, erfundene Aussagen und Qualität der Begründungen zusätzlich anhand der vollständigen Antworten beurteilen. Kein Lasttest und kein produktiver Anbieterwechsel. Preise in unterschiedlichen Währungen, ohne Umrechnung. Kosten enthalten auch abgebrochene Antworten, soweit Tokenzahlen vorliegen; Wiederholungen nach Ausfällen sind nicht automatisch enthalten.</p><small>${escape(report.createdAt)}</small><table><thead><tr><th>Anbieter</th><th>Aufgabe</th><th>JSON-Antworten</th><th>Verwertbare Zeilen</th><th>Im App-Zeitlimit</th><th>Ø Sekunden (JSON)</th><th>Prüfungen</th><th>Kosten</th></tr></thead><tbody>${rows}</tbody></table>${details}</html>`)
  if (review) {
    const path = join(output, 'report.html')
    writeFileSync(path, readFileSync(path, 'utf8').replace('</tbody></table>', `</tbody></table>${reviewHtml}`))
  }
  return summary
}

if (!process.argv.includes('--run') && process.argv.includes('--resume')) {
  console.log(JSON.stringify({ output, summary: save().map(({ failures, ...s }) => s) }, null, 2))
} else if (!process.argv.includes('--run')) {
  // Validate fixtures and schema checker locally without credentials or network.
  if (schemaErrors({ items: [] }, content.SCHEMA).length || !schemaErrors({ items: [{ id: 1 }] }, content.SCHEMA).length) throw new Error('Schema checker self-check failed')
  console.log(JSON.stringify({ mode: 'dry-run', cases: selected.map(c => ({ id: c.id, rows: c.expected.length, maxTokens: c.maxTokens })), requests: selected.length * repeats * providers.length, sourceHashes }, null, 2))
} else {
  for (const key of ['ANTHROPIC_API_KEY', 'INFOMANIAK_API_TOKEN', 'INFOMANIAK_PRODUCT_ID']) if (!process.env[key]?.trim()) throw new Error(`Missing ${key}`)
  if (!/^\d+$/.test(process.env.INFOMANIAK_PRODUCT_ID)) throw new Error('Product ID must be numeric')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: 'https://api.anthropic.com', maxRetries: 0, timeout: 90000 })
  async function run(c, p, repeat) {
    const start = performance.now()
    const r = { case: c.id, task: c.task, provider: p.id, model: p.model, repeat, startedAt: new Date().toISOString(), productionTimeoutMs: c.productionTimeoutMs,
      inputHash: createHash('sha256').update(c.system + c.input + JSON.stringify(c.schema)).digest('hex') }
    try {
      let text, stop
      if (p.id === 'haiku') {
        const response = await anthropic.messages.create({ model: p.model, max_tokens: c.maxTokens,
          output_config: { effort: 'low', format: { type: 'json_schema', schema: c.schema } }, system: c.system, messages: [{ role: 'user', content: c.input }] })
        text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
        stop = response.stop_reason
        r.usage = { input: response.usage.input_tokens, output: response.usage.output_tokens, cacheRead: response.usage.cache_read_input_tokens ?? 0, cacheWrite: response.usage.cache_creation_input_tokens ?? 0 }
        r.responseModel = response.model
      } else if (p.model === AI_MODEL) {
        // Exercise the real application transport, including its timeout and no-store policy.
        const response = await complete({ system: c.system, input: c.input, schema: c.schema, maxTokens: c.maxTokens, timeoutMs: c.productionTimeoutMs })
        text = response.text
        stop = response.complete ? 'stop' : 'incomplete'
        r.usage = { input: response.usage.input_tokens, output: response.usage.output_tokens }
        r.responseModel = AI_MODEL
      } else {
        const response = await fetch(`https://api.infomaniak.com/2/ai/${process.env.INFOMANIAK_PRODUCT_ID}/openai/v1/chat/completions`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90000), headers: { Authorization: `Bearer ${process.env.INFOMANIAK_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: p.model, messages: [{ role: 'system', content: c.system }, { role: 'user', content: c.input }], max_completion_tokens: c.maxTokens,
            reasoning_effort: 'none', stream: false, response_format: { type: 'json_schema', json_schema: { name: 'comparison', strict: true, schema: c.schema } } }),
        })
        if (!response.ok) { const error = new Error('Provider HTTP error'); error.status = response.status; throw error }
        const body = await response.json()
        text = body.choices?.[0]?.message?.content
        stop = body.choices?.[0]?.finish_reason
        r.usage = { input: body.usage.prompt_tokens, output: body.usage.completion_tokens, reasoning: body.usage.completion_tokens_details?.reasoning_tokens ?? 0 }
        r.responseModel = body.model
      }
      r.ms = Math.round(performance.now() - start)
      r.stop = stop
      r.cost = (r.usage.input * p.inputRate + r.usage.output * p.outputRate + (r.usage.cacheRead ?? 0) * (p.cacheReadRate ?? 0) + (r.usage.cacheWrite ?? 0) * p.inputRate * 1.25) / 1e6
      r.text = text
      r.raw = JSON.parse(text)
      r.evaluation = evaluate(c, r.raw)
      r.evaluation.checks.unshift({ id: 'complete', pass: ['end_turn', 'stop'].includes(stop), detail: stop })
    } catch (error) {
      r.ms = Math.round(performance.now() - start)
      // Never include SDK errors, request headers, credentials or full HTTP bodies.
      r.error = { kind: error.name, status: error.status ?? null, networkCode: error.cause?.code ?? null }
    }
    return r
  }
  runs: for (let repeat = 1; repeat <= repeats; repeat++) for (const c of selected) {
    const pending = providers.filter(p => !report.results.some(r => r.case === c.id && r.repeat === repeat && r.provider === p.id))
    if (!pending.length) continue
    const pair = await Promise.all(pending.map(p => run(c, p, repeat)))
    report.results.push(...pair)
    save()
    console.log(JSON.stringify(pair.map(r => ({ case: r.case, repeat, provider: r.provider, ms: r.ms, error: r.error, failed: r.evaluation?.checks.filter(c => !c.pass) }))))
    if (pair.some(r => r.error && (r.error.status === 401 || r.error.status === 403 || r.error.networkCode))) {
      console.error('Stopped: authentication, permissions or network failure. Safe details in report.')
      process.exitCode = 1
      break runs
    }
  }
  console.log(JSON.stringify({ output, summary: save().map(({ failures, ...s }) => s) }, null, 2))
}
