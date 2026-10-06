import { BIG5_LABELS, FIELD_BY_ID, GROUP_LABELS, RIASEC_LABELS, SUBJECT_LABELS, VALUE_LABELS } from '../taxonomy/fields.ts'
import type { Big5Key, FieldGroup, RiasecKey, SubjectKey, ValueKey } from '../taxonomy/fields.ts'
import { LEVEL_LABELS } from '../programmes.ts'
import type { Level } from '../programmes.ts'
import { FIELDS_DE } from './fields-de.ts'
import { FIELDS_FR } from './fields-fr.ts'
import { FIELDS_IT } from './fields-it.ts'
import type { Locale } from './config.ts'
import { regionalize } from './regional.ts'

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
  if (locale === 'fr-CH') return FIELDS_FR[id]?.name ?? FIELD_BY_ID[id]?.name ?? id
  if (locale === 'it-CH') return FIELDS_IT[id]?.name ?? FIELD_BY_ID[id]?.name ?? id
  return locale === 'en' ? (FIELD_BY_ID[id]?.name ?? id) : regionalize(FIELDS_DE[id]?.name ?? FIELD_BY_ID[id]?.name ?? id, locale)
}

export function fieldBlurb(id: string, locale: Locale): string {
  if (locale === 'fr-CH') return FIELDS_FR[id]?.blurb ?? FIELD_BY_ID[id]?.blurb ?? ''
  if (locale === 'it-CH') return FIELDS_IT[id]?.blurb ?? FIELD_BY_ID[id]?.blurb ?? ''
  return locale === 'en' ? (FIELD_BY_ID[id]?.blurb ?? '') : regionalize(FIELDS_DE[id]?.blurb ?? '', locale)
}

