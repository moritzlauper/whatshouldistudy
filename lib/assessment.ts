import { ASSESSMENT_VERSION } from './engine/assessment-version.ts'
import { ASKED_SUBJECTS, ATTENTION_ITEMS, INTEREST_ITEMS, INTEREST_LIST, ITEMS_PER_SCALE, LONGSTRING, MIN_PER_SCALE, careless, isLikert, profileShape, riasecSummary, scoreBasic } from './engine/questionnaire.ts'
import { GRADE_SCALES, cleanGrades } from './engine/grades.ts'
import type { QuestionnaireAnswers } from './engine/types.ts'
import { dict } from './site/dict.ts'
import type { Locale } from './site/config.ts'
import { subjectLabel } from './site/labels.ts'
import { BASIC_INTERESTS, BASIC_KEYS } from './taxonomy/basic-interests.ts'

/** Exact displayed wording, instructions and scoring keys. Contains no participant data. */
export function instrumentDefinition(locale: Locale) {
  const { q } = dict(locale)
  return {
    version: ASSESSMENT_VERSION,
    locale,
    evidence: 'cabin-net-items-and-own-items-translations-not-validated',
    norms: null,
    interests: {
      instruction: q.hints.interests, labels: q.likertInterest,
      items: INTEREST_LIST.map(i => ({ ...i, text: q.items?.[i.id] ?? i.text })),
      scales: BASIC_INTERESTS.map(b => ({ key: b.key, riasec: b.riasec, onetKnowledge: b.knowledge, source: b.source })),
      score: `(mean of valid answers - 1) / 4 per basic interest; at least ${MIN_PER_SCALE} of ${ITEMS_PER_SCALE}; RIASEC = mean of its basic interests; attention items excluded`,
      order: 'random per person (seeded shuffle); attention items after the first and second third',
      attention: { items: ATTENTION_ITEMS.map(i => ({ id: i.id, answer: i.answer })), longstring: LONGSTRING, effect: 'notice asking to review the answers; ranking unchanged' },
      sessionMinimum: `all ${INTEREST_ITEMS.length} interest items; attention items are not part of any scale`,
      provenance: 'CABIN-NET items (Chu et al., 2025, public domain) for 17 basic interests; own items for six more; own translations',
    },
    subjects: {
      instruction: q.hints.subjects, enjoymentLabels: q.enjoyScale,
      items: ASKED_SUBJECTS.map(id => ({ id, text: subjectLabel(id, locale) })),
      interpretation: 'enjoyment of the subjects the basic interests cannot tell apart; extra dimensions of the interest-fit profile correlation',
    },
    grades: { scales: GRADE_SCALES, items: ['math'], answer: 'band: weak (below passing), sufficient (passing to halfway), strong (upper half)', interpretation: 'Shown as a feasibility note for maths-heavy fields, never part of the ranking' },
  }
}

/** Only known items and valid scale responses may enter a local export. */
export function cleanAnswers(input: QuestionnaireAnswers): QuestionnaireAnswers {
  const pick = (keys: string[], values: Record<string, number> = {}) =>
    Object.fromEntries(keys.filter(k => isLikert(values[k])).map(k => [k, values[k]]))
  const grades = cleanGrades(input.grades)
  return {
    interests: pick(INTEREST_LIST.map(i => i.id), input.interests),
    ...(Number.isInteger(input.order) && input.order! > 0 ? { order: input.order } : {}),
    subjects: Object.fromEntries(ASKED_SUBJECTS.flatMap(k => isLikert(input.subjects?.[k]?.enjoy) ? [[k, { enjoy: input.subjects![k]!.enjoy }]] : [])),
    ...(grades ? { grades } : {}),
  }
}

export function sessionReady(answers: QuestionnaireAnswers): boolean {
  return INTEREST_ITEMS.every(i => isLikert(answers.interests?.[i.id]))
}

/** Local descriptive result only: no imported sources, field ranking, token or paid programme data. */
export function sessionProfile(input: QuestionnaireAnswers) {
  const answers = cleanAnswers(input)
  if (!sessionReady(answers)) return null
  const basic = scoreBasic(answers)!
  return {
    interestMeans: riasecSummary(basic).map(v => v * 4 + 1),
    basicMeans: Object.fromEntries(BASIC_KEYS.map(k => [k, basic[k] * 4 + 1])),
    subjects: answers.subjects,
    grades: answers.grades,
    flags: { flat: profileShape(BASIC_KEYS.map(k => basic[k])).flat, responsePattern: careless(answers) },
  }
}

/** Explicit download, not a research upload or consent record. */
export function sessionExport(input: QuestionnaireAnswers, locale: Locale) {
  const answers = cleanAnswers(input)
  return { schema: 'wsis-local-session-v2', purpose: 'personal-copy-not-research-enrolment', locale, definition: instrumentDefinition(locale), answers, profile: sessionProfile(answers) }
}
