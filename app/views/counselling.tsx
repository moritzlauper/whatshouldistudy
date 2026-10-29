'use client'

import { useEffect, useState } from 'react'
import type { QuestionnaireAnswers } from '@/lib/engine/types.ts'
import { ASSESSMENT_VERSION } from '@/lib/engine/assessment-version.ts'
import { sessionExport, sessionProfile, sessionReady } from '@/lib/assessment.ts'
import { RIASEC_KEYS } from '@/lib/taxonomy/fields.ts'
import { BASIC_KEYS } from '@/lib/taxonomy/basic-interests.ts'
import { ASKED_SUBJECTS } from '@/lib/engine/questionnaire.ts'
import { basicLabel } from '@/lib/site/basic-labels.ts'
import { riasecLabel, subjectLabel } from '@/lib/site/labels.ts'
import { withBase } from '@/lib/site.ts'
import { instrumentText } from '@/lib/site/assessment-text.ts'
import { bandText, fitText } from '@/lib/site/fit-text.ts'
import { professionalText } from '@/lib/site/professional-text.ts'
import { QuestionnaireForm } from '../ui/questionnaire-form.tsx'
import { useSite } from '../ui/site-context.tsx'

/** No store, server requests, imports, personal AI or automatic research collection. */
export function CounsellingView() {
  const { locale, r, t, conf, intl } = useSite()
  const text = instrumentText(locale)
  const grade = fitText(locale)
  const info = professionalText(locale)
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({})
  const [stage, setStage] = useState<'intro' | 'answers' | 'profile' | 'ended'>('intro')
  const [session, setSession] = useState(0)
  const profile = stage === 'profile' ? sessionProfile(answers) : null
  const value = (n: number) => `${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 5`

  function discard() {
    setAnswers({})
    setSession(n => n + 1)
    setStage('ended')
  }

  // A browser back/forward-cache restore must not reopen the previous person's answers.
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) discard() }
    window.addEventListener('pageshow', restore)
    window.addEventListener('pagehide', discard)
    return () => {
      window.removeEventListener('pageshow', restore)
      window.removeEventListener('pagehide', discard)
    }
  }, [])

  function download() {
    const blob = new Blob([JSON.stringify(sessionExport(answers, locale), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wsis-session-${locale}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <article className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <header>
      <p className="font-bold text-accent">{conf.name}</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">{stage === 'profile' ? text.profile : text.title}</h1>
      <p className="mt-4 text-lg">{text.lead}</p>
      <p className="mt-3 text-sm text-muted">{info.notice} {info.institution}</p>
      <p className="mt-3 break-words text-xs text-muted">{ASSESSMENT_VERSION.interests} · {locale} · {ASSESSMENT_VERSION.description}</p>
    </header>
    <div className="card-sm my-6 bg-surface p-5 print:hidden">
      <p>{text.privacy}</p>
      <a className="mt-3 inline-block text-accent underline" href={withBase(r.professional)} target="_blank" rel="noreferrer">{info.link} ↗</a>
    </div>
    {(stage === 'intro' || stage === 'ended') && <div className="my-8">
      {stage === 'ended' && <p role="status" className="mb-4 font-semibold">{text.ended}</p>}
      <button className="btn btn-primary" onClick={() => setStage('answers')}>{text.start}</button>
    </div>}
    {stage === 'answers' && <section className="print:hidden">
      <QuestionnaireForm key={session} answers={answers} onChange={setAnswers} />
      <p id="session-requirement" className="mt-5 text-sm text-muted">{text.missing}</p>
      <button className="btn btn-primary mt-4 disabled:opacity-50" aria-describedby="session-requirement" disabled={!sessionReady(answers)} onClick={() => { setStage('profile'); window.scrollTo({ top: 0 }) }}>{text.result}</button>
    </section>}
    {profile && <section className="mt-7">
      <p>{text.scale}</p>
      {profile.flags.flat && <p className="mt-3 font-semibold">{text.flat}</p>}
      {profile.flags.responsePattern && <p className="mt-3 font-semibold">{text.attention}</p>}
      <h2 className="mt-6 font-display text-2xl">{t.q.tabs.interests}</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">{RIASEC_KEYS.map((key, i) => <div key={key} className="card-sm flex justify-between gap-4 p-4"><dt>{riasecLabel(key, locale).name}</dt><dd className="whitespace-nowrap font-bold">{value(profile.interestMeans[i])}</dd></div>)}</dl>
      <h3 className="mt-5 font-bold">{grade.basicTitle}</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">{BASIC_KEYS.map(key => <div key={key} className="card-sm flex justify-between gap-4 p-4"><dt>{basicLabel(key, locale)}</dt><dd className="whitespace-nowrap font-bold">{value(profile.basicMeans[key])}</dd></div>)}</dl>
      {!!Object.keys(profile.subjects ?? {}).length && <>
        <h2 className="mt-6 font-display text-2xl">{t.q.tabs.subjects}</h2><p className="mt-2 text-sm text-muted">{text.subjects}</p>
        <ul className="mt-3 space-y-2">{ASKED_SUBJECTS.filter(key => profile.subjects?.[key]).map(key => <li key={key}><strong>{subjectLabel(key, locale)}</strong>: {t.q.enjoyHead} {profile.subjects?.[key]?.enjoy ?? '—'} / 5</li>)}</ul>
      </>}
      {profile.grades && <>
        <h2 className="mt-6 font-display text-2xl">{grade.gradesCard}</h2><p className="mt-2 text-sm text-muted">{grade.gradesWhy}</p>
        <p className="mt-3">{grade.bands[profile.grades.math]} ({bandText(profile.grades.math, profile.grades.scale, intl)}, {grade.scales[profile.grades.scale]})</p>
      </>}
      <div className="mt-7 print:hidden">
        <p className="text-sm text-muted">{text.exportNote}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="btn btn-ghost" onClick={() => setStage('answers')}>{text.edit}</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>{text.print}</button>
          <button className="btn btn-ghost" onClick={download}>{text.save}</button>
        </div>
      </div>
    </section>}
    {(stage === 'answers' || stage === 'profile') && <button className="btn btn-primary mt-8 print:hidden" onClick={discard}>{text.end}</button>}
  </article>
}