export function fieldCareers(id: string, locale: Locale): string[] {
  if (locale === 'fr-CH' || locale === 'it-CH' || locale === 'en') return FIELD_BY_ID[id]?.careers ?? []
  return (FIELDS_DE[id]?.careers ?? []).map((c) => regionalize(c, locale))
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

const GROUP_FR: Record<FieldGroup, string> = {
  science: 'Sciences naturelles', computing: 'Informatique et données', engineering: 'Ingénierie et construction', health: 'Santé et médecine',
  social: 'Sciences sociales et droit', business: 'Économie et gestion', humanities: 'Sciences humaines et médias', arts: 'Arts et design', applied: 'Professions appliquées',
}
const GROUP_IT: Record<FieldGroup, string> = {
  science: 'Scienze naturali', computing: 'Informatica e dati', engineering: 'Ingegneria e costruzioni', health: 'Salute e medicina',
  social: 'Scienze sociali e diritto', business: 'Economia e management', humanities: 'Scienze umane e media', arts: 'Arte e design', applied: 'Professioni applicate',
}
const SUBJECT_FR: Record<SubjectKey, string> = {
  math: 'Mathématiques', phys: 'Physique', chem: 'Chimie', bio: 'Biologie', cs: 'Informatique', lang: 'Langue et littérature',
  forlang: 'Langues étrangères', hist: 'Histoire', geo: 'Géographie', econ: 'Économie et gestion', art: 'Arts visuels', music: 'Musique', sport: 'Sport', social: 'Philosophie, psychologie et société',
}
const SUBJECT_IT: Record<SubjectKey, string> = {
  math: 'Matematica', phys: 'Fisica', chem: 'Chimica', bio: 'Biologia', cs: 'Informatica', lang: 'Lingua e letteratura',
  forlang: 'Lingue straniere', hist: 'Storia', geo: 'Geografia', econ: 'Economia e gestione', art: 'Arti visive', music: 'Musica', sport: 'Sport', social: 'Filosofia, psicologia e società',
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
const VALUE_FR: Record<ValueKey, string> = {
  salary: 'Salaire élevé', security: 'Emploi stable', creativity: 'Travail créatif', helping: 'Aider les autres', tech: 'Travailler avec la technologie',
  outdoors: 'Travailler dehors', autonomy: 'Autonomie', impact: 'Agir pour la société ou la planète',
}
const VALUE_IT: Record<ValueKey, string> = {
  salary: 'Stipendio elevato', security: 'Sicurezza del posto di lavoro', creativity: 'Lavoro creativo', helping: 'Aiutare le persone', tech: 'Lavorare con la tecnologia',
  outdoors: 'Stare all’aperto', autonomy: 'Autonomia', impact: 'Contribuire alla società o al pianeta',
}

const RIASEC_DE: Record<RiasecKey, { name: string; short: string }> = {
  R: { name: 'Praktisch', short: 'Macher:in: anpacken, Werkzeuge, Maschinen, draussen' },
  I: { name: 'Forschend', short: 'Denker:in: analysieren, recherchieren, verstehen wollen' },
  A: { name: 'Kreativ', short: 'Gestalter:in: ausdrücken, entwerfen, erfinden' },
  S: { name: 'Sozial', short: 'Helfer:in: erklären, begleiten, unterstützen' },
  E: { name: 'Unternehmerisch', short: 'Überzeuger:in: führen, verkaufen, Dinge anreissen' },
  C: { name: 'Ordnend', short: 'Organisator:in: Struktur, Daten, Genauigkeit' },
}
const RIASEC_FR: Record<RiasecKey, { name: string; short: string }> = {
  R: { name: 'Réaliste', short: 'Pratique : agir, utiliser des outils et des machines, travailler dehors' },
  I: { name: 'Investigateur', short: 'Analytique : rechercher, comprendre et résoudre des problèmes' },
  A: { name: 'Artistique', short: 'Créatif : exprimer, concevoir et imaginer' },
  S: { name: 'Social', short: 'Altruiste : expliquer, accompagner et soutenir' },
  E: { name: 'Entreprenant', short: 'Persuasif : diriger, convaincre et lancer des projets' },
  C: { name: 'Conventionnel', short: 'Organisé : structurer, traiter des données et être précis' },
}
const RIASEC_IT: Record<RiasecKey, { name: string; short: string }> = {
  R: { name: 'Realistico', short: 'Pratico: agire, usare strumenti e macchine, lavorare all’aperto' },
  I: { name: 'Investigativo', short: 'Analitico: ricercare, capire e risolvere problemi' },
  A: { name: 'Artistico', short: 'Creativo: esprimersi, progettare e immaginare' },
  S: { name: 'Sociale', short: 'Altruista: spiegare, accompagnare e sostenere' },
  E: { name: 'Intraprendente', short: 'Persuasivo: guidare, convincere e avviare progetti' },
  C: { name: 'Convenzionale', short: 'Organizzato: strutturare, gestire dati e lavorare con precisione' },
}

const BIG5_DE: Record<Big5Key, { name: string; high: string; low: string }> = {
  O: { name: 'Offenheit', high: 'neugierig, fantasievoll, liebt Ideen', low: 'praktisch, mag Bewährtes' },
  C: { name: 'Gewissenhaftigkeit', high: 'organisiert, diszipliniert, zuverlässig', low: 'flexibel, spontan' },
  E: { name: 'Extraversion', high: 'gesellig, tankt bei Menschen auf', low: 'zurückhaltend, tankt allein auf' },
  A: { name: 'Verträglichkeit', high: 'warmherzig, kooperativ, empathisch', low: 'direkt, kompetitiv, kritisch' },
  N: { name: 'Emotionale Empfindsamkeit', high: 'spürt Stress und Gefühle stark', low: 'ruhig, ausgeglichen' },
}
const BIG5_FR: Record<Big5Key, { name: string; high: string; low: string }> = {
  O: { name: 'Ouverture', high: 'curieux, imaginatif, aime les idées', low: 'pratique, préfère les habitudes' },
  C: { name: 'Conscienciosité', high: 'organisé, discipliné, fiable', low: 'flexible, spontané' },
  E: { name: 'Extraversion', high: 'sociable, stimulé par les autres', low: 'réservé, apprécie la solitude' },
  A: { name: 'Agréabilité', high: 'chaleureux, coopératif, empathique', low: 'direct, compétitif, critique' },
  N: { name: 'Sensibilité émotionnelle', high: 'ressent fortement le stress et les émotions', low: 'calme, équilibré' },
}
const BIG5_IT: Record<Big5Key, { name: string; high: string; low: string }> = {
  O: { name: 'Apertura mentale', high: 'curioso, fantasioso, ama le idee', low: 'pratico, preferisce ciò che conosce' },
  C: { name: 'Coscienziosità', high: 'organizzato, disciplinato, affidabile', low: 'flessibile, spontaneo' },
  E: { name: 'Estroversione', high: 'socievole, si ricarica con gli altri', low: 'riservato, si ricarica da solo' },
  A: { name: 'Amicalità', high: 'cordiale, collaborativo, empatico', low: 'diretto, competitivo, critico' },
  N: { name: 'Sensibilità emotiva', high: 'percepisce intensamente stress ed emozioni', low: 'calmo, equilibrato' },
}

const LEVEL_DE: Record<Level, string> = {
  short: 'Kurzstudium / Vorbereitung',
  bachelor: 'Bachelor',
  master: 'Master',
  integrated: 'Bachelor + Master integriert',
  doctorate: 'Doktorat',
  professional: 'Staatsexamen (Medizin, Recht …)',
}
const LEVEL_FR: Record<Level, string> = {
  short: 'Études courtes / préparation', bachelor: 'Bachelor', master: 'Master', integrated: 'Bachelor et Master intégrés', doctorate: 'Doctorat', professional: 'Diplôme professionnel',
}
const LEVEL_IT: Record<Level, string> = {
  short: 'Studi brevi / preparazione', bachelor: 'Bachelor', master: 'Master', integrated: 'Bachelor e Master integrati', doctorate: 'Dottorato', professional: 'Diploma professionale',
}

const de = <T,>(v: T, l: Locale): T => (typeof v === 'string' ? (regionalize(v, l) as T) : (Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, regionalize(x as string, l)])) as T))

