import { BIG5_LABELS, FIELD_BY_ID, GROUP_LABELS, RIASEC_LABELS, SUBJECT_LABELS, VALUE_LABELS } from '../taxonomy/fields.ts'
import type { Big5Key, FieldGroup, RiasecKey, SubjectKey, ValueKey } from '../taxonomy/fields.ts'
import { LEVEL_LABELS } from '../programmes.ts'
import type { Level } from '../programmes.ts'
import { FIELDS_DE } from './fields-de.ts'
import type { Locale } from './config.ts'

/** Localised names for everything the taxonomy defines in English. */

export const FIELD_EMOJI: Record<string, string> = {
  mathematics: '∑',
  'statistics-data-science': '📊',
  'computer-science': '💻',
  'artificial-intelligence': '🤖',
  cybersecurity: '🔐',
  'information-systems': '🗂️',
  'computer-engineering': '🔌',
  physics: '⚛️',
  astronomy: '🔭',
  chemistry: '🧪',
  biology: '🌱',
  'molecular-biology': '🧬',
  neuroscience: '🧠',
  'cognitive-science': '💭',
  'environmental-science': '🌍',
  'earth-sciences': '🌋',
  'marine-biology': '🐙',
  zoology: '🦒',
  geography: '🗺️',
  'mechanical-engineering': '⚙️',
  'electrical-engineering': '⚡',
  'civil-engineering': '🌉',
  'aerospace-engineering': '🚀',
  'automotive-engineering': '🏎️',
  'chemical-engineering': '🏭',
  'biomedical-engineering': '🦾',
  'materials-science': '💎',
  'robotics-mechatronics': '🦿',
  'energy-engineering': '🔋',
  'industrial-engineering': '📦',
  architecture: '🏛️',
  'urban-planning': '🚋',
  'industrial-design': '🪑',
  'game-design': '🎮',
  'ux-design': '📱',
  medicine: '🩺',
  nursing: '💉',
  pharmacy: '💊',
  dentistry: '🦷',
  'veterinary-medicine': '🐾',
  physiotherapy: '🤸',
  'sports-science': '🏃',
  nutrition: '🥗',
  'public-health': '🏥',
  psychology: '🧩',
  economics: '📈',
  'business-management': '💼',
  'finance-accounting': '💰',
  marketing: '📣',
  entrepreneurship: '🦄',
  logistics: '🚢',
  'hospitality-tourism': '🏨',
  'political-science': '🏛',
  law: '⚖️',
  criminology: '🕵️',
  sociology: '👥',
  anthropology: '🪶',
  'social-work': '🤝',
  education: '🍎',
  journalism: '📰',
  'media-communication': '🎙️',
  history: '📜',
  archaeology: '🏺',
  philosophy: '🤔',
  'religious-studies': '🕊️',
  linguistics: '🗣️',
  languages: '🌐',
  literature: '📚',
  'liberal-arts': '🎓',
  'fine-arts': '🎨',
  'graphic-design': '✏️',
  'fashion-design': '👗',
  'film-production': '🎬',
  'animation-vfx': '🎞️',
  music: '🎻',
  'music-production': '🎛️',
  'performing-arts': '🎭',
  'culinary-arts': '👩‍🍳',
  agriculture: '🌾',
  aviation: '✈️',
}

export const emoji = (id: string) => FIELD_EMOJI[id] ?? '🎓'

export function fieldName(id: string, locale: Locale): string {
  return locale === 'de' ? (FIELDS_DE[id]?.name ?? FIELD_BY_ID[id]?.name ?? id) : (FIELD_BY_ID[id]?.name ?? id)
}

export function fieldBlurb(id: string, locale: Locale): string {
  return locale === 'de' ? (FIELDS_DE[id]?.blurb ?? '') : (FIELD_BY_ID[id]?.blurb ?? '')
}

export function fieldCareers(id: string, locale: Locale): string[] {
  return locale === 'de' ? (FIELDS_DE[id]?.careers ?? []) : (FIELD_BY_ID[id]?.careers ?? [])
}

const GROUP_DE: Record<FieldGroup, string> = {
  science: 'Naturwissenschaften',
  computing: 'Informatik & Daten',
  engineering: 'Technik & Bau',
  health: 'Gesundheit & Medizin',
  social: 'Sozialwissenschaften & Recht',
  business: 'Wirtschaft & Management',
  humanities: 'Geisteswissenschaften & Medien',
  arts: 'Kunst & Design',
  applied: 'Angewandte Berufe',
}

