'use client'

import { useSyncExternalStore } from 'react'
import type { Preferences, QuestionnaireAnswers, SourceId, SourceSummary } from './engine/types.ts'

/**
 * Everything the analysis keeps lives in this browser's localStorage: the
 * per-source summaries (aggregates, never raw history), questionnaire answers,
 * preferences and the unlock token. "Delete my data" wipes it.
 */

export interface State {
  summaries: Partial<Record<SourceId, SourceSummary>>
  answers: QuestionnaireAnswers
  prefs: Preferences
  unlock?: { token: string; expiresAt: number }
}

const KEY = 'wsis:v1'

export const DEFAULT_PREFS: Preferences = {
  level: 'bachelor',
  countries: [],
  maxTuitionEur: 0,
  origin: 'eu',
  englishOnly: false,
}

const EMPTY: State = { summaries: {}, answers: {}, prefs: DEFAULT_PREFS }

let current: State = EMPTY
let loaded = false
const listeners = new Set<() => void>()

function load(): State {
  if (loaded) return current
  loaded = true
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>
      current = { ...EMPTY, ...parsed, prefs: { ...DEFAULT_PREFS, ...parsed.prefs } }
    }
  } catch {
    current = EMPTY
  }
  return current
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Private mode or full storage: the state still works for this visit.
  }
}

export function getState(): State {
  return typeof window === 'undefined' ? EMPTY : load()
}

export function update(fn: (s: State) => State): void {
  current = fn(getState())
  persist()
  for (const l of listeners) l()
}

export function setSummary(s: SourceSummary): void {
  update((st) => ({ ...st, summaries: { ...st.summaries, [s.source]: s } }))
}

export function removeSummary(id: SourceId): void {
  update((st) => {
    const summaries = { ...st.summaries }
    delete summaries[id]
    return { ...st, summaries }
  })
}

export function clearAll(): void {
  current = EMPTY
  try {
    window.localStorage.removeItem(KEY)
    for (const k of Object.keys(window.sessionStorage)) if (k.startsWith('wsis:')) window.sessionStorage.removeItem(k)
  } catch {
    // ignore
  }
  for (const l of listeners) l()
}

function subscribe(l: () => void) {
  listeners.add(l)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      loaded = false
      load()
      l()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(l)
    window.removeEventListener('storage', onStorage)
  }
}

export function useAppState(): State {
  return useSyncExternalStore(subscribe, getState, () => EMPTY)
}

export function unlockToken(): string | null {
  const u = getState().unlock
  return u && u.expiresAt > Date.now() ? u.token : null
}
