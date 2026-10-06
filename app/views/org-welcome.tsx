'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { withBase } from '@/lib/site.ts'
import { measurePurchase } from '@/lib/measure.ts'
import type { Price } from '@/lib/pricing.ts'
import type { Interval, OrgTier } from '@/lib/pricing.ts'
import { orgsText } from '@/lib/site/orgs-text.ts'
import { fmtNumber } from '@/lib/site/labels.ts'
import { useSite } from '../ui/site-context.tsx'
import { Burst } from '../ui/shapes.tsx'

interface OrgInfo {
  student: string
  admin: string
  tier: OrgTier
  interval: Interval
  limit: number | null
  used: number | null
  active: boolean
  price?: Price
  error?: string
}

function CopyField({ label, hint, value, copy, copied }: { label: string; hint: string; value: string; copy: string; copied: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="card-sm p-6">
      <h2 className="font-display text-2xl">{label}</h2>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input readOnly value={value} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-xl border-2 border-line bg-surface px-3 py-2 font-mono text-sm" />
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

/** Where Stripe sends an organisation after subscribing, and its dashboard afterwards (?admin=…). */
export function OrgWelcomeView() {
  const { r, locale, intl } = useSite()
  const o = orgsText(locale)
  const w = o.welcome
  const router = useRouter()
  const [info, setInfo] = useState<OrgInfo | null>(null)
  const [error, setError] = useState('')
  const [portalBusy, setPortalBusy] = useState(false)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const q = new URLSearchParams(window.location.search)
    const sid = q.get('session_id')
    const admin = q.get('admin')
    const query = sid ? `session_id=${encodeURIComponent(sid)}` : `admin=${encodeURIComponent(admin ?? '')}`
    fetch(withBase(`/api/org?${query}`))
      .then(async (res) => {
        const j = (await res.json()) as OrgInfo
        if (!res.ok || !j.admin) throw new Error(j.error ?? w.failed)
        setInfo(j)
        if (sid) {
          if (j.price) measurePurchase({ id: sid, amount: j.price.amount, currency: j.price.currency })
          // From now on the address itself is the way back.
          router.replace(`${r.orgWelcome}?admin=${encodeURIComponent(j.admin)}`)
        }
      })
      .catch((e: Error) => setError(e.message))
  }, [router, r, w])

  async function portal() {
    if (!info) return
    setPortalBusy(true)
    try {
      const res = await fetch(withBase(`/api/org/portal?o=${encodeURIComponent(window.location.origin)}`), { method: 'POST', body: JSON.stringify({ admin: info.admin }) })
      const j = (await res.json()) as { url?: string; error?: string }
      if (!j.url) throw new Error(j.error ?? w.failed)
      window.location.assign(j.url)
    } catch (e) {
      setError((e as Error).message)
      setPortalBusy(false)
    }
  }

  if (error)
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-4xl">{w.failed}</h1>
        <p className="mt-4 text-muted">{error}</p>
        <p className="mt-2 text-sm text-muted">{w.charged}</p>
      </div>
    )
  if (!info)
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <Burst className="spin-slow mx-auto" size={96} color="var(--lime)" />
        <h1 className="mt-8 font-display text-4xl">{w.working}</h1>
      </div>
    )

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const studentUrl = `${origin}${withBase(r.start)}?org=${encodeURIComponent(info.student)}`
  const adminUrl = `${origin}${withBase(r.orgWelcome)}?admin=${encodeURIComponent(info.admin)}`
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <h1 className="font-display text-5xl sm:text-6xl">{info.active ? w.title : w.inactive}</h1>
      <p className="mt-5 text-xl text-muted">
        {w.plan(`${o.tiers[info.tier].name}, ${(info.interval === 'year' ? o.yearly : o.monthly).toLowerCase()}`)}
      </p>
      {info.used !== null && (
        <p className="mt-2 font-semibold">
          {w.used(fmtNumber(info.used, intl), info.limit === null ? null : fmtNumber(info.limit, intl))} <span className="text-sm font-normal text-muted">{w.lag}</span>
        </p>
      )}
      <div className="mt-10 grid gap-6">
        <CopyField label={w.studentLink} hint={w.studentHint} value={studentUrl} copy={w.copy} copied={w.copied} />
        <CopyField label={w.adminLink} hint={w.adminHint} value={adminUrl} copy={w.copy} copied={w.copied} />
      </div>
      <button type="button" onClick={portal} disabled={portalBusy} className="btn btn-ghost btn-lg mt-8">
        {w.portal} <span aria-hidden="true">→</span>
      </button>
    </div>
  )
}
