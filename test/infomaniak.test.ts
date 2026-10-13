import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { AI_MODEL, AiError, complete } from '../lib/infomaniak.ts'

const originalFetch = globalThis.fetch
const originalToken = process.env.INFOMANIAK_API_TOKEN
const originalProduct = process.env.INFOMANIAK_PRODUCT_ID
afterEach(() => {
  globalThis.fetch = originalFetch
  for (const [key, value] of [['INFOMANIAK_API_TOKEN', originalToken], ['INFOMANIAK_PRODUCT_ID', originalProduct]]) {
    if (value === undefined) delete process.env[key!]
    else process.env[key!] = value
  }
})
const configured = () => {
  process.env.INFOMANIAK_API_TOKEN = 'synthetic-token'
  process.env.INFOMANIAK_PRODUCT_ID = '123'
}
const request = { system: 'Classify subjects', input: 'Synthetic private title', maxTokens: 30 }
const result = (stop = 'stop') => Response.json({ choices: [{ finish_reason: stop, message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 12, completion_tokens: 5 } })

test('saved consent for the previous processor cannot trigger an automatic Infomaniak comparison', () => {
  const result = spawnSync(process.execPath, ['test/helpers/infomaniak-consent.mjs'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

test('AI uses only Infomaniak, forbids redirects and caching, and sends no user identity or conversation history', async () => {
  configured()
  let calls = 0
  globalThis.fetch = async (url, options) => {
    calls++
    assert.equal(url, 'https://api.infomaniak.com/2/ai/123/openai/v1/chat/completions')
    assert.equal(options?.cache, 'no-store')
    assert.equal(options?.redirect, 'error')
    const body = JSON.parse(options!.body as string)
    assert.equal(body.model, AI_MODEL)
    assert.equal(body.stream, false)
    assert.deepEqual(body.messages, [{ role: 'system', content: request.system }, { role: 'user', content: request.input }])
    assert.equal(body.user, undefined)
    assert.equal(body.metadata, undefined)
    assert.equal(body.conversation, undefined)
    return result()
  }
  assert.deepEqual(await complete(request), { text: '{"ok":true}', complete: true, usage: { input_tokens: 12, output_tokens: 5 } })
  assert.equal(calls, 1)
})

test('missing or invalid Infomaniak configuration never falls back to another provider', async () => {
  configured()
  process.env.INFOMANIAK_PRODUCT_ID = '../another-endpoint'
  globalThis.fetch = async () => { assert.fail('must not make an API call') }
  await assert.rejects(complete(request), AiError)
  delete process.env.INFOMANIAK_API_TOKEN
  await assert.rejects(complete(request), AiError)
})

test('provider errors never expose the echoed prompt or credentials and never retry silently', async () => {
  configured()
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response('Synthetic private title synthetic-token', { status: 429 }) }
  await assert.rejects(complete(request), (error: unknown) => {
    assert.ok(error instanceof AiError)
    assert.equal(error.status, 429)
    assert.doesNotMatch(String(error), /private title|synthetic-token/)
    return true
  })
  assert.equal(calls, 1)
  globalThis.fetch = async () => { throw new Error('Synthetic private title synthetic-token') }
  await assert.rejects(complete(request), { message: 'Infomaniak request unavailable' })
})

test('truncated replies remain incomplete but still expose usage for cost accounting', async () => {
  configured()
  globalThis.fetch = async () => result('length')
  const reply = await complete(request)
  assert.equal(reply.complete, false)
  assert.equal(reply.usage.output_tokens, 5)
})

test('invalid payloads and missing usage fail safely', async () => {
  configured()
  for (const body of ['not JSON', JSON.stringify({ choices: [{ message: { content: 'text' } }] })]) {
    globalThis.fetch = async () => new Response(body)
    await assert.rejects(complete(request), AiError)
  }
})
