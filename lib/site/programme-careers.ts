import { fieldCareers } from './labels.ts'
import type { Locale } from './config.ts'

/** Careers that need a university degree of their own in Switzerland: left out on the pages of universities of applied sciences. */
const UNIVERSITY_ONLY = new Set([
  'Psychotherapeut:in', 'Klinische Psychologie', 'Schulpsychologie', 'Clinical psychologist', 'Psychotherapist', 'School psychologist',
  'Psychologue clinicien', 'Psychothérapeute', 'Psychologue scolaire', 'Psicologo clinico', 'Psicoterapeuta', 'Psicologo scolastico',
  'Anwält:in', 'Richter:in', 'Staatsanwält:in', 'Lawyer', 'Judge', 'Prosecutor', 'Avocat', 'Juge', 'Procureur', 'Avvocato', 'Giudice', 'Procuratore',
])

/** Up to five careers from all of a programme's fields, taken in turn, so a second field is not left out. */
export function programmeCareers(fields: string[], locale: Locale, appliedSciences: boolean): string[] {
  const lists = fields.map((f) => fieldCareers(f, locale).filter((c) => !(appliedSciences && UNIVERSITY_ONLY.has(c))))
  const out: string[] = []
  for (let i = 0; out.length < 5 && lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i] && !out.includes(l[i]) && out.length < 5) out.push(l[i])
  return out
}
