/** Editorial job families, not licensed occupational statistics or qualification checks.
 * Only title/department facts classify adverts; the employer's industry cannot make
 * every job at a bank a finance role or every hospital vacancy a medical role. */
export const OCCUPATIONS = [
  { id: 'software', fields: ['computer-science', 'information-systems'], pattern: /software|entwickl|developer|developpeu|svilupp|devops|full.?stack|backend|frontend|system.?engineer|informatik|informatic|site reliability|endpoint engineer|ict.?system|applikation|netzwerk.*spezial/i },
  { id: 'data', fields: ['statistics-data-science', 'artificial-intelligence', 'mathematics'], pattern: /data (?:scien|analy|engineer)|datenanal|machine learning|business intelligence|statisti/i },
  { id: 'security', fields: ['cybersecurity'], pattern: /cyber|information security|it.?security|it.?forensik|securite informatique/i },
  { id: 'engineering', fields: ['mechanical-engineering', 'electrical-engineering', 'robotics-mechatronics', 'energy-engineering', 'materials-science', 'computer-engineering', 'biomedical-engineering'], pattern: /mechanical|electrical|elektro|elektriker|mechani|robot|automation|automatis|automatiker|werkstoff|materials engineer|medizintechnik|produktion|production|techniker|technicien|betriebsunterhalt|instandhalt/i },
  { id: 'building', fields: ['civil-engineering', 'architecture', 'urban-planning'], pattern: /civil engineer|bauingenieur|architekt|architecte|bauleit|urban plan|genie civil/i },
  { id: 'science', fields: ['physics', 'chemistry', 'biology', 'molecular-biology', 'neuroscience', 'astronomy', 'chemical-engineering'], pattern: /labor|scientist|researcher|wissenschaft|chercheur|chemiker|biolog|physicist/i },
  { id: 'environment', fields: ['environmental-science', 'earth-sciences', 'geography', 'agriculture', 'marine-biology', 'zoology'], pattern: /environment|umwelt|ecolog|nachhaltig|sustainab|geolog|agronom/i },
  { id: 'medicine', fields: ['medicine', 'dentistry', 'veterinary-medicine'], pattern: /arzt|arztin|medecin|mediziner|medico|physician|doctor|dentist|veterinar|gynakolog|chef.*clinique|pedopsychiatr/i },
  { id: 'care', fields: ['nursing', 'public-health'], pattern: /pflege|infirmier|infirmiere|nurs|soins|aide.soignant|assistant.*(?:sante|medical|salle d.operation)|\bassc\b|sage.femme|ambulanc|praxisassist|praxismitarb|radiologiefach|radiologia medica|operationstech|instrumentiste|fach(?:person|frau|mann).*gesundheit|optometr|gestionnaire.*sante/i },
  { id: 'therapy', fields: ['physiotherapy', 'nutrition', 'sports-science', 'psychology'], pattern: /physiotherap|ergotherap|psycholog|psychotherap|dieteti|nutrition|therapeut/i },
  { id: 'pharmacy', fields: ['pharmacy', 'chemistry'], pattern: /pharmac|apothek/i },
  { id: 'social', fields: ['social-work', 'sociology', 'anthropology'], pattern: /sozial|social work|travail.*social|educateur.*social|soziolog|sociolog/i },
  { id: 'education', fields: ['education', 'linguistics'], pattern: /lehrperson|lehrer|enseign|teacher|paedagog|padagog|formateur|learning.*development/i },
  { id: 'policy', fields: ['political-science', 'economics', 'sociology'], pattern: /policy|public affairs|politikw|politolog|economist|okonom/i },
  { id: 'legal', fields: ['law', 'criminology'], pattern: /legal|jurist|lawyer|anwalt|gerichtsschreiber|greffier|compliance|paralegal|fraud officer|regulatory reporting/i },
  { id: 'finance', fields: ['finance-accounting', 'economics'], pattern: /accountant|accounting|buchhalt|comptab|controll|treasury|financial|finance|banking|risk (?:officer|analyst|manager)|investment|portfolio|payments|transaction|trad(?:er|ing)|internal audit|asset manag/i },
  { id: 'business', fields: ['business-management', 'entrepreneurship', 'industrial-engineering'], pattern: /business (?:develop|analy)|project manag|projektleit|chef.*projet|product manag|produktmanag|produ[ck]t owner|consultant|consulting|strategie|strategy|sales|verkauf|detailhandel|gestionnaire.*commerce|assistant.*commerce|impiegat.*commercio|vendeu|vendit|client director|relationship manag/i },
  { id: 'people', fields: ['psychology', 'business-management', 'education'], pattern: /human resources|recruit|personalwesen|hr |talent acquisition|people.*culture/i },
  { id: 'marketing', fields: ['marketing', 'media-communication'], pattern: /marketing|communication|kommunikation|public relations|brand manag|social media|search.*visibility/i },
  { id: 'design', fields: ['ux-design', 'graphic-design', 'industrial-design', 'fashion-design', 'fine-arts'], pattern: /design|grafik|graphiste|ux |ui |illustrat/i },
  { id: 'media', fields: ['journalism', 'film-production', 'animation-vfx', 'game-design', 'literature', 'languages', 'history', 'archaeology', 'philosophy', 'religious-studies', 'liberal-arts'], pattern: /journalis|redakt|editor|redact|translation|uberset|traduct|archiv|museum|biblioth|librarian|video|animation|mediamatic/i },
  { id: 'culture', fields: ['music', 'music-production', 'performing-arts'], pattern: /musiker|musicien|music |theater|theatre|kultur|cultur|sound engineer/i },
  { id: 'logistics', fields: ['logistics', 'aviation', 'automotive-engineering', 'aerospace-engineering'], pattern: /logisti|supply chain|einkauf|procurement|transport|pilot|aviation|lokfuhrer|triebfahrzeug|rangier|zugpersonal|zugsteuer|zugfuhr|chauffeu/i },
  { id: 'hospitality', fields: ['hospitality-tourism', 'culinary-arts'], pattern: /hotel|hospitality|restaurant|koch|kuch|cuisin|reception|empfang|touris|service.*restauration|patiss|chef.*partie/i },
  { id: 'administration', fields: ['business-management', 'information-systems'], pattern: /administrat|office assistant|assistenz|secretaire|secretar|sekretar|(?:customer|client) (?:care|service)|kundendienst|kundendialog|employe.*commerce|kaufmann|kauffrau|client.*(?:onboarding|lifecycle)|existing clients|central data agent/i },
] as const

export type OccupationId = (typeof OCCUPATIONS)[number]['id']
export function occupationsForJob(title: string, department = ''): string[] {
  const titles = OCCUPATIONS.filter((o) => o.pattern.test(title.normalize('NFD').replace(/\p{M}/gu, '')))
  if (titles.length) return titles.map((o) => o.id)
  return OCCUPATIONS.filter((o) => o.pattern.test(department.normalize('NFD').replace(/\p{M}/gu, ''))).map((o) => o.id)
}
