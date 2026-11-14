'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { likedKeys, personalSide, strongTypes } from '@/lib/programme-profile.ts'
import { programmePageText } from '@/lib/site/programme-text.ts'
import { useAppState } from '@/lib/store.ts'
import type { RiasecKey } from '@/lib/taxonomy/fields.ts'
import { useSite } from './site-context.tsx'

/**
 * One interest type of the programme: its level, the first field's level when the programme mixes fields, and whether
 * it is one of the programme's own types. A profile from the reading of the official page goes out without levels
 * (`v` 0, `showBars` false): the page shows its types as words only.
 */
export interface FitTypeBar {
  k: RiasecKey
  label: string
  v: number
  base?: number
  top: boolean
}

export interface FitChip {
  key: string
  label: string
}

function Check({ label }: { label: string }) {
  return (
    <>
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12l5 5L20 6" />
      </svg>
      <span className="sr-only">{label}</span>
    </>
  )
}

/**
 * «Is this right for you?» on a programme page: the programme's interest types, what speaks for and against it,
 * and how it differs from its first field. With a finished questionnaire in this browser it marks what matches
 * the answers. That comparison runs here and shows no score and no rank: those stay in the paid report.
 */
export function ProgrammeFit({ title, bars, showBars, barsNote, shift, pro, contra, note }: { title: string; bars: FitTypeBar[]; showBars: boolean; barsNote?: string; shift?: string; pro: FitChip[]; contra: FitChip[]; note?: string }) {
  const { locale, r } = useSite()
  const tx = programmePageText(locale)
  const { answers } = useAppState()
  const side = useMemo(() => personalSide(answers), [answers])
  const tops = bars.filter((b) => b.top)
  const mine = side ? new Set(strongTypes(side.riasec)) : null
  const liked = side ? new Set(likedKeys([...pro, ...contra].map((c) => c.key), side)) : null
  const clashes = liked ? contra.filter((c) => liked.has(c.key)) : []
  const join = (xs: string[]) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(xs)

  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="fit-title">
      <h2 id="fit-title" className="font-display text-2xl sm:text-3xl">
        {side ? tx.personalTitle : title}
      </h2>

      <div>
        <p className="text-sm text-muted">{tx.types}</p>
        <ul className={`mt-2 flex flex-wrap gap-2 ${showBars ? 'sm:hidden' : ''}`}>
          {tops.map((b) => (
            <li key={b.k} className={`chip ${mine?.has(b.k) ? 'on-color bg-lime' : 'bg-accent-soft'}`}>
              {mine?.has(b.k) && <Check label={tx.liked} />}
              {b.label}
            </li>
          ))}
        </ul>
        {showBars && <ul className="mt-2 hidden gap-1.5 sm:grid">
          {bars.map((b) => (
            <li key={b.k} className="grid grid-cols-[8.5rem_1fr] items-center gap-3">
              <span className={`flex items-center gap-1 text-sm ${b.top ? 'font-bold' : 'text-muted'}`}>
                {mine?.has(b.k) && <Check label={tx.liked} />}
                {b.label}
              </span>
              <span className="relative block h-3 rounded-full bg-surface-2">
                <span className={`block h-3 rounded-full ${b.top ? 'bg-accent' : 'bg-accent opacity-50'}`} style={{ width: `${Math.max(3, Math.round(b.v * 100))}%` }} />
                {b.base !== undefined && <span aria-hidden="true" className="absolute -top-1 h-5 w-[3px] rounded bg-ink" style={{ left: `${Math.round(b.base * 100)}%` }} />}
              </span>
            </li>
          ))}
        </ul>}
        {showBars && barsNote && <p className="mt-2 hidden text-xs text-muted sm:block">{barsNote}</p>}
      </div>

      {side ? (
        <p className="on-color rounded-xl border-2 border-line bg-yellow px-3 py-2 text-sm font-semibold">
          {tx.personalSummary(tops.filter((b) => mine?.has(b.k)).length, tops.length, pro.filter((c) => liked?.has(c.key)).length, pro.length)}
        </p>
      ) : (
        shift && <p className="on-color rounded-xl border-2 border-line bg-yellow px-3 py-2 text-sm font-semibold">{shift}</p>
      )}
      {side && shift && <p className="-mt-2 text-sm text-muted">{shift}</p>}

      <div>
        <p className="text-sm text-muted">{tx.pro}</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {pro.map((c) => (
            <li key={c.key} className={`chip ${liked?.has(c.key) ? 'on-color bg-lime' : ''}`}>
              {liked?.has(c.key) && <Check label={tx.liked} />}
              {c.label}
            </li>
          ))}
        </ul>
      </div>

      {contra.length > 0 && (
        <div>
          <p className="text-sm text-muted">{tx.contra}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {contra.map((c) => (
              <li key={c.key} className={liked?.has(c.key) ? 'chip on-color bg-orange' : 'chip-soft'}>
                {c.label}
              </li>
            ))}
          </ul>
          {clashes.length > 0 && <p className="mt-2 text-sm">{tx.clash(join(clashes.map((c) => c.label)))}</p>}
        </div>
      )}

      {note && <p className="text-xs text-muted">{note}</p>}

      <div>
        <Link href={side ? r.results : r.start} className="btn btn-primary btn-lg w-full whitespace-normal text-center">
          {side ? tx.toResult : tx.compare} →
        </Link>
        <p className="mt-2 text-center text-xs text-muted">{side ? tx.personalNote : tx.compareHint}</p>
      </div>
    </section>
  )
}
