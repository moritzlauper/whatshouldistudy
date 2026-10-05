/**
 * OAuth in the browser, without a server: Google and Reddit with the implicit
 * flow (token in the URL fragment), Spotify with authorization code + PKCE.
 * Tokens live in sessionStorage for the tab only and are never sent to our
 * server; the analysis calls the providers' APIs directly from the browser.
 */

export type Provider = 'google' | 'spotify' | 'reddit'

export const CLIENT_IDS: Record<Provider, string | undefined> = {
  google: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  spotify: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
  reddit: process.env.NEXT_PUBLIC_REDDIT_CLIENT_ID,
}

const SCOPES: Record<Provider, string> = {
  google: 'https://www.googleapis.com/auth/youtube.readonly',
  spotify: [
    'user-top-read',
    'user-read-recently-played',
    'user-library-read',
    'user-follow-read',
    'playlist-read-private',
  ].join(' '),
  reddit: 'identity mysubreddits history read',
}

export function isConfigured(p: Provider): boolean {
  return !!CLIENT_IDS[p]
}

export function redirectUri(p: Provider): string {
  return `${window.location.origin}/callback/${p}`
}

function randomString(bytes = 32): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return base64url(a)
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256(text: string): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return new Uint8Array(buf)
}

function session(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export async function startAuth(p: Provider): Promise<void> {
  const clientId = CLIENT_IDS[p]
  if (!clientId) throw new Error(`${p} is not configured on this deployment`)
  const state = randomString(16)
  session()?.setItem(`wsis:oauth-state:${p}`, state)
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri(p), state, scope: SCOPES[p] })

  let url: string
  if (p === 'google') {
    params.set('response_type', 'token')
    params.set('include_granted_scopes', 'true')
    url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  } else if (p === 'reddit') {
    params.set('response_type', 'token')
    url = `https://www.reddit.com/api/v1/authorize?${params}`
  } else {
    const verifier = randomString(48)
    session()?.setItem('wsis:pkce-verifier', verifier)
    params.set('response_type', 'code')
    params.set('code_challenge_method', 'S256')
    params.set('code_challenge', base64url(await sha256(verifier)))
    url = `https://accounts.spotify.com/authorize?${params}`
  }
  window.location.assign(url)
}

export interface StoredToken {
  accessToken: string
  expiresAt: number
}

/** Handles the redirect back from the provider. Returns the token or throws. */
export async function finishAuth(p: Provider): Promise<StoredToken> {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const query = new URLSearchParams(window.location.search)
  const error = hash.get('error') ?? query.get('error')
  if (error) throw new Error(error === 'access_denied' ? 'You declined access.' : `Sign-in failed: ${error}`)

  const state = hash.get('state') ?? query.get('state')
  const expected = session()?.getItem(`wsis:oauth-state:${p}`)
  session()?.removeItem(`wsis:oauth-state:${p}`)
  if (!state || state !== expected) throw new Error('Sign-in could not be verified. Please try again.')

  let token: StoredToken
  if (p === 'spotify') {
    const code = query.get('code')
    const verifier = session()?.getItem('wsis:pkce-verifier')
    session()?.removeItem('wsis:pkce-verifier')
    if (!code || !verifier) throw new Error('Spotify did not return an authorisation code.')
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(p),
        client_id: CLIENT_IDS.spotify!,
        code_verifier: verifier,
      }),
    })
    if (!res.ok) throw new Error(`Spotify token exchange failed (${res.status}).`)
    const j = (await res.json()) as { access_token: string; expires_in: number }
    token = { accessToken: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 }
  } else {
    const accessToken = hash.get('access_token')
    if (!accessToken) throw new Error('No access token was returned.')
    token = { accessToken, expiresAt: Date.now() + Number(hash.get('expires_in') ?? 3600) * 1000 }
  }
  session()?.setItem(`wsis:token:${p}`, JSON.stringify(token))
  // Drop the token from the address bar and history.
  window.history.replaceState(null, '', window.location.pathname)
  return token
}

export function getToken(p: Provider): string | null {
  try {
    const raw = session()?.getItem(`wsis:token:${p}`)
    if (!raw) return null
    const t = JSON.parse(raw) as StoredToken
    if (t.expiresAt < Date.now() + 60_000) {
      session()?.removeItem(`wsis:token:${p}`)
      return null
    }
    return t.accessToken
  } catch {
    return null
  }
}

export function dropToken(p: Provider): void {
  session()?.removeItem(`wsis:token:${p}`)
}

export class ApiError extends Error {
  status: number
  reason?: string
  constructor(message: string, status: number, reason?: string) {
    super(message)
    this.status = status
    this.reason = reason
  }
}

/** GET JSON with a bearer token; one retry on 429/5xx. */
export async function getJson<T>(url: string, token?: string, headers: Record<string, string> = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } })
    if (res.ok) return (await res.json()) as T
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const wait = Number(res.headers.get('retry-after')) || 1.5 * (attempt + 1)
      await new Promise((r) => setTimeout(r, wait * 1000))
      continue
    }
    let reason: string | undefined
    try {
      const body = (await res.json()) as { error?: { errors?: Array<{ reason?: string }>; message?: string } | string }
      reason = typeof body.error === 'object' ? (body.error.errors?.[0]?.reason ?? body.error.message) : body.error
    } catch {
      // not JSON
    }
    throw new ApiError(`Request failed (${res.status}${reason ? `: ${reason}` : ''})`, res.status, reason)
  }
}

export type Progress = (message: string, count?: number) => void
