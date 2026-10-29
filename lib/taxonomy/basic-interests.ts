import type { RiasecKey } from './fields.ts'

/**
 * Basic interests: homogeneous groups of activities below the six broad
 * RIASEC types (Su et al., 2019). The person answers items per basic
 * interest; RIASEC is computed from them as a summary.
 *
 * Seventeen come from CABIN-NET (Chu et al., 2025), a public-domain 60-item
 * form with three items per basic interest, each linked to the O*NET
 * knowledge area it is matched against. Three CABIN-NET scales are left out
 * because they lead almost only to jobs without a degree and would lengthen
 * the form for little: transportation, customer service and office work.
 * CABIN-NET leaves out activities that many study fields rest on, so six
 * basic interests of the full CABIN model are measured with items of our own
 * (`own`), as the rights to the CABIN items for commercial use are not
 * cleared. The links of those six to O*NET knowledge follow Liu et al.
 * (2026, Appendix B).
 *
 * `knowledge` names O*NET knowledge areas (O*NET 30.0 element names); a
 * field's level on a basic interest is the mean importance of these areas for
 * the occupations the field leads to. Three links take a second area so that
 * they mean what their items ask (checked by running synthetic profiles
 * through the ranking): agriculture adds Biology, as cooks need food
 * production too; protective service adds Law and Government, as pilots and
 * air traffic controllers need public safety too; design adds Fine Arts, as
 * O*NET's Design is about technical plans, the items about artistic design.
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
  { key: 'physicalScience', riasec: 'I', knowledge: ['Chemistry', 'Physics', 'Geography'], source: 'cabin-net' },
  { key: 'lifeScience', riasec: 'I', knowledge: ['Biology'], source: 'own' },
  { key: 'medicalScience', riasec: 'I', knowledge: ['Medicine and Dentistry'], source: 'cabin-net' },
  { key: 'math', riasec: 'I', knowledge: ['Mathematics'], source: 'cabin-net' },
  { key: 'socialScience', riasec: 'I', knowledge: ['Psychology', 'Sociology and Anthropology'], source: 'cabin-net' },
  { key: 'humanities', riasec: 'I', knowledge: ['History and Archeology', 'Philosophy and Theology'], source: 'own' },
  { key: 'design', riasec: 'A', knowledge: ['Design', 'Fine Arts'], source: 'cabin-net' },
  { key: 'arts', riasec: 'A', knowledge: ['Fine Arts'], source: 'cabin-net' },
  { key: 'music', riasec: 'A', knowledge: ['Fine Arts'], source: 'own' },
  { key: 'writing', riasec: 'A', knowledge: ['English Language'], source: 'cabin-net' },
  { key: 'media', riasec: 'A', knowledge: ['Communications and Media'], source: 'own' },
  { key: 'teaching', riasec: 'S', knowledge: ['Education and Training'], source: 'cabin-net' },
  { key: 'counseling', riasec: 'S', knowledge: ['Therapy and Counseling'], source: 'cabin-net' },
  { key: 'management', riasec: 'E', knowledge: ['Administration and Management'], source: 'cabin-net' },
  { key: 'sales', riasec: 'E', knowledge: ['Sales and Marketing'], source: 'cabin-net' },
  { key: 'law', riasec: 'E', knowledge: ['Law and Government'], source: 'cabin-net' },
  { key: 'finance', riasec: 'C', knowledge: ['Economics and Accounting'], source: 'cabin-net' },
  { key: 'computing', riasec: 'C', knowledge: ['Computers and Electronics'], source: 'cabin-net' },
] as const satisfies readonly BasicInterest[]

export type BasicKey = (typeof BASIC_INTERESTS)[number]['key']
export const BASIC_KEYS = BASIC_INTERESTS.map((b) => b.key) as BasicKey[]
export type BasicProfile = Record<BasicKey, number>

/** O*NET knowledge areas the basic interests are matched against. */
export const KNOWLEDGE_AREAS = [...new Set(BASIC_INTERESTS.flatMap((b) => b.knowledge as readonly string[]))].sort()
