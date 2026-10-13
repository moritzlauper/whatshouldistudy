'use client'

import { useSyncExternalStore } from 'react'
import type { Preferences, QuestionnaireAnswers, SourceId, SourceSummary } from './engine/types.ts'
import type { ProgrammeChange, ProgrammeCompare } from './engine/programme-changes.ts'
import { readCompareRows, readContentInput, readContentProgress, saveContentInput, writeCompareRows, writeContentProgress } from './content-store.ts'
import type { ContentAnalysisInput } from './sources/exports.ts'
import type { WorkPreferences } from './work/types.ts'
import { isCurrentProgress, type ContentProgress } from './engine/content-analysis.ts'

/**
 * Summaries and settings live in this browser's localStorage: the
 * per-source summaries (aggregates, never raw history), questionnaire answers,
 * preferences and the unlock token. Parsed Google activity and YouTube exports for the optional
 * AI step live separately in IndexedDB. "Delete my data" wipes both.
 */

export interface State {
  /** Preferences for the free job explorer, cleared together with the study profile. */
  workPrefs?: WorkPreferences
  /** Identifies the current YouTube import in this site's local IndexedDB record. */
  contentImportId?: string
  /** Optional semantic summary; the original stays available when switched off. */
  contentAnalysis?: { baseCollectedAt: string; summary: SourceSummary; google?: { baseCollectedAt: string; summary: SourceSummary }; enabled: boolean; provider?: 'infomaniak'; compare?: ProgrammeCompare }
  summaries: Partial<Record<SourceId, SourceSummary>>
  answers: QuestionnaireAnswers
  prefs: Preferences
  unlock?: { token: string; expiresAt: number }
  /** Legacy start-page choice from older browser profiles; ignored by the current flow. */
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
  // A separately imported News file can supplement an existing YouTube import.
  if (s.source === 'google-search' && contentInput?.google) {
    const existing = getState()
    if (existing.contentImportId && existing.summaries.takeout) return readContentInput(KEY, existing.contentImportId).then(async input => {
      if (!input || input.google?.collectedAt === contentInput.google!.collectedAt || getState().contentImportId !== existing.contentImportId) return
      const id = crypto.randomUUID()
      await saveContentInput(KEY, { id, input: { ...input, google: contentInput.google } })
      if (getState().contentImportId === existing.contentImportId) update(st => ({ ...st, contentImportId: id, contentAnalysis: undefined }))
    })
  }
  return saved
}

export async function loadContentInput(state: State): Promise<ContentAnalysisInput | null> {
  const input = state.summaries.takeout && state.contentImportId ? await readContentInput(KEY, state.contentImportId) : null
  // Replacing or removing the Google source must not send titles from the old source.
  return input?.google && input.google.collectedAt !== state.summaries['google-search']?.collectedAt ? { ...input, google: undefined } : input
}

/** The unfinished run of the current import. A run from another import, version or an older save is removed. */
export async function loadContentProgress(state: State): Promise<ContentProgress | null> {
  const base = state.summaries.takeout
  if (!base || !state.contentImportId) return null
  const saved = await readContentProgress(KEY)
  if (!saved) return null
  if (isCurrentProgress(saved, state.contentImportId, base.collectedAt)) return saved
  void writeContentProgress(KEY, null)
  return null
}

export function saveContentProgress(progress: ContentProgress | null): Promise<void> {
  return writeContentProgress(KEY, progress)
}

/** The comparison's rows, with the time the comparison was made. They are read back only for that same comparison. */
export async function loadCompareRows(state: State, at: string): Promise<ProgrammeChange[] | null> {
  if (!state.summaries.takeout || !state.contentImportId) return null
  const saved = await readCompareRows(KEY)
  return saved && saved.at === at ? saved.rows : null
}

export function saveCompareRows(at: string, rows: ProgrammeChange[]): Promise<void> {
  return writeCompareRows(KEY, { at, rows })
}

export function discardCompareRows(): Promise<void> {
  return writeCompareRows(KEY, null)
}

export function effectiveSummaries(state: State): SourceSummary[] {
  const ai = state.contentAnalysis
  const active = ai?.enabled && ai.baseCollectedAt === state.summaries.takeout?.collectedAt
  return (Object.values(state.summaries).filter(Boolean) as SourceSummary[]).map((s) =>
    active && s.source === 'takeout' ? ai!.summary
      : active && s.source === 'google-search' && ai!.google?.baseCollectedAt === s.collectedAt ? ai!.google.summary : s)
}

export function removeSummary(id: SourceId): void {
  if (id === 'google-search') {
    const importId = getState().contentImportId
    if (importId) void readContentInput(KEY, importId).then(input => {
      if (input?.google && getState().contentImportId === importId) return saveContentInput(KEY, { id: importId, input: { ...input, google: undefined } })
    })
  }
  if (id === 'takeout') void saveContentInput(KEY, null)
  update((st) => {
    const summaries = { ...st.summaries }
    delete summaries[id]
    return { ...st, summaries, ...(id === 'takeout' ? { contentAnalysis: undefined, contentImportId: undefined } : {}), ...(id === 'google-search' && st.contentAnalysis ? { contentAnalysis: { ...st.contentAnalysis, google: undefined } } : {}) }
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
