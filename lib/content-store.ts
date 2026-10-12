import type { ContentAnalysisInput } from './sources/exports.ts'

type SavedInput = { id: string; input: ContentAnalysisInput }
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
