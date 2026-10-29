import { ASSESSMENT_VERSION } from './engine/assessment-version.ts'
import { ATTENTION_ITEMS, BIG5_ITEMS, INTEREST_LIST, ITEMS_PER_TYPE, LONGSTRING, MIN_PER_TYPE, RIASEC_ITEMS, big5Means, careless, isLikert, profileShape, scoreRiasec } from './engine/questionnaire.ts'
import { GRADE_SCALES, cleanGrades } from './engine/grades.ts'
import type { QuestionnaireAnswers } from './engine/types.ts'
import { dict } from './site/dict.ts'
import type { Locale } from './site/config.ts'
import { subjectLabel, valueLabel } from './site/labels.ts'
import { SUBJECT_KEYS, VALUE_KEYS } from './taxonomy/fields.ts'

/** Exact displayed wording, instructions and scoring keys. Contains no participant data. */
export function instrumentDefinition(locale: Locale) {
  const { q } = dict(locale)
  return {
    version: ASSESSMENT_VERSION,
    locale,
    evidence: 'custom-interest-form-and-translations-not-validated',
    norms: null,
    interests: {
      instruction: q.hints.interests, labels: q.likertInterest,
      items: INTEREST_LIST.map(i => ({ ...i, text: q.riasec?.[i.id] ?? i.text })),
      score: `(mean of valid answers - 1) / 4; at least ${MIN_PER_TYPE} of ${ITEMS_PER_TYPE} per type; attention items excluded`,
      order: 'random per person (seeded shuffle); attention items after the first and second third',
      attention: { items: ATTENTION_ITEMS.map(i => ({ id: i.id, answer: i.answer })), longstring: LONGSTRING, effect: 'notice asking to review the answers; ranking unchanged' },
      sessionMinimum: `all ${RIASEC_ITEMS.length} interest items; attention items are not part of any scale`,
      provenance: 'Custom WSIS activity items based on RIASEC theory, not an AIST or O*NET test form',
    },
    personality: {
      instruction: q.hints.personality, labels: q.likertAccuracy,
      items: BIG5_ITEMS.map(i => ({ ...i, text: q.big5?.[i.id] ?? i.text })),
      score: 'Reverse: 6 - answer. Mean of 4 items per trait; all 20 valid answers required. No norms.',
      source: 'https://ipip.ori.org/MiniIPIPKey.htm',
      rights: 'https://ipip.ori.org/newPermission.htm',
      languageStatus: locale === 'en' ? 'Original English items; overall product not validated' : 'Own translation; not separately validated',
    },
    subjects: {
      instruction: q.hints.subjects, enjoymentLabels: q.enjoyScale,
      items: SUBJECT_KEYS.map(id => ({ id, text: subjectLabel(id, locale) })),
      interpretation: 'enjoyment only; profile correlation with the field\'s subject demands is part of interest fit',
    },
    grades: { scales: GRADE_SCALES, items: ['average', 'math'], interpretation: 'Recorded school grades as entered; shown as a feasibility note, never part of the ranking' },
    values: { instruction: q.hints.values, labels: q.valueScale, items: VALUE_KEYS.map(id => ({ id, text: valueLabel(id, locale) })), interpretation: 'Stated preferences used as a filter the person sets, not part of the fit and not a validated latent scale' },
  }
}

/** Only known items and valid scale responses may enter a local export. */
export function cleanAnswers(input: QuestionnaireAnswers): QuestionnaireAnswers {
  const pick = (keys: string[], values: Record<string, number> = {}) =>
    Object.fromEntries(keys.filter(k => isLikert(values[k])).map(k => [k, values[k]]))
  return {
    riasec: pick(INTEREST_LIST.map(i => i.id), input.riasec),
    big5: pick(BIG5_ITEMS.map(i => i.id), input.big5),
    ...(Number.isInteger(input.order) && input.order! > 0 ? { order: input.order } : {}),
    subjects: Object.fromEntries(SUBJECT_KEYS.flatMap(k => {
      const valid = pick(['enjoy'], input.subjects?.[k])
      return Object.keys(valid).length ? [[k, valid]] : []
    })),
    ...(cleanGrades(input.grades) ? { grades: cleanGrades(input.grades)! } : {}),
    values: pick([...VALUE_KEYS], input.values),
  }
}

export function sessionReady(answers: QuestionnaireAnswers): boolean {
  return RIASEC_ITEMS.every(i => isLikert(answers.riasec?.[i.id]))
}

/** Local descriptive result only: no imported sources, field ranking, token or paid programme data. */
export function sessionProfile(input: QuestionnaireAnswers) {
  const answers = cleanAnswers(input)
  if (!sessionReady(answers)) return null
  const interests = scoreRiasec(answers)!
  return {
    interestMeans: interests.map(v => v * 4 + 1),
    personalityMeans: big5Means(answers),
    subjects: answers.subjects,
    grades: answers.grades,
    values: answers.values,
    flags: { flat: profileShape(interests).flat, responsePattern: careless(answers) },
  }
}

/** Explicit download, not a research upload or consent record. */
export function sessionExport(input: QuestionnaireAnswers, locale: Locale) {
  const answers = cleanAnswers(input)
  return { schema: 'wsis-local-session-v1', purpose: 'personal-copy-not-research-enrolment', locale, definition: instrumentDefinition(locale), answers, profile: sessionProfile(answers) }
}
