'use client'

import { update, useAppState } from '@/lib/store.ts'
import { COUNTRIES, REGION_GROUPS, flag } from '@/lib/countries.ts'
import type { Preferences } from '@/lib/engine/types.ts'

const ORIGINS: Array<[Preferences['origin'], string]> = [
  ['eu', 'EU / EEA'],
  ['ch', 'Switzerland'],
  ['uk', 'United Kingdom'],
  ['us', 'United States'],
  ['other', 'Elsewhere'],
]

const BUDGETS = [0, 500, 3000, 6000, 12000, 25000, 45000]

export function PrefsForm() {
  const { prefs } = useAppState()
  const set = (p: Partial<Preferences>) => update((s) => ({ ...s, prefs: { ...s.prefs, ...p } }))
  const toggle = (cc: string) =>
    set({ countries: prefs.countries.includes(cc) ? prefs.countries.filter((c) => c !== cc) : [...prefs.countries, cc] })
  const withData = Object.entries(COUNTRIES).filter(([, c]) => c.programmeData)
  const others = Object.entries(COUNTRIES)
    .filter(([, c]) => !c.programmeData)
    .sort((a, b) => a[1].name.localeCompare(b[1].name))

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-6">
        <Field label="Level">
          <Segmented
            value={prefs.level}
            options={[
              ['bachelor', "Bachelor's"],
              ['master', "Master's"],
              ['any', 'Both'],
            ]}
            onChange={(level) => set({ level: level as Preferences['level'] })}
          />
        </Field>
        <Field label="Your citizenship" hint="Decides which tuition fee applies.">
          <select
            value={prefs.origin}
            onChange={(e) => set({ origin: e.target.value as Preferences['origin'] })}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2"
          >
            {ORIGINS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Maximum tuition per year">
          <select
            value={prefs.maxTuitionEur}
            onChange={(e) => set({ maxTuitionEur: Number(e.target.value) })}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2"
          >
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b === 0 ? 'No limit' : `€${b.toLocaleString('en')}`}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={prefs.englishOnly} onChange={(e) => set({ englishOnly: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
          Only programmes taught in English
        </label>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">Where would you study?</span>
          <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => set({ countries: [] })}>
            {prefs.countries.length ? `Clear (${prefs.countries.length})` : 'Anywhere'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {REGION_GROUPS.map((g) => {
            const all = g.countries.every((c) => prefs.countries.includes(c))
            return (
              <button
                key={g.id}
                type="button"
                onClick={() =>
                  set({
                    countries: all ? prefs.countries.filter((c) => !g.countries.includes(c)) : [...new Set([...prefs.countries, ...g.countries])],
                  })
                }
                className={`rounded-full border px-3 py-1 text-xs ${all ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:border-ink/40'}`}
              >
                {g.label}
              </button>
            )
          })}
        </div>
        <p className="mt-5 text-xs uppercase tracking-wider text-muted">Every programme listed</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {withData.map(([cc, c]) => (
            <Chip key={cc} on={prefs.countries.includes(cc)} onClick={() => toggle(cc)}>
              {flag(cc)} {c.name}
            </Chip>
          ))}
        </div>
        <p className="mt-5 text-xs uppercase tracking-wider text-muted">Strongest universities + full directory</p>
        <div className="mt-2 flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
          {others.map(([cc, c]) => (
            <Chip key={cc} on={prefs.countries.includes(cc)} onClick={() => toggle(cc)}>
              {flag(cc)} {c.name}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  )
}

function Segmented({ value, options, onChange }: { value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-lg px-4 py-1.5 text-sm ${value === v ? 'bg-surface font-medium shadow-sm' : 'text-muted'}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1 text-sm transition ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line hover:border-ink/40'}`}
    >
      {children}
    </button>
  )
}
