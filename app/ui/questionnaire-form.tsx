'use client'

import { useEffect, useRef, useState } from 'react'
import type { QuestionnaireAnswers } from '@/lib/engine/types.ts'
import { instrumentText } from '@/lib/site/assessment-text.ts'
import { bandText, fitText } from '@/lib/site/fit-text.ts'
import { ASKED_SUBJECTS, interestList, isLikert, newOrderSeed } from '@/lib/engine/questionnaire.ts'
import type { LikertItem } from '@/lib/engine/questionnaire.ts'
import { GRADE_BANDS, GRADE_SCALE_IDS, defaultGradeScale } from '@/lib/engine/grades.ts'
import type { GradeScaleId } from '@/lib/engine/grades.ts'
import { subjectLabel } from '@/lib/site/labels.ts'
import { useSite } from './site-context.tsx'

// Interests first, school subjects second: the interests are the core of the result; the subjects follow.
const TABS = ['interests', 'subjects'] as const
type Tab = (typeof TABS)[number]
const TAB_COLOR: Record<Tab, string> = { interests: 'var(--pink)', subjects: 'var(--lime)' }

export function QuestionnaireForm({ answers: a, onChange }: { answers: QuestionnaireAnswers; onChange: (answers: QuestionnaireAnswers) => void }) {
  const { t, locale } = useSite()
  const info = instrumentText(locale)
  const [tab, setTab] = useState<Tab>('interests')
  // Each person gets an item order of their own before the first answer.
  useEffect(() => {
    if (a.order === undefined) onChange({ ...a, order: newOrderSeed() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const interests = interestList(a.order)
  const card = useRef<HTMLDivElement>(null)
  // A new part starts at its first question: on a phone the button to the next part sits far down the page.
  // 80 px: the top of the card is hidden under the sticky header (64 px).
  const go = (id: Tab) => {
    setTab(id)
    const top = card.current?.getBoundingClientRect().top
    if (top !== undefined && top < 80) card.current!.scrollIntoView({ block: 'start' })
  }

  const count: Record<Tab, [number, number]> = {
    interests: [interests.filter((i) => isLikert(a.interests?.[i.id])).length, interests.length],
    subjects: [ASKED_SUBJECTS.filter((k) => isLikert(a.subjects?.[k]?.enjoy)).length + (a.grades ? 1 : 0), ASKED_SUBJECTS.length + 1],
  }

  // Item texts in the site's language; English ones live with the scoring.
  const localise = (items: LikertItem[], texts: Record<string, string> | null) => (texts ? items.map((it) => ({ ...it, text: texts[it.id] ?? it.text })) : items)
  const next = TABS[TABS.indexOf(tab) + 1]

  return (
    <div ref={card} className="card scroll-mt-24 overflow-hidden">
      <div className="flex gap-2 overflow-x-auto border-b-2 border-line bg-surface-2 p-3" role="tablist">
        {TABS.map((id) => {
          const [done, total] = count[id]
          const on = tab === id
          return (
            <button
              key={id}
              role="tab"
              aria-selected={on}
              onClick={() => go(id)}
              className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-bold transition ${on ? 'on-color border-line' : 'border-transparent text-muted hover:border-line'}`}
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
          <LikertList items={localise(interests, t.q.items)} values={a.interests ?? {}} labels={t.q.likertInterest} onChange={(id, v) => onChange({ ...a, interests: { ...(a.interests ?? {}), [id]: v } })} color={TAB_COLOR.interests} />
        )}
        {tab === 'subjects' && <>
          <Subjects answers={a} onChange={onChange} />
          <MathGrade answers={a} onChange={onChange} />
        </>}
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

/** The school subjects; those not taught are left empty. */
function Subjects({ answers, onChange }: { answers: QuestionnaireAnswers; onChange: (answers: QuestionnaireAnswers) => void }) {
  const { t, locale } = useSite()
  const set = (k: (typeof ASKED_SUBJECTS)[number], v: number) => onChange({ ...answers, subjects: { ...(answers.subjects ?? {}), [k]: { enjoy: v } } })
  return (
    <ul className="divide-y-2 divide-soft-line">
      {ASKED_SUBJECTS.map((k) => {
        const name = subjectLabel(k, locale)
        return (
          <li key={k} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <span className="font-medium">{name}</span>
            <Scale value={answers.subjects?.[k]?.enjoy} onChange={(v) => set(k, v)} labels={t.q.enjoyScale} name={`${t.q.enjoy}: ${name}`} color="var(--lime)" ends />
          </li>
        )
      })}
    </ul>
  )
}

/** The band of the last maths grade, on the scale the person knows; kept out of the ranking. */
function MathGrade({ answers, onChange }: { answers: QuestionnaireAnswers; onChange: (answers: QuestionnaireAnswers) => void }) {
  const { locale, site, intl } = useSite()
  const f = fitText(locale)
  const [scale, setScale] = useState<GradeScaleId>(answers.grades?.scale ?? defaultGradeScale(site))
  const chosen = answers.grades?.scale === scale ? answers.grades.math : undefined
  const option = (label: string, on: boolean, pick: () => void) => (
    <button key={label} type="button" role="radio" aria-checked={on} onClick={pick}
      className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${on ? 'on-color -translate-y-0.5 border-line bg-sky' : 'border-soft-line bg-surface hover:border-line'}`}>
      {label}
    </button>
  )
  return (
    <div className="mt-6 rounded-xl border-2 border-soft-line p-4">
      <div className="font-bold">{f.gradesTitle}</div>
      <p className="mt-1 text-sm text-muted">{f.gradesHint}</p>
      <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        {f.scale}
        {/* Another scale clears the band: it would mean something else there. */}
        <select value={scale} onChange={(e) => { setScale(e.target.value as GradeScaleId); onChange({ ...answers, grades: undefined }) }} className="input py-1">
          {GRADE_SCALE_IDS.map((id) => <option key={id} value={id}>{f.scales[id]}</option>)}
        </select>
      </label>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={f.gradesTitle}>
        {GRADE_BANDS.map((band) => option(`${f.bands[band]} (${bandText(band, scale, intl)})`, chosen === band, () => onChange({ ...answers, grades: { scale, math: band } })))}
        {option(f.unknown, !chosen, () => onChange({ ...answers, grades: undefined }))}
      </div>
    </div>
  )
}
