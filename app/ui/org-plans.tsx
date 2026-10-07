'use client'

import { useState } from 'react'
import { withBase } from '@/lib/site.ts'
import { ORG_REPORTS, ORG_TIERS, formatPrice, orgBilled, orgPrice } from '@/lib/pricing.ts'
import type { Interval, OrgTier } from '@/lib/pricing.ts'
import { orgsText } from '@/lib/site/orgs-text.ts'
import { fmtNumber } from '@/lib/site/labels.ts'
import { useConfig } from './price.tsx'
import { useSite } from './site-context.tsx'

/** The three plans in the visitor's currency, yearly or monthly, each with its checkout button. */
export function OrgPlans() {
  const { site, base, locale, intl, conf } = useSite()
  const o = orgsText(locale)
  const config = useConfig(site)
  const currency = config?.price.currency ?? conf.currency
  const [period, setPeriod] = useState<Interval>('year')
  const [busy, setBusy] = useState<OrgTier | null>(null)
  const [error, setError] = useState('')

  async function start(tier: OrgTier) {
    setBusy(tier)
    setError('')
    try {
      const q = `tier=${tier}&interval=${period}&site=${site}&back=${encodeURIComponent(base)}&o=${encodeURIComponent(window.location.origin)}`
      const res = await fetch(withBase(`/api/org/checkout?${q}`), { method: 'POST' })
      const j = (await res.json()) as { url?: string; error?: string }
      if (!j.url) throw new Error(j.error ?? o.failed)
      window.location.assign(j.url)
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border-2 border-line bg-surface p-1 font-semibold" role="group">
          {(['year', 'month'] as const).map((p) => (
            <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={`rounded-full px-4 py-1.5 ${period === p ? 'bg-ink text-bg' : 'hover:bg-surface-2'}`}>
              {p === 'year' ? o.yearly : o.monthly}
            </button>
          ))}
        </div>
        <span className="chip on-color bg-lime">{o.save}</span>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {ORG_TIERS.map((tier) => {
          const hot = tier === 'school'
          const limit = ORG_REPORTS[tier]
          return (
            <div key={tier} className={`card relative flex flex-col p-7 ${hot ? 'bg-accent text-accent-ink' : ''}`}>
              {hot && <span className="chip on-color absolute -top-4 left-6 bg-yellow">{o.recommended}</span>}
              <h3 className="font-display text-3xl">{o.tiers[tier].name}</h3>
              <p className={`mt-1 text-sm ${hot ? 'opacity-85' : 'text-muted'}`}>{o.tiers[tier].who}</p>
              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="font-display text-5xl">{formatPrice(orgPrice(tier, period, currency), intl)}</span>
                <span className="font-semibold">{o.perMonth}</span>
              </div>
              <p className={`mt-1 text-sm ${hot ? 'opacity-85' : 'text-muted'}`}>{period === 'year' ? o.billedYearly(formatPrice(orgBilled(tier, 'year', currency), intl)) : o.billedMonthly}</p>
              <p className="on-color mt-4 rounded-xl border-2 border-line bg-lime px-3 py-1.5 text-sm font-bold">{o.trial}</p>
              <p className="mt-6 font-bold">{o.reports(limit === null ? null : fmtNumber(limit, intl))}</p>
              <ul className="mt-3 grid gap-2 text-sm">
                {o.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden="true">✓</span> {f}
                  </li>
                ))}
              </ul>
              <div className="flex-1" />
              <button type="button" disabled={busy !== null || !config || config.payments === 'off'} onClick={() => start(tier)} className={`btn btn-lg mt-7 w-full ${hot ? 'btn-lime' : 'btn-primary'}`}>
                {busy === tier ? o.opening : o.ctaTrial}
              </button>
            </div>
          )
        })}
      </div>
      {error && <p className="mt-4 rounded-xl bg-surface p-3 text-sm font-semibold text-bad">{error}</p>}
    </div>
  )
}
