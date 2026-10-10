'use client'

import { useEffect, useRef, useState } from 'react'
import { hasProgrammePages, programmeSlug } from '@/lib/catalogue.ts'
import type { CatalogueResult } from '@/lib/catalogue.ts'
import type { Level } from '@/lib/programmes.ts'
import { withBase } from '@/lib/site.ts'
import { catalogueText } from '@/lib/site/catalogue-text.ts'
import { fmtNumber, levelLabel } from '@/lib/site/labels.ts'
import { CatalogueRow } from './catalogue-row.tsx'
import { useSite } from './site-context.tsx'

/** Sent by a «more at this institution» button to fill in the search. */
const SEARCH_EVENT = 'catalogue-search'
type Detail = { q: string; level?: Level }

/**
 * Search in one country's catalogue, optionally within one field. Results show
 * only once there is a query or a level, so the page's own list stays in view.
 */
export function CatalogueSearch({ country, field, levels, title }: { country: string; field?: string; levels: Level[]; title: string }) {
  const { locale, intl, r } = useSite()
  const ct = catalogueText(locale)
  const [q, setQ] = useState('')
  const [level, setLevel] = useState<Level | ''>('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<CatalogueResult | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const box = useRef<HTMLDivElement>(null)
  const active = q.trim().length >= 2 || level !== ''

  useEffect(() => {
    const fill = (e: Event) => {
      const d = (e as CustomEvent<Detail>).detail
      setQ(d.q)
      setLevel(d.level ?? '')
      setPage(0)
      box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener(SEARCH_EVENT, fill)
    return () => window.removeEventListener(SEARCH_EVENT, fill)
  }, [])

  useEffect(() => {
    if (!active) {
      setData(null)
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setState('loading')
      const params = new URLSearchParams({ country, q: q.trim(), locale, page: String(page) })
      if (field) params.set('field', field)
      if (level) params.set('level', level)
      try {
        const res = await fetch(withBase(`/api/catalogue?${params}`), { signal: ctrl.signal })
        if (!res.ok) throw new Error(String(res.status))
        const next = (await res.json()) as CatalogueResult
        setData((prev) => (page > 0 && prev ? { ...next, items: [...prev.items, ...next.items] } : next))
        setState('idle')
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setState('error')
      }
    }, page > 0 ? 0 : 250)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [active, country, field, level, locale, page, q])

  return (
    <div ref={box} className="card scroll-mt-24 p-5 sm:p-6">
      <h2 className="font-display text-2xl">{title}</h2>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => (setQ(e.target.value), setPage(0))}
          placeholder={ct.search.placeholder}
          aria-label={ct.search.label}
          className="input min-w-[12rem] flex-1"
        />
        {levels.length > 1 && (
          <select value={level} onChange={(e) => (setLevel(e.target.value as Level | ''), setPage(0))} aria-label={ct.search.allLevels} className="input w-auto">
            <option value="">{ct.search.allLevels}</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                {levelLabel(l, locale)}
                {data?.levels[l] !== undefined ? ` (${fmtNumber(data.levels[l]!, intl)})` : ''}
              </option>
            ))}
          </select>
        )}
      </form>
      {active && (
        <div className="mt-4" aria-live="polite">
          {state === 'error' && <p className="text-sm text-muted">{ct.search.error}</p>}
          {data && !data.ready && <p className="text-sm text-muted">{ct.search.unavailable}</p>}
          {data?.ready && (
            <>
              <p className="text-sm font-bold text-muted">{data.total ? ct.search.results(fmtNumber(data.total, intl)) : ct.search.none}</p>
              <ul className="mt-2">
                {data.items.map((p) => (
                  <CatalogueRow key={p.id} p={p} country={country} locale={locale} showInstitution fieldHref={(f) => r.countryField(country, f)} href={hasProgrammePages(country) ? r.programme(country, p.fields[0], programmeSlug(p)) : undefined} />
                ))}
              </ul>
              {data.items.length < data.total && (
                <button type="button" onClick={() => setPage((n) => n + 1)} disabled={state === 'loading'} className="btn btn-ghost btn-sm mt-3">
                  {state === 'loading' ? ct.search.loading : ct.search.more}
                </button>
              )}
            </>
          )}
          {!data && state === 'loading' && <p className="text-sm text-muted">{ct.search.loading}</p>}
        </div>
      )}
    </div>
  )
}

/** «12 more at this institution»: searches for them in the box above. */
export function MoreAt({ label, q, level }: { label: string } & Detail) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent<Detail>(SEARCH_EVENT, { detail: { q, level } }))} className="mt-1 text-xs font-bold text-accent hover:underline">
      {label} →
    </button>
  )
}
