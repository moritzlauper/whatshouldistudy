import type { Big5, Big5Key, Riasec, RiasecKey, SubjectKey, ValueKey } from '../taxonomy/fields.ts'

export type SourceId =
  | 'youtube'
  | 'takeout'
  | 'spotify'
  | 'spotify-export'
  | 'reddit'
  | 'github'
  | 'questionnaire'

/** One thing a person did or chose: a liked video, a subscribed channel, a saved podcast. */
export interface SignalItem {
  kind: string
  /** Text to classify (title, tags, description excerpt). */
  text: string
  /** How the item is shown as evidence. */
  label: string
  /** Channel, subreddit or show; used for channel-level context and diminishing returns. */
  group?: string
  /** Base weight by kind (a subscription says more than a single view). */
  weight: number
  time?: number
  /** 0..1 prior that the item is about learning, e.g. from the YouTube category. */
  learningPrior?: number
  /** Music listening is analysed for taste, not as an interest in studying music. */
  isMusic?: boolean
  splitCamel?: boolean
  /** Direct field mapping (known subreddit), added on top of the text match. */
  fieldHints?: string[]
  url?: string
}

export interface FieldEvidence {
  /** Weighted sum of the field's share over all items. */
  score: number
  /** Number of distinct items that clearly matched. */
  items: number
  /** Distinct months (YYYY-MM) with evidence. */
  months: string[]
  top: Array<{ label: string; kind: string; w: number; url?: string }>
  terms: Record<string, number>
}

export interface MusicProfile {
  /** Shares of the five MUSIC dimensions (Rentfrow et al.). */
  dimensions: Record<'mellow' | 'unpretentious' | 'sophisticated' | 'intense' | 'contemporary', number>
  topGenres: Array<{ genre: string; weight: number }>
  diversity: number
  artists: number
}

export interface SourceSummary {
  source: SourceId
  label: string
  collectedAt: string
  /** Raw items read from the source (the "thousands of data points"). */
  dataPoints: number
  /** Sum of effective weights of all non-music items. */
  totalWeight: number
  /** Learning-weighted share numerator. */
  learningWeight: number
  fields: Record<string, FieldEvidence>
  stats: Record<string, number | string>
  span?: { from: string; to: string; months: number }
  /** Activity by hour of day, local time. */
  hours?: number[]
  /** Field weights per year, for the "how your interests moved" chart. */
  timeline?: Record<string, Record<string, number>>
  music?: MusicProfile
  /** Things this source showed about making rather than consuming. */
  maker?: number
  notes?: string[]
}

export interface QuestionnaireAnswers {
  riasec?: Record<string, number>
  big5?: Record<string, number>
  subjects?: Partial<Record<SubjectKey, { enjoy?: number; grade?: number }>>
  values?: Partial<Record<ValueKey, number>>
}

export type DegreeLevel = 'bachelor' | 'master' | 'any'

export interface Preferences {
  level: DegreeLevel
  /** ISO country codes; empty = anywhere. */
  countries: string[]
  /** Max tuition per year in EUR; 0 = no limit. */
  maxTuitionEur: number
  /** Where the student is from, for fee categories. */
  origin: 'eu' | 'us' | 'uk' | 'ch' | 'other'
  englishOnly: boolean
}

export interface FieldMatch {
  id: string
  /** Final 0..1 composite. */
  match: number
  /** 0..100 for display. */
  score: number
  components: Partial<Record<'interest' | 'riasec' | 'personality' | 'subjects' | 'values', number>>
  /** Interest strength before squashing (log-lift, shrunk); for debugging and ranking. */
  interest?: number
  reasons: Reason[]
  evidence: Array<{ label: string; kind: string; source: SourceId; url?: string }>
  terms: string[]
  persistence?: number
  sources: SourceId[]
}

/** Why a field matches; rendered per language by the site. */
export type Reason =
  | { k: 'interest'; items: number; months: number }
  | { k: 'riasec'; types: RiasecKey[] }
  | { k: 'subjects'; subjects: SubjectKey[] }
  | { k: 'subjectsLow'; subjects: SubjectKey[] }
  | { k: 'values'; values: ValueKey[] }
  | { k: 'personality'; trait: Big5Key; high: boolean }
  | { k: 'hidden' }

export interface Insight {
  id: 'datapoints' | 'learning' | 'breadth' | 'consistency' | 'rhythm' | 'maker'
  data: Record<string, number | string | boolean>
}

export interface Results {
  version: 1
  generatedAt: string
  dataPoints: number
  sources: Array<{ id: SourceId; label: string; dataPoints: number }>
  confidence: 'low' | 'medium' | 'high'
  fields: FieldMatch[]
  hidden: FieldMatch[]
  riasec: { profile: Riasec; code: string; from: string[] }
  big5?: { z: Big5; from: string[]; confidence: number }
  insights: Insight[]
  timeline: Array<{ year: string; fields: Array<{ id: string; share: number }> }>
}

export type { Big5, Big5Key, Riasec }
