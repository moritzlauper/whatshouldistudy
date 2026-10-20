'use client'

import { withBase } from './site.ts'
import { ATTRIBUTION_MS, PAYWALL_EXPERIMENT, assignmentActive, validParticipant, validVariant } from './paywall-experiment.ts'
import type { PaywallAssignment } from './paywall-experiment.ts'
import type { SiteId } from './site/config.ts'
import { effectiveConsent, readConsent } from './measure.ts'
import type { ConsentRule } from './measure.ts'

type State = { status: 'loading' | 'ready'; assignment: PaywallAssignment | null }
const states = new Map<SiteId, State>()
const pending = new Map<SiteId, Promise<void>>()
const listeners = new Set<() => void>()
const generations = new Map<SiteId, number>()
const key = (site: SiteId) => `wsis:experiment:${PAYWALL_EXPERIMENT}:${site}`
export const onExperiment = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const experimentState = (site: SiteId) => states.get(site) ?? null
function publish(site: SiteId, value: State) {
  states.set(site, value)
  for (const fn of listeners) fn()
}

function stored(site: SiteId): { id: string; createdAt: number; assignment?: PaywallAssignment } | null {
  const value = JSON.parse(localStorage.getItem(key(site)) ?? 'null')
  if (!value || !validParticipant(value.id) || !assignmentActive(value.createdAt)) return null
  if (value.assignment && (value.assignment.id !== value.id || value.assignment.site !== site || !validVariant(value.assignment.variant) || !assignmentActive(value.assignment.assignedAt))) return null
  return value
}

/** Called only when the current measurement choice permits persistent assignment. */
export async function ensurePaywallAssignment(site: SiteId, taggedArrival: boolean): Promise<void> {
  if (pending.has(site)) return pending.get(site)
  if (states.has(site)) return
  let saved: ReturnType<typeof stored>
  try {
    saved = stored(site)
    if (!saved && !taggedArrival) return
    saved ??= { id: crypto.randomUUID(), createdAt: Date.now() }
    // If persistence is unavailable, keep the normal experience and do not enrol.
    localStorage.setItem(key(site), JSON.stringify(saved))
  } catch {
    publish(site, { status: 'ready', assignment: null })
    return
  }
  const generation = generations.get(site) ?? 0
  const candidate = saved
  publish(site, { status: 'loading', assignment: candidate.assignment ?? null })
  const request = (async () => {
    try {
      const response = await fetch(withBase('/api/paywall-experiment'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, id: candidate.id }), signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error('Experiment unavailable')
      const data = await response.json() as { assignment: PaywallAssignment | null }
      const a = data.assignment
      if (a && (a.id !== candidate.id || a.site !== site || !validVariant(a.variant) || typeof a.inTest !== 'boolean' || !assignmentActive(a.assignedAt))) throw new Error('Invalid assignment')
      if ((generations.get(site) ?? 0) !== generation || readConsent() === 'denied') return
      if (a) localStorage.setItem(key(site), JSON.stringify({ ...candidate, assignment: a }))
      else localStorage.removeItem(key(site))
      publish(site, { status: 'ready', assignment: a })
    } catch {
      if ((generations.get(site) ?? 0) !== generation) return
      // A previous successful assignment remains stable through a temporary outage.
      publish(site, { status: 'ready', assignment: candidate.assignment ?? null })
    }
  })().finally(() => { if (pending.get(site) === request) pending.delete(site) })
  pending.set(site, request)
  return request
}

export function clearPaywallAssignment(site: SiteId) {
  generations.set(site, (generations.get(site) ?? 0) + 1)
  pending.delete(site)
  let id: string | undefined
  try {
    id = stored(site)?.id
    localStorage.removeItem(key(site))
  } catch { /* Unavailable storage must not block a privacy choice. */ }
  states.delete(site)
  for (const fn of listeners) fn()
  if (id) void fetch(withBase('/api/paywall-experiment'), {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ site, id }), keepalive: true,
  }).catch(() => {})
}

/** Read at checkout on any page, including after navigation and a browser restart. */
export function paywallParticipant(site: SiteId, rule?: ConsentRule): string | null {
  if (!rule || effectiveConsent(readConsent(), rule) !== 'granted') return null
  try {
    const value = stored(site)
    return value?.assignment?.inTest && Date.now() < value.assignment.assignedAt + ATTRIBUTION_MS ? value.id : null
  } catch { return null }
}
