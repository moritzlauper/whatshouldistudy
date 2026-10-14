'use client'

import { update, useAppState } from '@/lib/store.ts'
import { QuestionnaireForm } from './questionnaire-form.tsx'

/** Normal product flow keeps answers on the device; the counselling session uses its own memory. */
export function Questionnaire() {
  const { answers } = useAppState()
  return <QuestionnaireForm answers={answers} onChange={next => update(s => ({ ...s, answers: next }))} />
}
