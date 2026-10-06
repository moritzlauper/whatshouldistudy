'use client'

import { useEffect, useState } from 'react'
import { update, useAppState } from '@/lib/store.ts'
import { COUNTRIES, REGION_GROUPS, flag } from '@/lib/countries.ts'
import type { Preferences } from '@/lib/engine/types.ts'
import { countryLabel, fieldName, fmtMoney } from '@/lib/site/labels.ts'
import { FIELDS } from '@/lib/taxonomy/fields.ts'
import { useSite } from './site-context.tsx'

const ORIGINS: Array<Preferences['origin']> = ['eu', 'ch', 'uk', 'us', 'other']
const BUDGETS = [0, 500, 1500, 3000, 6000, 12000, 25000, 45000]

export function PrefsForm() {
  const { t, intl, site, conf } = useSite()
  const home = conf.country
  const { prefs } = useAppState()
  const set = (p: Partial<Preferences>) => update((s) => ({ ...s, prefs: { ...s.prefs, ...p } }))
  const toggle = (cc: string) => set({ countries: prefs.countries.includes(cc) ? prefs.countries.filter((c) => c !== cc) : [...prefs.countries, cc] })
  const name = (cc: string) => countryLabel(cc, intl)
  const byName = (a: string, b: string) => name(a).localeCompare(name(b), intl)
  // The Swiss site leads with Switzerland and its neighbours.
  const withData = Object.keys(COUNTRIES)
    .filter((cc) => COUNTRIES[cc].programmeData)
    .sort((a, b) => (home ? Number(b === home) - Number(a === home) : 0) || byName(a, b))
  const others = Object.keys(COUNTRIES)
    .filter((cc) => !COUNTRIES[cc].programmeData)
    .sort(byName)
  const origins = site === 'ch' ? (['ch', 'eu', 'uk', 'us', 'other'] as const) : ORIGINS
  // Country names and amounts come from Intl, which differs slightly between Node and browsers;
  // the saved preferences only exist in the browser anyway.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="card animate-soft h-[26rem]" aria-busy="true" />

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <div className="card grid content-start gap-5 p-6">
        <Field label={t.prefs.level}>
          <Segmented
            value={prefs.level}
            options={(['bachelor', 'master', 'any'] as const).map((l) => [l, t.prefs.levels[l]])}
            onChange={(level) => set({ level: level as Preferences['level'] })}
          />
        </Field>
        <Field label={t.prefs.studying} hint={t.prefs.studyingHint}>
          <StudyingControl />
        </Field>
        <Field label={t.prefs.origin} hint={t.prefs.originHint}>
          <select value={prefs.origin} onChange={(e) => set({ origin: e.target.value as Preferences['origin'] })} className="input">
            {origins.map((v) => (
              <option key={v} value={v}>
                {t.prefs.origins[v]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.prefs.maxFee}>
          <select value={prefs.maxTuitionEur} onChange={(e) => set({ maxTuitionEur: Number(e.target.value) })} className="input">
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b === 0 ? t.prefs.noLimit : fmtMoney(b, 'EUR', intl)}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-3 font-medium">
          <input type="checkbox" checked={prefs.englishOnly} onChange={(e) => set({ englishOnly: e.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />
          {t.prefs.english}
        </label>
      </div>

      <div className="card p-6">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-xl">{t.prefs.where}</span>
          <button type="button" className="text-sm font-semibold text-muted hover:text-ink" onClick={() => set({ countries: [] })}>
            {prefs.countries.length ? t.prefs.clear(prefs.countries.length) : t.prefs.anywhere}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {REGION_GROUPS.map((g) => {
            const all = g.countries.every((c) => prefs.countries.includes(c))
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={all}
                onClick={() => set({ countries: all ? prefs.countries.filter((c) => !g.countries.includes(c)) : [...new Set([...prefs.countries, ...g.countries])] })}
                className={`chip ${all ? 'on-color bg-yellow' : 'hover:bg-surface-2'}`}
              >
                {t.prefs.regions[g.id as keyof typeof t.prefs.regions] ?? g.label}
              </button>
            )
          })}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-wider text-muted">{t.prefs.withData}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {withData.map((cc) => (
            <Chip key={cc} on={prefs.countries.includes(cc)} onClick={() => toggle(cc)}>
              {flag(cc)} {name(cc)}
            </Chip>
          ))}
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-wider text-muted">{t.prefs.withoutData}</p>
        <div className="mt-2 flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
          {others.map((cc) => (
            <Chip key={cc} on={prefs.countries.includes(cc)} onClick={() => toggle(cc)}>
              {flag(cc)} {name(cc)}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A degree already under way and since when: its coursework then hardly counts as interest. */
export function StudyingControl() {
  const { t, locale } = useSite()
  const { prefs } = useAppState()
  const studying = prefs.studying
  const set = (v: Preferences['studying']) => update((s) => ({ ...s, prefs: { ...s.prefs, studying: v } }))
  const fields = [...FIELDS].sort((a, b) => fieldName(a.id, locale).localeCompare(fieldName(b.id, locale), locale))
  const year = new Date().getFullYear()
  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label={t.prefs.studying}
        value={studying?.field ?? ''}
        onChange={(e) => set(e.target.value ? { field: e.target.value, since: studying?.since } : undefined)}
        className="input min-w-0 flex-1"
      >
        <option value="">{t.prefs.notStudying}</option>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {fieldName(f.id, locale)}
          </option>
        ))}
      </select>
      {studying && (
        <select
          aria-label={t.prefs.since}
          value={studying.since ?? ''}
          onChange={(e) => set({ field: studying.field, since: e.target.value ? Number(e.target.value) : undefined })}
          className="input w-auto"
        >
          <option value="">{t.prefs.sinceUnknown}</option>
          {Array.from({ length: 13 }, (_, i) => year - i).map((y) => (
            <option key={y} value={y}>
              {t.prefs.sinceYear(y)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-bold">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
    </div>
  )
}

function Segmented({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-full border-2 border-line bg-surface-2 p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${value === v ? 'bg-accent text-accent-ink' : 'text-muted hover:text-ink'}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`chip transition ${on ? 'bg-accent text-accent-ink' : 'hover:bg-surface-2'}`}>
      {children}
    </button>
  )
}