export const groupLabel = (g: FieldGroup, l: Locale) => l === 'fr-CH' ? GROUP_FR[g] : l === 'it-CH' ? GROUP_IT[g] : l === 'en' ? GROUP_LABELS[g] : de(GROUP_DE[g], l)
export const subjectLabel = (k: SubjectKey, l: Locale) => l === 'fr-CH' ? SUBJECT_FR[k] : l === 'it-CH' ? SUBJECT_IT[k] : l === 'en' ? SUBJECT_LABELS[k] : de(SUBJECT_DE[k], l)
export const valueLabel = (k: ValueKey, l: Locale) => l === 'fr-CH' ? VALUE_FR[k] : l === 'it-CH' ? VALUE_IT[k] : l === 'en' ? VALUE_LABELS[k] : de(VALUE_DE[k], l)
export const riasecLabel = (k: RiasecKey, l: Locale) => l === 'fr-CH' ? RIASEC_FR[k] : l === 'it-CH' ? RIASEC_IT[k] : l === 'en' ? RIASEC_LABELS[k] : de(RIASEC_DE[k], l)
export const big5Label = (k: Big5Key, l: Locale) => l === 'fr-CH' ? BIG5_FR[k] : l === 'it-CH' ? BIG5_IT[k] : l === 'en' ? BIG5_LABELS[k] : de(BIG5_DE[k], l)
export function levelLabel(k: Level, l: Locale): string {
  if (l === 'fr-CH') return LEVEL_FR[k]
  if (l === 'it-CH') return LEVEL_IT[k]
  if (l === 'en') return LEVEL_LABELS[k]
  // Austria has no Staatsexamen; medicine, law and teaching are Diplomstudien there.
  if (l === 'de-AT' && k === 'professional') return 'Diplomstudium'
  return regionalize(LEVEL_DE[k], l)
}

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
