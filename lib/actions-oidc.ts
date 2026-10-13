import { createPublicKey, createVerify } from 'node:crypto'

/**
 * Proof that a request comes from a run of the facts workflow on main. GitHub
 * Actions signs a short-lived token for each run (OpenID Connect). The site checks
 * the signature and the claims before it stores anything, so no shared secret has
 * to be kept in GitHub or on the site.
 */

export const ACTIONS_ISSUER = 'https://token.actions.githubusercontent.com'
export const FACTS_AUDIENCE = 'wasstudieren-facts'
const REPOSITORY = 'moritzlauper/whatshouldistudy'
const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/wsis-fakten.yml@refs/heads/main`
const EVENTS = ['workflow_dispatch', 'schedule', 'workflow_run']
const LEEWAY_SECONDS = 60

export interface Jwk {
  kty: string
  kid?: string
  n?: string
  e?: string
}

export interface ActionsClaims {
  iss: string
  aud: string | string[]
  exp: number
  nbf?: number
  repository?: string
  ref?: string
  event_name?: string
  job_workflow_ref?: string
  [claim: string]: unknown
}

let cached: { at: number; list: Jwk[] } | null = null

/** GitHub's signing keys, kept for an hour. */
export async function actionsKeys(): Promise<Jwk[]> {
  if (cached && Date.now() - cached.at < 3600_000) return cached.list
  const res = await fetch(`${ACTIONS_ISSUER}/.well-known/jwks`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`jwks: HTTP ${res.status}`)
  const body = (await res.json()) as { keys?: Jwk[] }
  cached = { at: Date.now(), list: body.keys ?? [] }
  return cached.list
}

const decode = (part: string) => Buffer.from(part, 'base64url')

/**
 * The claims of a GitHub Actions token if GitHub signed it, it names the facts
 * audience, and it comes from a run of the facts workflow on main; otherwise null.
 */
export function checkActionsToken(jwt: string, list: Jwk[], now = Date.now() / 1000): ActionsClaims | null {
  const parts = jwt.split('.')
  if (parts.length !== 3) return null
  let header: { alg?: unknown; kid?: unknown }
  let claims: ActionsClaims
  try {
    header = JSON.parse(decode(parts[0]).toString('utf8'))
    claims = JSON.parse(decode(parts[1]).toString('utf8'))
  } catch {
    return null
  }
  if (header.alg !== 'RS256') return null
  const key = list.find((k) => k.kty === 'RSA' && k.kid === header.kid)
  if (!key || !key.n || !key.e) return null
  const publicKey = createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' })
  if (!createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`).verify(publicKey, decode(parts[2]))) return null
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  const fresh = typeof claims.exp === 'number' && claims.exp + LEEWAY_SECONDS > now && (claims.nbf === undefined || claims.nbf - LEEWAY_SECONDS <= now)
  const ours =
    claims.iss === ACTIONS_ISSUER &&
    audience.includes(FACTS_AUDIENCE) &&
    claims.repository === REPOSITORY &&
    claims.ref === 'refs/heads/main' &&
    typeof claims.event_name === 'string' &&
    EVENTS.includes(claims.event_name) &&
    typeof claims.job_workflow_ref === 'string' &&
    claims.job_workflow_ref === WORKFLOW_REF
  return fresh && ours ? claims : null
}
