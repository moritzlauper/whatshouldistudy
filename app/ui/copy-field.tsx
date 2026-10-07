'use client'

import { useState } from 'react'

/** A read-only value with a copy button. */
export function CopyRow({ label, value, copy, copied }: { label?: string; value: string; copy: string; copied: string }) {
  const [done, setDone] = useState(false)
  return (
    <div>
      {label && <p className="mb-1 text-sm font-bold">{label}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input readOnly value={value} aria-label={label} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-xl border-2 border-line bg-surface px-3 py-2 font-mono text-sm" />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => setDone(true), () => {})
          }}
        >
          {done ? copied : copy}
        </button>
      </div>
    </div>
  )
}

/** A card with a heading, a hint and one or more values to copy. */
export function CopyField({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="card-sm p-6">
      <h2 className="font-display text-2xl">{label}</h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <div className="mt-4 grid gap-4">{children}</div>
    </div>
  )
}
