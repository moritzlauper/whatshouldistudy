import { topicLabel } from './classifier.ts'
import type { FitReason } from './programme-fit.ts'
import { fieldName, riasecLabel, subjectLabel } from '../site/labels.ts'
import type { Locale } from '../site/config.ts'
import type { SubjectKey } from '../taxonomy/fields.ts'
import { FIELD_BY_ID } from '../taxonomy/fields.ts'

type ReasonTexts = { reasonRiasec: (names: string) => string; reasonSubjects: (names: string) => string; reasonTopics: (names: string) => string; reasonSpecialisations: (names: string) => string }

export function fitReasonText(r: FitReason, locale: Locale, a: ReasonTexts): string {
  if (r.kind === 'specialisations') return a.reasonSpecialisations(r.names.join(' · '))
  if (r.kind === 'topics') return a.reasonTopics(r.keys.map((key) => FIELD_BY_ID[key] ? fieldName(key, locale) : topicLabel(key)).join(' · '))
  if (r.kind === 'riasec') return a.reasonRiasec(r.types.map((k) => riasecLabel(k, locale).name).join(' · '))
  return a.reasonSubjects(r.subjects.map((s) => subjectLabel(s as SubjectKey, locale)).join(' · '))
}
