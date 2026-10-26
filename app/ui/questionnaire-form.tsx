'use client'

import { useRef, useState } from 'react'
import type { QuestionnaireAnswers } from '@/lib/engine/types.ts'
import { instrumentText } from '@/lib/site/assessment-text.ts'
import { BIG5_ITEMS, INTEREST_LIST, big5Answered, isLikert } from '@/lib/engine/questionnaire.ts'
import type { LikertItem } from '@/lib/engine/questionnaire.ts'
import { SUBJECT_KEYS, VALUE_KEYS } from '@/lib/taxonomy/fields.ts'
import type { SubjectKey } from '@/lib/taxonomy/fields.ts'
import { subjectLabel, valueLabel } from '@/lib/site/labels.ts'
import { useSite } from './site-context.tsx'

const TABS = ['interests', 'personality', 'subjects', 'values'] as const
type Tab = (typeof TABS)[number]
const TAB_COLOR: Record<Tab, string> = { interests: 'var(--pink)', personality: 'var(--sky)', subjects: 'var(--lime)', values: 'var(--yellow)' }

export function QuestionnaireForm({ answers: a, onChange }: { answers: QuestionnaireAnswers; onChange: (answers: QuestionnaireAnswers) => void }) {
  const { t, locale } = useSite()
  const info = instrumentText(locale)
  const [tab, setTab] = useState<Tab>('interests')
  const card = useRef<HTMLDivElement>(null)
  // A new part starts at its first question: on a phone the button to the next part sits far down the page.
  // 80 px: the top of the card is hidden under the sticky header (64 px).
  const go = (id: Tab) => {
    setTab(id)
    const top = card.current?.getBoundingClientRect().top
    if (top !== undefined && top < 80) card.current!.scrollIntoView({ block: 'start' })
  }

  const count: Record<Tab, [number, number]> = {
    interests: [INTEREST_LIST.filter((i) => isLikert(a.riasec?.[i.id])).length, INTEREST_LIST.length],
    personality: [big5Answered(a), BIG5_ITEMS.length],
    subjects: [Object.values(a.subjects ?? {}).filter((s) => s?.enjoy || s?.grade).length, SUBJECT_KEYS.length],
    values: [Object.keys(a.values ?? {}).length, VALUE_KEYS.length],
  }

  const setLikert = (group: 'riasec' | 'big5', id: string, v: number) =>
    onChange({ ...a, [group]: { ...(a[group] ?? {}), [id]: v } })

  // German item texts where the site speaks German; English ones live with the scoring.
  const localise = (items: LikertItem[], texts: Record<string, string> | null) => (texts ? items.map((it) => ({ ...it, text: texts[it.id] ?? it.text })) : items)
  const next = TABS[TABS.indexOf(tab) + 1]

  return (
    <div ref={card} className="card scroll-mt-24 overflow-hidden">
      {/* Two by two on a phone: in one scrolling row the active part could sit out of sight. */}
      <div className="grid grid-cols-2 gap-2 border-b-2 border-line bg-surface-2 p-3 sm:flex sm:overflow-x-auto" role="tablist">
        {TABS.map((id) => {
          const [done, total] = count[id]
          const on = tab === id
          return (
            <button
              key={id}
              role="tab"
              aria-selected={on}
              onClick={() => go(id)}
              className={`rounded-full border-2 px-2 py-2 text-sm font-bold transition sm:shrink-0 sm:px-4 ${on ? 'on-color border-line' : 'border-transparent text-muted hover:border-line'}`}
              style={on ? { background: TAB_COLOR[id], boxShadow: '2px 2px 0 var(--shadow)' } : undefined}
            >
              {t.q.tabs[id]}
              <span className={`ml-2 rounded-full px-1.5 text-xs ${done === total ? 'bg-good text-white' : on ? 'bg-white/60' : 'bg-surface'}`}>
                {done}/{total}
              </span>
            </button>
          )
        })}
      </div>
      <div className="p-4 sm:p-7">
        <p className="mb-4 font-semibold text-muted">{t.q.hints[tab]}</p>
        <p className="mb-4 text-sm text-muted">{info[tab]}</p>
        {tab === 'interests' && (
          <LikertList items={localise(INTEREST_LIST, t.q.riasec)} values={a.riasec ?? {}} labels={t.q.likertInterest} onChange={(id, v) => setLikert('riasec', id, v)} color={TAB_COLOR.interests} />
        )}
        {tab === 'personality' && <>
          <p className="mb-2 font-semibold">{t.q.personalityOptional}</p>
          <p className="mb-4 text-sm text-muted">{t.q.personalityNote}</p>
          <LikertList items={localise(BIG5_ITEMS, t.q.big5)} values={a.big5 ?? {}} labels={t.q.likertAccuracy} onChange={(id, v) => setLikert('big5', id, v)} color={TAB_COLOR.personality} />
          <p className="mt-4 text-xs text-muted">{t.q.ipipNote}</p>
        </>}
        {tab === 'subjects' && <Subjects answers={a} onChange={onChange} />}
        {tab === 'values' && <Values answers={a} onChange={onChange} />}
        {next && (
          <div className="mt-7 flex justify-end">
            <button type="button" onClick={() => go(next)} className="btn btn-ghost btn-sm">
              {t.q.next(t.q.tabs[next])}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * On a phone the scale spans the row, for larger targets, and with `ends` names
 * its two ends below: there is no hover there to show a button's title, and the
 * legend above the list scrolls away.
 */
function Scale({ value, onChange, labels, name, color = 'var(--accent)', ends = false }: { value?: number; onChange: (v: number) => void; labels: string[]; name: string; color?: string; ends?: boolean }) {
  return (
    <div className="w-full max-w-sm sm:w-auto sm:shrink-0">
      <div className="flex gap-1.5" role="radiogroup" aria-label={name}>
        {[1, 2, 3, 4, 5].map((v) => {
          const on = value === v
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              title={labels[v - 1]}
              aria-label={labels[v - 1]}
              onClick={() => onChange(v)}
              className={`h-11 flex-1 rounded-xl border-2 text-sm font-extrabold transition sm:h-10 sm:w-10 sm:flex-none ${on ? 'on-color -translate-y-0.5 border-line' : 'border-soft-line bg-surface hover:border-line'}`}
              style={on ? { background: color, boxShadow: '2px 2px 0 var(--shadow)' } : undefined}
            >
              {v}
            </button>
          )
        })}
      </div>
      {ends && (
        <div className="mt-1 flex justify-between gap-3 text-xs text-muted sm:hidden" aria-hidden="true">
          <span>{labels[0]}</span>
          <span className="text-right">{labels[4]}</span>
        </div>
      )}
    </div>
  )
}

function LikertList({ items, values, labels, onChange, color }: { items: LikertItem[]; values: Record<string, number>; labels: string[]; onChange: (id: string, v: number) => void; color: string }) {
  return (
    <>
      <div className="mb-2 hidden justify-end gap-6 text-xs font-semibold text-muted sm:flex">
        <span>1 = {labels[0]}</span>
        <span>5 = {labels[4]}</span>
      </div>
      <ul className="divide-y-2 divide-soft-line">
        {items.map((it) => (
          <li key={it.id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            {/* Only the colour changes once answered: a tick or bolder text would rewrap the line and shift the list. */}
            <span className={`font-medium ${values[it.id] ? 'text-muted' : ''}`}>
              {it.text}
            </span>
            <Scale value={values[it.id]} onChange={(v) => onChange(it.id, v)} labels={labels} name={it.text} color={color} ends />
          </li>
        ))}
      </ul>
    </>
  )
}

function Subjects({ answers, onChange }: { answers: QuestionnaireAnswers; onChange: (answers: QuestionnaireAnswers) => void }) {
  const { t, locale } = useSite()
  const set = (k: SubjectKey, part: 'enjoy' | 'grade', v: number) =>
    onChange({ ...answers, subjects: { ...(answers.subjects ?? {}), [k]: { ...(answers.subjects?.[k] ?? {}), [part]: v } } })
  return (
    <div>
      <div className="mb-2 hidden grid-cols-[1fr_auto_auto] gap-6 text-xs font-semibold text-muted sm:grid">
        <span />
        <span className="w-[14.5rem] text-center">{t.q.enjoyHead}</span>
        <span className="w-[14.5rem] text-center">{t.q.goodHead}</span>
      </div>
      <p className="mb-2 text-xs font-semibold text-muted sm:hidden">
        {t.q.enjoyHead} · {t.q.goodHead}
      </p>
      <ul className="divide-y-2 divide-soft-line">
        {SUBJECT_KEYS.map((k) => {
          const name = subjectLabel(k, locale)
          return (
            <li key={k} className="grid gap-2 py-3.5 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
              <span className="font-medium">{name}</span>
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted sm:hidden">{t.q.enjoy}</span>
                <Scale value={answers.subjects?.[k]?.enjoy} onChange={(v) => set(k, 'enjoy', v)} labels={t.q.enjoyScale} name={`${t.q.enjoy}: ${name}`} color="var(--lime)" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted sm:hidden">{t.q.goodAt}</span>
                <Scale value={answers.subjects?.[k]?.grade} onChange={(v) => set(k, 'grade', v)} labels={t.q.goodScale} name={`${t.q.goodAt}: ${name}`} color="var(--sky)" />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Values({ answers, onChange }: { answers: QuestionnaireAnswers; onChange: (answers: QuestionnaireAnswers) => void }) {
  const { t, locale } = useSite()
  return (
    <ul className="divide-y-2 divide-soft-line">
      {VALUE_KEYS.map((k) => (
        <li key={k} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium">{valueLabel(k, locale)}</span>
          <Scale
            value={answers.values?.[k]}
            onChange={(v) => onChange({ ...answers, values: { ...(answers.values ?? {}), [k]: v } })}
            labels={t.q.valueScale}
            name={valueLabel(k, locale)}
            color="var(--yellow)"
            ends
          />
        </li>
      ))}
    </ul>
  )
}
