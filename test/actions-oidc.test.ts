import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { ACTIONS_ISSUER, FACTS_AUDIENCE, checkActionsToken, type Jwk } from '../lib/actions-oidc.ts'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk: Jwk = { ...(publicKey.export({ format: 'jwk' }) as Jwk), kid: 'k1' }
const NOW = 1_800_000_000

function sign(claims: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1', typ: 'JWT' }, key = privateKey) {
  const h = Buffer.from(JSON.stringify(header)).toString('base64url')
  const p = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${h}.${p}.${createSign('RSA-SHA256').update(`${h}.${p}`).sign(key).toString('base64url')}`
}

const good = {
  iss: ACTIONS_ISSUER,
  aud: FACTS_AUDIENCE,
  exp: NOW + 300,
  iat: NOW,
  nbf: NOW - 10,
  repository: 'moritzlauper/whatshouldistudy',
  ref: 'refs/heads/main',
  event_name: 'workflow_dispatch',
  job_workflow_ref: 'moritzlauper/whatshouldistudy/.github/workflows/wsis-fakten.yml@refs/heads/main',
}

test('a run of the facts workflow on main is accepted', () => {
  assert.ok(checkActionsToken(sign(good), [jwk], NOW))
  assert.ok(checkActionsToken(sign({ ...good, aud: [FACTS_AUDIENCE, 'other'] }), [jwk], NOW))
  assert.ok(checkActionsToken(sign({ ...good, event_name: 'schedule' }), [jwk], NOW))
  assert.ok(checkActionsToken(sign({ ...good, event_name: 'workflow_run' }), [jwk], NOW))
})

test('every other run, audience, branch, workflow or time is refused', () => {
  const refused = (claims: Record<string, unknown>) => assert.equal(checkActionsToken(sign(claims), [jwk], NOW), null)
  refused({ ...good, aud: 'someone-else' })
  refused({ ...good, repository: 'moritzlauper/outreach' })
  refused({ ...good, ref: 'refs/heads/feature' })
  refused({ ...good, event_name: 'workflow_run', ref: 'refs/heads/feature' })
  refused({ ...good, event_name: 'workflow_run', repository: 'someone/fork' })
  refused({ ...good, job_workflow_ref: 'moritzlauper/whatshouldistudy/.github/workflows/wsis-fakten.yml@refs/heads/feature' })
  refused({ ...good, event_name: 'pull_request' })
  refused({ ...good, job_workflow_ref: 'moritzlauper/whatshouldistudy/.github/workflows/wsis-daten.yml@refs/heads/main' })
  refused({ ...good, iss: 'https://example.com' })
  refused({ ...good, exp: NOW - 120 })
  refused({ ...good, nbf: NOW + 3600 })
})

test('a changed payload, another signing key, another algorithm or an unknown key is refused', () => {
  const [h, , s] = sign(good).split('.')
  const forged = Buffer.from(JSON.stringify({ ...good, repository: 'moritzlauper/evil' })).toString('base64url')
  assert.equal(checkActionsToken(`${h}.${forged}.${s}`, [jwk], NOW), null)
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
  assert.equal(checkActionsToken(sign(good, undefined, other), [jwk], NOW), null)
  assert.equal(checkActionsToken(sign(good, { alg: 'HS256', kid: 'k1' }), [jwk], NOW), null)
  assert.equal(checkActionsToken(sign(good, { alg: 'RS256', kid: 'unknown' }), [jwk], NOW), null)
  assert.equal(checkActionsToken('not-a-token', [jwk], NOW), null)
})
