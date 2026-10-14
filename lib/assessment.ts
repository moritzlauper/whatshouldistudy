import { ASSESSMENT_VERSION } from './engine/assessment-version.ts'
import { BIG5_ITEMS, INTEREST_LIST, RIASEC_ITEMS, big5Means, careless, isLikert, profileShape, scoreRiasec } from './engine/questionnaire.ts'
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
      score: '(mean of valid answers - 1) / 4; at least 2 of 4 per type; attention item excluded',
      sessionMinimum: 'all 24 interest items; attention item is not part of any scale',
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
      instruction: q.hints.subjects, enjoymentLabels: q.enjoyScale, selfRatedStrengthLabels: q.goodScale,
      items: SUBJECT_KEYS.map(id => ({ id, text: subjectLabel(id, locale) })),
      interpretation: 'grade is a legacy field name for self-rated strength, not a recorded school grade',
    },
    values: { instruction: q.hints.values, labels: q.valueScale, items: VALUE_KEYS.map(id => ({ id, text: valueLabel(id, locale) })), interpretation: 'Stated preferences, not a validated latent scale' },
  }
}

/** Only known items and valid scale responses may enter a local export. */
export function cleanAnswers(input: QuestionnaireAnswers): QuestionnaireAnswers {
  const pick = (keys: string[], values: Record<string, number> = {}) =>
    Object.fromEntries(keys.filter(k => isLikert(values[k])).map(k => [k, values[k]]))
  return {
    riasec: pick(INTEREST_LIST.map(i => i.id), input.riasec),
    big5: pick(BIG5_ITEMS.map(i => i.id), input.big5),
    subjects: Object.fromEntries(SUBJECT_KEYS.flatMap(k => {
      const valid = pick(['enjoy', 'grade'], input.subjects?.[k])
      return Object.keys(valid).length ? [[k, valid]] : []
    })),
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
    values: answers.values,
    flags: { flat: profileShape(interests).flat, responsePattern: careless(answers) },
  }
}

/** Explicit download, not a research upload or consent record. */
export function sessionExport(input: QuestionnaireAnswers, locale: Locale) {
  const answers = cleanAnswers(input)
  return { schema: 'wsis-local-session-v1', purpose: 'personal-copy-not-research-enrolment', locale, definition: instrumentDefinition(locale), answers, profile: sessionProfile(answers) }
}
