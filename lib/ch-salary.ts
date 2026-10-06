/**
 * Swiss graduate salaries: the BFS graduate survey (EHA) reports the median
 * standardised gross income one year after graduation, per group of subjects
 * at universities (UH) and per subject area at universities of applied
 * sciences (FH) and teacher education (PH). Our fields map onto those groups.
 */

/** University (UH) subject groups. */
export type UhGroup = 'humanities-social' | 'economics' | 'law' | 'natural-sciences' | 'medicine' | 'technical' | 'interdisciplinary'
/** FH subject areas, plus PH teacher education. */
export type FhArea =
  | 'architecture'
  | 'tech-it'
  | 'chem-life'
  | 'agriculture'
  | 'business'
  | 'design'
  | 'sport'
  | 'arts'
  | 'linguistics'
  | 'social-work'
  | 'psychology'
  | 'health'
  | 'teaching'

/** Names as BFS writes them (German, French, Italian), matched loosely. */
export const UH_NAMES: Array<[UhGroup, RegExp]> = [
  ['humanities-social', /geistes|sciences humaines|scienze umane/i],
  ['economics', /wirtschaftswiss|sciences [ée]conomiques|scienze economiche/i],
  ['law', /^(recht|droit|diritto)/i],
  ['natural-sciences', /exakte|sciences exactes|scienze esatte/i],
  ['medicine', /medizin|m[ée]decine|medicina/i],
  ['technical', /technische wiss|sciences techniques|scienze tecniche/i],
  ['interdisciplinary', /interdisziplin|interdisciplin/i],
]

export const FH_NAMES: Array<[FhArea, RegExp]> = [
  ['architecture', /architektur|architecture|architettura/i],
  ['tech-it', /technik|technique|tecnica/i],
  ['chem-life', /chemie|chimie|chimica/i],
  ['agriculture', /land- und forst|agriculture|agricoltura/i],
  ['business', /wirtschaft und dienst|[ée]conomie et services|economia e servizi/i],
  ['design', /^design$/i],
  ['sport', /^sport$/i],
  ['arts', /musik|musique|musica/i],
  ['linguistics', /linguisti/i],
  ['social-work', /soziale arbeit|travail social|lavoro sociale/i],
  ['psychology', /psycholog|psicologia/i],
  ['health', /^(gesundheit|sant[ée]|sanit)/i],
  ['teaching', /lehrkr[äa]fte|formation des enseignants|formazione degli insegnanti/i],
]

