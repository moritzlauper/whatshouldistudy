'use client'

import type { FieldStat } from '@/lib/programmes.ts'
import { useAppState } from '@/lib/store.ts'
import { isLocal } from '@/lib/site/config.ts'
import { fmtMoney } from '@/lib/site/labels.ts'
import { useSite } from './site-context.tsx'

/** Whether Swiss figures fit: the Swiss site, or Switzerland picked on the global one. */
export function useSwiss(): boolean {
  const { site } = useSite()
  const { prefs } = useAppState()
  return site === 'ch' || (site === 'global' && prefs.countries.includes('CH'))
}

/**
 * What graduates of a field earn: Swiss medians (BFS) where Switzerland is the
 * focus, US medians (College Scorecard) on the global site otherwise, nothing
 * where we have no local figures.
 */
export function Earnings({ stat, compact = false }: { stat?: FieldStat; compact?: boolean }) {
  const { t, site, intl } = useSite()
  const swiss = useSwiss()
  const e = t.earnings
  if (swiss && stat?.ch) {
    const ch = stat.ch
    const parts = [
      ch.uhMaster && `${e.uhMaster}: ${fmtMoney(ch.uhMaster, 'CHF', intl)}`,
      ch.fhBachelor && `${e.fhBachelor}: ${fmtMoney(ch.fhBachelor, 'CHF', intl)}`,
      ch.teaching && `${e.teaching}: ${fmtMoney(ch.teaching, 'CHF', intl)}`,
    ].filter(Boolean)
    return compact ? (
      <p className="text-xs text-muted">
        {e.chShort}: {parts.join(' · ')}
      </p>
    ) : (
      <div className="text-sm">
        <div className="font-bold">{e.ch}</div>
        <div className="text-muted">{parts.join(' · ')}</div>
        <div className="mt-0.5 text-xs text-muted">{e.chSource(ch.year)}</div>
      </div>
    )
  }
  if (swiss || isLocal(site) || !stat?.usMedianEarnings) return null
  const us = fmtMoney(stat.usMedianEarnings, 'USD', intl)
  return compact ? (
    <p className="text-xs text-muted">
      {e.us}: {us}
    </p>
  ) : (
    <div className="text-sm">
      <div className="font-bold">{e.us}</div>
      <div className="text-muted">{us}</div>
      <div className="mt-0.5 text-xs text-muted">{e.usSource}</div>
    </div>
  )
}
