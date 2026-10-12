'use client'

import { useSyncExternalStore } from 'react'
import type { Preferences, QuestionnaireAnswers, SourceId, SourceSummary } from './engine/types.ts'
import type { ProgrammeCompare } from './engine/programme-changes.ts'
import { readContentInput, saveContentInput } from './content-store.ts'
import type { ContentAnalysisInput } from './sources/exports.ts'

/**
 * Summaries and settings live in this browser's localStorage: the
 * per-source summaries (aggregates, never raw history), questionnaire answers,
 * preferences and the unlock token. Parsed YouTube exports for the optional
 * AI step live separately in IndexedDB. "Delete my data" wipes both.
 */

export interface State {
  /** Identifies the current YouTube import in this site's local IndexedDB record. */
  contentImportId?: string
  /** Optional semantic summary; the original stays available when switched off. */
  contentAnalysis?: { baseCollectedAt: string; summary: SourceSummary; enabled: boolean; compare?: ProgrammeCompare }
  summaries: Partial<Record<SourceId, SourceSummary>>
  answers: QuestionnaireAnswers
  prefs: Preferences
  unlock?: { token: string; expiresAt: number }
  /** How the start page is laid out: the questionnaire alone (standard) or data exports first. */
  mode?: 'standard' | 'data'
  /** Student link of a school or counselling service this visitor came through. */
  org?: string
  /** Random id of this browser, so an organisation's plan counts one student once a month. */
  student?: string
}

export const DEFAULT_PREFS: Preferences = {
  level: 'bachelor',
  countries: [],
  maxTuitionEur: 0,
  origin: 'eu',
  englishOnly: false,
}

// Each site keeps its own state: the Swiss site starts with Switzerland selected.
let KEY = 'wsis:v1'
let defaults: Preferences = DEFAULT_PREFS
let EMPTY: State = { summaries: {}, answers: {}, prefs: defaults }

let current: State = EMPTY
let loaded = false
const listeners = new Set<() => void>()

/** Picks the storage key and default preferences; call before the first read. */
export function configureStore(key: string, prefs: Preferences): void {
  if (key === KEY && prefs === defaults) return
  KEY = key
  defaults = prefs
  EMPTY = { summaries: {}, answers: {}, prefs }
  current = EMPTY
  loaded = false
}

function load(): State {
  if (loaded) return current
  loaded = true
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>
      current = { ...EMPTY, ...parsed, prefs: { ...defaults, ...parsed.prefs } }
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

export function setSummary(s: SourceSummary, contentInput?: ContentAnalysisInput): Promise<void> {
  const contentImportId = s.source === 'takeout' && contentInput ? crypto.randomUUID() : undefined
  const saved = s.source === 'takeout' ? saveContentInput(KEY, contentImportId && contentInput ? { id: contentImportId, input: contentInput } : null) : Promise.resolve()
  update((st) => ({ ...st, summaries: { ...st.summaries, [s.source]: s }, ...(s.source === 'takeout' ? { contentAnalysis: undefined, contentImportId } : {}) }))
  return saved
}

export function loadContentInput(state: State): Promise<ContentAnalysisInput | null> {
  return state.summaries.takeout && state.contentImportId ? readContentInput(KEY, state.contentImportId) : Promise.resolve(null)
}

export function effectiveSummaries(state: State): SourceSummary[] {
  const ai = state.contentAnalysis
  return (Object.values(state.summaries).filter(Boolean) as SourceSummary[]).map((s) =>
    s.source === 'takeout' && ai?.enabled && ai.baseCollectedAt === s.collectedAt ? ai.summary : s)
}

export function removeSummary(id: SourceId): void {
  if (id === 'takeout') void saveContentInput(KEY, null)
  update((st) => {
    const summaries = { ...st.summaries }
    delete summaries[id]
    return { ...st, summaries, ...(id === 'takeout' ? { contentAnalysis: undefined, contentImportId: undefined } : {}) }
  })
}

export function clearAll(): void {
  void saveContentInput(KEY, null)
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

/** The random id that counts this browser once against an organisation's plan. */
export function studentId(): string {
  const have = getState().student
  if (have) return have
  const id = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, '').slice(0, 32)
  update((s) => ({ ...s, student: id }))
  return id
}
