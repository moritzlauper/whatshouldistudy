'use client'

import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'

/**
 * The institution chosen in a field page's search box, per page address. It
 * outlives the page, so going back to it shows the same list (and the browser
 * restores the scroll position to the same place); a fresh load starts unfiltered.
 */
let chosen: Readonly<Record<string, string>> = {}
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener))
const NONE: Readonly<Record<string, string>> = {}

export function useInstitution(): [string, (institution: string) => void] {
  const path = usePathname()
  const all = useSyncExternalStore(subscribe, () => chosen, () => NONE)
  const set = (institution: string) => {
    chosen = { ...chosen, [path]: institution }
    listeners.forEach((l) => l())
  }
  return [all[path] ?? '', set]
}

/** Shows its children unless another institution is chosen. */
export function InstitutionGate({ names, children }: { names: string[]; children: React.ReactNode }) {
  const [institution] = useInstitution()
  return !institution || names.includes(institution) ? children : null
}

/** A level's section with its count, for the chosen institution only. */
export function LevelSection({ id, label, counts, children }: { id: string; label: string; counts: Record<string, string>; children: React.ReactNode }) {
  const [institution] = useInstitution()
  if (institution && !counts[institution]) return null
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="font-display text-3xl">
        {label} <span className="text-muted">({institution ? counts[institution] : counts['']})</span>
      </h2>
      {children}
    </section>
  )
}
