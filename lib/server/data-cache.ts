/** LRU bounded by source JSON bytes (not a claim about V8 heap size). */
export class DataCache<T> {
  private entries = new Map<string, { at: number; bytes: number; value: T }>()
  private bytes = 0
  private maxBytes: number
  private ttl: number
  private maxEntries: number

  constructor(maxBytes: number, ttl: number, maxEntries = 128) {
    this.maxBytes = maxBytes
    this.ttl = ttl
    this.maxEntries = maxEntries
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.at >= this.ttl) {
      this.remove(key)
      return undefined
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: T, bytes: number): void {
    this.remove(key)
    for (const [key, entry] of this.entries) {
      if (Date.now() - entry.at >= this.ttl) this.remove(key)
    }
    // Oversized files may serve the current request without staying resident.
    if (bytes > this.maxBytes) return
    while (this.entries.size && (this.bytes + bytes > this.maxBytes || this.entries.size >= this.maxEntries)) {
      this.remove(this.entries.keys().next().value!)
    }
    this.entries.set(key, { at: Date.now(), bytes, value })
    this.bytes += bytes
  }

  private remove(key: string): void {
    const entry = this.entries.get(key)
    if (entry) this.bytes -= entry.bytes
    this.entries.delete(key)
  }
}
