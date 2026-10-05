'use client'

import { useState } from 'react'
import { update, useAppState } from '@/lib/store.ts'
import { BIG5_ITEMS, LIKERT_ACCURACY, LIKERT_INTEREST, RIASEC_ITEMS } from '@/lib/engine/questionnaire.ts'
import type { LikertItem } from '@/lib/engine/questionnaire.ts'
import { SUBJECT_KEYS, SUBJECT_LABELS, VALUE_KEYS, VALUE_LABELS } from '@/lib/taxonomy/fields.ts'
import type { SubjectKey } from '@/lib/taxonomy/fields.ts'

const TABS = [
  { id: 'interests', label: 'Interests', hint: 'How much would you enjoy…' },
  { id: 'personality', label: 'Personality', hint: 'How accurately does this describe you? “I …”' },
  { id: 'subjects', label: 'School subjects', hint: 'How much do you enjoy each subject, and how good are you at it?' },
  { id: 'values', label: 'What matters', hint: 'How important is this to you in a future job?' },
] as const

type Tab = (typeof TABS)[number]['id']

export function Questionnaire() {
  const state = useAppState()
  const [tab, setTab] = useState<Tab>('interests')
  const a = state.answers

  const count: Record<Tab, [number, number]> = {
    interests: [Object.keys(a.riasec ?? {}).length, RIASEC_ITEMS.length],
    personality: [Object.keys(a.big5 ?? {}).length, BIG5_ITEMS.length],
    subjects: [Object.values(a.subjects ?? {}).filter((s) => s?.enjoy || s?.grade).length, SUBJECT_KEYS.length],
    values: [Object.keys(a.values ?? {}).length, VALUE_KEYS.length],
  }

  const setLikert = (group: 'riasec' | 'big5', id: string, v: number) =>
    update((s) => ({ ...s, answers: { ...s.answers, [group]: { ...(s.answers[group] ?? {}), [id]: v } } }))

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="flex gap-1 overflow-x-auto border-b border-line p-2" role="tablist">
        {TABS.map((t) => {
          const [done, total] = count[t.id]
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm transition ${tab === t.id ? 'bg-ink text-bg' : 'text-muted hover:bg-surface-2'}`}
            >
              {t.label}
              <span className={`ml-2 text-xs ${tab === t.id ? 'opacity-70' : ''}`}>
                {done}/{total}
              </span>
            </button>
          )
        })}
      </div>
      <div className="p-4 sm:p-6">
        <p className="mb-4 text-sm text-muted">{TABS.find((t) => t.id === tab)!.hint}</p>
        {tab === 'interests' && <LikertList items={RIASEC_ITEMS} values={a.riasec ?? {}} labels={LIKERT_INTEREST} onChange={(id, v) => setLikert('riasec', id, v)} />}
        {tab === 'personality' && (
          <>
            <LikertList items={BIG5_ITEMS} values={a.big5 ?? {}} labels={LIKERT_ACCURACY} onChange={(id, v) => setLikert('big5', id, v)} />
            <p className="mt-4 text-xs text-muted">Mini-IPIP (Donnellan et al., 2006), public-domain items from the International Personality Item Pool.</p>
          </>
        )}
        {tab === 'subjects' && <Subjects />}
        {tab === 'values' && <Values />}
        <div className="mt-6 flex justify-end">
          {tab !== 'values' && (
            <button
              type="button"
              onClick={() => setTab(TABS[TABS.findIndex((t) => t.id === tab) + 1].id)}
              className="rounded-full border border-line px-5 py-2 text-sm hover:border-ink/40"
            >
              Next: {TABS[TABS.findIndex((t) => t.id === tab) + 1].label} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Scale({ value, onChange, labels, name }: { value?: number; onChange: (v: number) => void; labels: string[]; name: string }) {
  return (
    <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={name}>
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          title={labels[v - 1]}
          aria-label={labels[v - 1]}
          onClick={() => onChange(v)}
          className={`h-9 w-9 rounded-full border text-xs font-medium transition sm:h-10 sm:w-10 ${
            value === v ? 'border-accent bg-accent text-accent-ink' : 'border-line hover:border-accent/60'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

function LikertList({
  items,
  values,
  labels,
  onChange,
}: {
  items: LikertItem[]
  values: Record<string, number>
  labels: string[]
  onChange: (id: string, v: number) => void
}) {
  return (
    <>
      <div className="mb-2 hidden justify-end gap-6 text-xs text-muted sm:flex">
        <span>1 = {labels[0]}</span>
        <span>5 = {labels[4]}</span>
      </div>
      <ul className="divide-y divide-line">
        {items.map((it) => (
          <li key={it.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <span className={values[it.id] ? '' : 'text-ink'}>{it.text}</span>
            <Scale value={values[it.id]} onChange={(v) => onChange(it.id, v)} labels={labels} name={it.text} />
          </li>
        ))}
      </ul>
    </>
  )
}

function Subjects() {
  const { answers } = useAppState()
  const set = (k: SubjectKey, part: 'enjoy' | 'grade', v: number) =>
    update((s) => ({
      ...s,
      answers: { ...s.answers, subjects: { ...(s.answers.subjects ?? {}), [k]: { ...(s.answers.subjects?.[k] ?? {}), [part]: v } } },
    }))
  return (
    <div>
      <div className="mb-2 hidden grid-cols-[1fr_auto_auto] gap-6 text-xs text-muted sm:grid">
        <span />
        <span className="w-[13.5rem] text-center">Enjoy (1 = not at all)</span>
        <span className="w-[13.5rem] text-center">Good at (1 = weak)</span>
      </div>
      <ul className="divide-y divide-line">
        {SUBJECT_KEYS.map((k) => (
          <li key={k} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
            <span>{SUBJECT_LABELS[k]}</span>
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs text-muted sm:hidden">Enjoy</span>
              <Scale value={answers.subjects?.[k]?.enjoy} onChange={(v) => set(k, 'enjoy', v)} labels={['Not at all', 'A little', 'Somewhat', 'A lot', 'Love it']} name={`Enjoy ${SUBJECT_LABELS[k]}`} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs text-muted sm:hidden">Good at</span>
              <Scale value={answers.subjects?.[k]?.grade} onChange={(v) => set(k, 'grade', v)} labels={['Weak', 'Below average', 'Average', 'Good', 'Excellent']} name={`Good at ${SUBJECT_LABELS[k]}`} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Values() {
  const { answers } = useAppState()
  return (
    <ul className="divide-y divide-line">
      {VALUE_KEYS.map((k) => (
        <li key={k} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{VALUE_LABELS[k]}</span>
          <Scale
            value={answers.values?.[k]}
            onChange={(v) => update((s) => ({ ...s, answers: { ...s.answers, values: { ...(s.answers.values ?? {}), [k]: v } } }))}
            labels={['Unimportant', 'Slightly', 'Moderately', 'Very', 'Essential']}
            name={VALUE_LABELS[k]}
          />
        </li>
      ))}
    </ul>
  )
}
