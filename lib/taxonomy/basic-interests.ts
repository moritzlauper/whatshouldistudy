import type { RiasecKey, SubjectKey } from './fields.ts'

/**
 * Basic interests: homogeneous groups of activities below the six broad
 * RIASEC types (Su et al., 2019). Two kinds are asked. Areas a school leaver
 * knows as a school subject (maths, sciences, languages, history, economics,
 * computing, the arts, sport) are asked as the subject: it is quicker, and
 * young people judge a subject they have had for years better than an
 * activity they have never done. The other areas are asked with three
 * activities each. RIASEC is computed from both as a summary.
 *
 * Twelve activity scales are CABIN-NET (Chu et al., 2025), a public-domain
 * form, with its items. Three more from the full CABIN model (agriculture,
 * protective service, media) use items of our own, as the rights to the
 * CABIN items for commercial use are not cleared. CABIN-NET's scales for
 * transportation, customer service and office work are left out because they
 * lead almost only to jobs without a degree.
 *
 * `knowledge` names O*NET knowledge areas (O*NET 30.0 element names); a
 * field's level on a basic interest or subject is the mean importance of
 * these areas for the occupations the field leads to. Some links take a
 * second area so that they mean what their items ask (checked by running
 * synthetic profiles through the ranking): agriculture adds Biology, as cooks
 * need food production too; protective service adds Law and Government, as
 * pilots need public safety too; design adds Fine Arts, as O*NET's Design is
 * about technical plans, the items about artistic design.
 */
export interface BasicInterest {
  key: string
  /** The RIASEC type the basic interest is organised under (Chu et al., 2025, Table 1). */
  riasec: RiasecKey
  knowledge: string[]
  source: 'cabin-net' | 'own'
}

export const BASIC_INTERESTS = [
  { key: 'mechanics', riasec: 'R', knowledge: ['Mechanical'], source: 'cabin-net' },
  { key: 'construction', riasec: 'R', knowledge: ['Building and Construction'], source: 'cabin-net' },
  { key: 'engineering', riasec: 'R', knowledge: ['Engineering and Technology'], source: 'cabin-net' },
  { key: 'agriculture', riasec: 'R', knowledge: ['Food Production', 'Biology'], source: 'own' },
  { key: 'protective', riasec: 'R', knowledge: ['Public Safety and Security', 'Law and Government'], source: 'own' },
  { key: 'medicalScience', riasec: 'I', knowledge: ['Medicine and Dentistry'], source: 'cabin-net' },
  { key: 'socialScience', riasec: 'I', knowledge: ['Psychology', 'Sociology and Anthropology'], source: 'cabin-net' },
  { key: 'design', riasec: 'A', knowledge: ['Design', 'Fine Arts'], source: 'cabin-net' },
  { key: 'media', riasec: 'A', knowledge: ['Communications and Media'], source: 'own' },
  { key: 'teaching', riasec: 'S', knowledge: ['Education and Training'], source: 'cabin-net' },
  { key: 'counseling', riasec: 'S', knowledge: ['Therapy and Counseling'], source: 'cabin-net' },
  { key: 'management', riasec: 'E', knowledge: ['Administration and Management'], source: 'cabin-net' },
  { key: 'sales', riasec: 'E', knowledge: ['Sales and Marketing'], source: 'cabin-net' },
  { key: 'law', riasec: 'E', knowledge: ['Law and Government'], source: 'cabin-net' },
  { key: 'finance', riasec: 'C', knowledge: ['Economics and Accounting'], source: 'cabin-net' },
] as const satisfies readonly BasicInterest[]

export type BasicKey = (typeof BASIC_INTERESTS)[number]['key']
export const BASIC_KEYS = BASIC_INTERESTS.map((b) => b.key) as BasicKey[]
export type BasicProfile = Record<BasicKey, number>



/**
 * The O*NET knowledge areas behind each school subject. Visual arts, music and
 * sport have none that tells them apart (arts and music share Fine Arts,
 * sport has none); their field levels are the hand-set subject demands of
 * fields.ts.
 */
export const SUBJECT_KNOWLEDGE: Partial<Record<SubjectKey, string[]>> = {
  math: ['Mathematics'],
  phys: ['Physics'],
  chem: ['Chemistry'],
  bio: ['Biology'],
  cs: ['Computers and Electronics'],
  lang: ['English Language'],
  forlang: ['Foreign Language'],
  hist: ['History and Archeology'],
  geo: ['Geography'],
  econ: ['Economics and Accounting', 'Law and Government'],
  social: ['Psychology', 'Philosophy and Theology', 'Sociology and Anthropology'],
}

/** The RIASEC type each school subject counts towards in the summary. */
export const SUBJECT_RIASEC: Record<SubjectKey, RiasecKey> = {
  math: 'I', phys: 'I', chem: 'I', bio: 'I', geo: 'I', hist: 'I', social: 'S',
  cs: 'C', econ: 'E', lang: 'A', forlang: 'A', art: 'A', music: 'A', sport: 'R',
}

/** O*NET knowledge areas the basic interests and subjects are matched against. */
export const KNOWLEDGE_AREAS = [...new Set([...BASIC_INTERESTS.flatMap((b) => b.knowledge as readonly string[]), ...Object.values(SUBJECT_KNOWLEDGE).flat()])].sort()
