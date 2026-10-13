import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { completeFacts, FACTS_MODEL } from '../scrapers/lib/facts-ai.ts'

const originalFetch = globalThis.fetch
const originalKey = process.env.ANTHROPIC_API_KEY
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = originalKey
})

test('public facts use the existing Anthropic key, structured output and no automatic retries', async () => {
  process.env.ANTHROPIC_API_KEY = 'synthetic-key'
  let calls = 0
  globalThis.fetch = async (url, options) => {
    calls++
    assert.equal(url, 'https://api.anthropic.com/v1/messages')
    assert.equal(options?.redirect, 'error')
    const body = JSON.parse(options!.body as string)
    assert.equal(body.model, FACTS_MODEL)
    assert.equal(body.output_config.format.type, 'json_schema')
    assert.deepEqual(body.messages, [{ role: 'user', content: 'Public course curriculum' }])
    return Response.json({ content: [{ type: 'text', text: '{"programmes":[]}' }], stop_reason: 'end_turn', usage: { input_tokens: 50, output_tokens: 12 } })
  }
  const result = await completeFacts({ system: 'Read facts', input: 'Public course curriculum', schema: { type: 'object' }, maxTokens: 100 })
  assert.equal(result.complete, true)
  assert.equal(result.usage.output_tokens, 12)
  assert.equal(calls, 1)
  const personal = readFileSync(new URL('../lib/infomaniak.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(personal, /ANTHROPIC_API_KEY|api\.anthropic\.com/)
  const workflow = readFileSync(new URL('../.github/workflows/wsis-fakten.yml', import.meta.url), 'utf8')
  assert.match(workflow, /secrets\.ANTHROPIC_API_KEY/)
  assert.doesNotMatch(workflow, /secrets\.INFOMANIAK/)
})

test('facts transport failures neither leak response bodies nor fall back to another provider', async () => {
  process.env.ANTHROPIC_API_KEY = 'synthetic-key'
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response('synthetic-key private error details', { status: 429 }) }
  const input = { system: 'Read facts', input: 'Public course curriculum', maxTokens: 100 }
  await assert.rejects(completeFacts(input), { message: 'Public programme reader unavailable' })
  assert.equal(calls, 1)
  delete process.env.ANTHROPIC_API_KEY
  await assert.rejects(completeFacts(input), /ANTHROPIC_API_KEY required/)
  assert.equal(calls, 1)
})

test('incomplete facts responses retain their usage for the spending cap', async () => {
  process.env.ANTHROPIC_API_KEY = 'synthetic-key'
  globalThis.fetch = async () => Response.json({ content: [{ type: 'text', text: '{' }], stop_reason: 'max_tokens', usage: { input_tokens: 80, output_tokens: 20 } })
  const result = await completeFacts({ system: '', input: 'Public curriculum', maxTokens: 20 })
  assert.equal(result.complete, false)
  assert.equal(result.usage.output_tokens, 20)
})