const SUBJECT_DE: Record<SubjectKey, string> = {
  math: 'Mathematik',
  phys: 'Physik',
  chem: 'Chemie',
  bio: 'Biologie',
  cs: 'Informatik',
  lang: 'Deutsch & Literatur',
  forlang: 'Fremdsprachen',
  hist: 'Geschichte',
  geo: 'Geografie',
  econ: 'Wirtschaft & Recht',
  art: 'Bildnerisches Gestalten',
  music: 'Musik',
  sport: 'Sport',
  social: 'Philosophie, Psychologie & Gesellschaft',
}

const VALUE_DE: Record<ValueKey, string> = {
  salary: 'Hoher Lohn',
  security: 'Sicherer Job',
  creativity: 'Kreative Arbeit',
  helping: 'Menschen helfen',
  tech: 'Mit Technik arbeiten',
  outdoors: 'Draussen sein',
  autonomy: 'Unabhängigkeit',
  impact: 'Etwas für Gesellschaft oder Planet tun',
}

const RIASEC_DE: Record<RiasecKey, { name: string; short: string }> = {
  R: { name: 'Praktisch', short: 'Macher:in: anpacken, Werkzeuge, Maschinen, draussen' },
  I: { name: 'Forschend', short: 'Denker:in: analysieren, recherchieren, verstehen wollen' },
  A: { name: 'Kreativ', short: 'Gestalter:in: ausdrücken, entwerfen, erfinden' },
  S: { name: 'Sozial', short: 'Helfer:in: erklären, begleiten, unterstützen' },
  E: { name: 'Unternehmerisch', short: 'Überzeuger:in: führen, verkaufen, Dinge anreissen' },
  C: { name: 'Ordnend', short: 'Organisator:in: Struktur, Daten, Genauigkeit' },
}

const BIG5_DE: Record<Big5Key, { name: string; high: string; low: string }> = {
  O: { name: 'Offenheit', high: 'neugierig, fantasievoll, liebt Ideen', low: 'praktisch, mag Bewährtes' },
  C: { name: 'Gewissenhaftigkeit', high: 'organisiert, diszipliniert, zuverlässig', low: 'flexibel, spontan' },
  E: { name: 'Extraversion', high: 'gesellig, tankt bei Menschen auf', low: 'zurückhaltend, tankt allein auf' },
  A: { name: 'Verträglichkeit', high: 'warmherzig, kooperativ, empathisch', low: 'direkt, kompetitiv, kritisch' },
  N: { name: 'Emotionale Empfindsamkeit', high: 'spürt Stress und Gefühle stark', low: 'ruhig, ausgeglichen' },
}

const LEVEL_DE: Record<Level, string> = {
  short: 'Kurzstudium / Vorbereitung',
  bachelor: 'Bachelor',
  master: 'Master',
  integrated: 'Bachelor + Master integriert',
  doctorate: 'Doktorat',
  professional: 'Staatsexamen (Medizin, Recht …)',
}

export const groupLabel = (g: FieldGroup, l: Locale) => (l === 'de' ? GROUP_DE[g] : GROUP_LABELS[g])
export const subjectLabel = (k: SubjectKey, l: Locale) => (l === 'de' ? SUBJECT_DE[k] : SUBJECT_LABELS[k])
export const valueLabel = (k: ValueKey, l: Locale) => (l === 'de' ? VALUE_DE[k] : VALUE_LABELS[k])
export const riasecLabel = (k: RiasecKey, l: Locale) => (l === 'de' ? RIASEC_DE[k] : RIASEC_LABELS[k])
export const big5Label = (k: Big5Key, l: Locale) => (l === 'de' ? BIG5_DE[k] : BIG5_LABELS[k])
export const levelLabel = (k: Level, l: Locale) => (l === 'de' ? LEVEL_DE[k] : LEVEL_LABELS[k])

/** Country names from the browser's/Node's own data. */
export function countryLabel(code: string, intl: string): string {
  try {
    return new Intl.DisplayNames([intl], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export function fmtNumber(n: number, intl: string): string {
  return n.toLocaleString(intl)
}

export function fmtMoney(amount: number, currency: string, intl: string): string {
  try {
    return new Intl.NumberFormat(intl, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${Math.round(amount)} ${currency}`
  }
}