/** Where graduates of each field are counted. */
export const FIELD_SALARY_GROUPS: Record<string, { uh?: UhGroup; fh?: FhArea }> = {
  mathematics: { uh: 'natural-sciences' },
  'statistics-data-science': { uh: 'natural-sciences', fh: 'tech-it' },
  'computer-science': { uh: 'technical', fh: 'tech-it' },
  'artificial-intelligence': { uh: 'technical', fh: 'tech-it' },
  cybersecurity: { uh: 'technical', fh: 'tech-it' },
  'information-systems': { uh: 'economics', fh: 'business' },
  'computer-engineering': { uh: 'technical', fh: 'tech-it' },
  physics: { uh: 'natural-sciences' },
  astronomy: { uh: 'natural-sciences' },
  chemistry: { uh: 'natural-sciences', fh: 'chem-life' },
  biology: { uh: 'natural-sciences', fh: 'chem-life' },
  'molecular-biology': { uh: 'natural-sciences', fh: 'chem-life' },
  neuroscience: { uh: 'natural-sciences' },
  'cognitive-science': { uh: 'natural-sciences' },
  'environmental-science': { uh: 'natural-sciences', fh: 'chem-life' },
  'earth-sciences': { uh: 'natural-sciences' },
  'marine-biology': { uh: 'natural-sciences' },
  zoology: { uh: 'natural-sciences' },
  geography: { uh: 'natural-sciences' },
  'mechanical-engineering': { uh: 'technical', fh: 'tech-it' },
  'electrical-engineering': { uh: 'technical', fh: 'tech-it' },
  'civil-engineering': { uh: 'technical', fh: 'architecture' },
  'aerospace-engineering': { uh: 'technical', fh: 'tech-it' },
  'automotive-engineering': { uh: 'technical', fh: 'tech-it' },
  'chemical-engineering': { uh: 'technical', fh: 'chem-life' },
  'biomedical-engineering': { uh: 'technical', fh: 'tech-it' },
  'materials-science': { uh: 'technical', fh: 'tech-it' },
  'robotics-mechatronics': { uh: 'technical', fh: 'tech-it' },
  'energy-engineering': { uh: 'technical', fh: 'tech-it' },
  'industrial-engineering': { uh: 'technical', fh: 'tech-it' },
  architecture: { uh: 'technical', fh: 'architecture' },
  'urban-planning': { uh: 'technical', fh: 'architecture' },
  'industrial-design': { fh: 'design' },
  'game-design': { fh: 'design' },
  'ux-design': { fh: 'design' },
  medicine: { uh: 'medicine' },
  nursing: { fh: 'health' },
  pharmacy: { uh: 'medicine' },
  dentistry: { uh: 'medicine' },
  'veterinary-medicine': { uh: 'medicine' },
  physiotherapy: { fh: 'health' },
  'sports-science': { uh: 'interdisciplinary', fh: 'sport' },
  nutrition: { fh: 'health' },
  'public-health': { uh: 'medicine', fh: 'health' },
  psychology: { uh: 'humanities-social', fh: 'psychology' },
  economics: { uh: 'economics', fh: 'business' },
  'business-management': { uh: 'economics', fh: 'business' },
  'finance-accounting': { uh: 'economics', fh: 'business' },
  marketing: { uh: 'economics', fh: 'business' },
  entrepreneurship: { uh: 'economics', fh: 'business' },
  logistics: { uh: 'economics', fh: 'business' },
  'hospitality-tourism': { fh: 'business' },
  'political-science': { uh: 'humanities-social' },
  law: { uh: 'law' },
  criminology: { uh: 'law' },
  sociology: { uh: 'humanities-social' },
  anthropology: { uh: 'humanities-social' },
  'social-work': { fh: 'social-work' },
  education: { uh: 'humanities-social', fh: 'teaching' },
  journalism: { uh: 'humanities-social', fh: 'linguistics' },
  'media-communication': { uh: 'humanities-social', fh: 'linguistics' },
  history: { uh: 'humanities-social' },
  archaeology: { uh: 'humanities-social' },
  philosophy: { uh: 'humanities-social' },
  'religious-studies': { uh: 'humanities-social' },
  linguistics: { uh: 'humanities-social', fh: 'linguistics' },
  languages: { uh: 'humanities-social', fh: 'linguistics' },
  literature: { uh: 'humanities-social' },
  'liberal-arts': { uh: 'interdisciplinary' },
  'fine-arts': { fh: 'arts' },
  'graphic-design': { fh: 'design' },
  'fashion-design': { fh: 'design' },
  'film-production': { fh: 'arts' },
  'animation-vfx': { fh: 'design' },
  music: { fh: 'arts' },
  'music-production': { fh: 'arts' },
  'performing-arts': { fh: 'arts' },
  'culinary-arts': { fh: 'business' },
  agriculture: { uh: 'technical', fh: 'agriculture' },
  aviation: { fh: 'tech-it' },
}

/** The scraper's output: medians (CHF per year, working in Switzerland). */
export interface ChSalaryTable {
  fetchedAt: string
  /** Graduation year the survey covers. */
  year?: string
  url: string
  uh: Partial<Record<UhGroup, { bachelor?: number; master?: number; doctorate?: number }>>
  fh: Partial<Record<FhArea, { bachelor?: number; master?: number; diploma?: number }>>
}

/** Per field, what the site shows. */
export interface ChSalary {
  /** University master's graduates. */
  uhMaster?: number
  /** FH bachelor's graduates. */
  fhBachelor?: number
  /** PH teaching diploma. */
  teaching?: number
  year?: string
}

export function chSalaryFor(fieldId: string, t: ChSalaryTable): ChSalary | undefined {
  const g = FIELD_SALARY_GROUPS[fieldId]
  if (!g) return undefined
  const out: ChSalary = { year: t.year }
  if (g.uh) out.uhMaster = t.uh[g.uh]?.master
  if (g.fh === 'teaching') out.teaching = t.fh.teaching?.diploma
  else if (g.fh) out.fhBachelor = t.fh[g.fh]?.bachelor
  return out.uhMaster || out.fhBachelor || out.teaching ? out : undefined
}

/** One number per field for ranking: the university master's if there is one. */
export const chSalaryValue = (s?: ChSalary) => s?.uhMaster ?? s?.fhBachelor ?? s?.teaching
