import type { ContentAnalysisInput } from './sources/exports.ts'
import type { ContentProgress } from './engine/content-analysis.ts'
import type { ProgrammeChange } from './engine/programme-changes.ts'

type SavedInput = { id: string; input: ContentAnalysisInput }
/** The unfinished run sits next to the import under its own key, so both are written and removed together. */
const progressKey = (key: string) => `progress:${key}`
/** The comparison's rows, kept here: the browser's local storage has a size limit, and these are not small. */
const compareKey = (key: string) => `compare:${key}`
// Also works for this visit when browser storage is disabled or full.
const memory = new Map<string, SavedInput | null>()
let database: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('wsis:content-input', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('imports')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch((error) => { database = undefined; throw error })
  return database
}

/** One local record per site. Replacement and deletion are queued in order. */
let writes = Promise.resolve()
export function saveContentInput(key: string, saved: SavedInput | null): Promise<void> {
  memory.set(key, saved)
  writes = writes.then(async () => {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('imports', 'readwrite')
      if (saved) tx.objectStore('imports').put(saved, key)
      else tx.objectStore('imports').delete(key)
      // Replacing or deleting the import also drops its unfinished run and its comparison rows.
      tx.objectStore('imports').delete(progressKey(key))
      tx.objectStore('imports').delete(compareKey(key))
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error)
      tx.onerror = () => reject(tx.error)
    })
  }).catch(() => { /* The in-memory copy is still available. */ })
  return writes
}

export async function readContentInput(key: string, id: string): Promise<ContentAnalysisInput | null> {
  const cached = memory.get(key)
  if (cached?.id === id) return cached.input
  try {
    await writes
    const db = await open()
    const saved = await new Promise<SavedInput | undefined>((resolve, reject) => {
      const request = db.transaction('imports').objectStore('imports').get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    // A pending read must not put deleted or replaced data back in memory.
    if (memory.get(key) !== cached) return memory.get(key)?.id === id ? memory.get(key)!.input : null
    if (saved?.id !== id) return null
    memory.set(key, saved)
    return saved.input
  } catch { return null }
}

/** The unfinished run of this import, saved after each answered group; null removes it. Queued with the imports. */
export function writeContentProgress(key: string, progress: ContentProgress | null): Promise<void> {
  writes = writes.then(async () => {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('imports', 'readwrite')
      if (progress) tx.objectStore('imports').put(progress, progressKey(key))
      else tx.objectStore('imports').delete(progressKey(key))
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error)
      tx.onerror = () => reject(tx.error)
    })
  }).catch(() => { /* Without browser storage the run cannot be continued later; it still works for this visit. */ })
  return writes
}

export async function readContentProgress(key: string): Promise<ContentProgress | null> {
  try {
    await writes
    const db = await open()
    const saved = await new Promise<ContentProgress | undefined>((resolve, reject) => {
      const request = db.transaction('imports').objectStore('imports').get(progressKey(key))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return saved ?? null
  } catch { return null }
}

/** The comparison's rows with the time it was made; null removes them. Queued with the other writes. */
export function writeCompareRows(key: string, saved: { at: string; rows: ProgrammeChange[] } | null): Promise<void> {
  writes = writes.then(async () => {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('imports', 'readwrite')
      if (saved) tx.objectStore('imports').put(saved, compareKey(key))
      else tx.objectStore('imports').delete(compareKey(key))
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error)
      tx.onerror = () => reject(tx.error)
    })
  }).catch(() => { /* Without browser storage the rows are not kept; the comparison is then asked again. */ })
  return writes
}

export async function readCompareRows(key: string): Promise<{ at: string; rows: ProgrammeChange[] } | null> {
  try {
    await writes
    const db = await open()
    const saved = await new Promise<{ at: string; rows: ProgrammeChange[] } | undefined>((resolve, reject) => {
      const request = db.transaction('imports').objectStore('imports').get(compareKey(key))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return saved ?? null
  } catch { return null }
}
