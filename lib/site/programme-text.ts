import { regionalizeDeep } from './regional.ts'
import type { Locale } from './config.ts'

/**
 * Text for the programme pages that the catalogue text does not cover: the
 * key facts as tiles, what sets the programme apart, the fit card with its
 * comparison against the answers in this browser, and where it leads.
 */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const en = {
  // Fit card
  fitTitle: 'Is this right for you?',
  fieldFitTitle: (f: string) => `Is ${f} right for you?`,
  personalTitle: 'Compared with your answers',
  types: 'Interest types',
  barsNote: (f: string) => `Bar: this programme. Line: ${f} in general.`,
  /** `more` and `less` are lower-case type names; `join` joins a list. */
  shift: (more: string[], less: string[], f: string, join: (xs: string[]) => string) =>
    `${cap([more.length ? `more ${join(more)}` : '', less.length ? `less ${join(less)}` : ''].filter(Boolean).join(' and '))} than ${f} in general.`,
  pro: 'A good sign if this draws you in',
  contra: 'Less so if this is mostly what you like',
  fieldOnly: (f: string) => `Profile of the field ${f}. There is no profile of this programme of its own.`,
  compare: 'Compare with my answers',
  compareHint: 'Questionnaire, about 8 minutes. You see matching fields for free.',
  toResult: 'Go to your result',
  personalSummary: (t: number, tn: number, i: number, inN: number) => `${t} of ${tn} interest types and ${i} of ${inN} interests are among your strongest.`,
  clash: (names: string) => `You like ${names}, which hardly comes up here.`,
  liked: 'matches your answers',
  personalNote: 'The comparison runs in your browser. Nothing is sent.',
  readingNote: (date: string) => `Interest types and school subjects read by machine from the institution’s page, as of ${date}.`,
  contents: 'Content',
  // The programme itself
  aboutTitle: 'What makes this programme',
  focus: 'Focus areas',
  partly: (languages: string) => `partly also ${languages}`,
  afterTitle: 'After the degree',
  careersFrom: (fields: string) => `Typical careers in ${fields}`,
  earningsField: (f: string) => `Median income in ${f}, one year after graduating`,
  earningsNoMatch: 'There is no separate figure for this degree.',
  moreFacts: 'More details',
}

export type ProgrammeText = typeof en

const deCH: ProgrammeText = {
  fitTitle: 'Passt das zu dir?',
  fieldFitTitle: (f) => `Passt ${f} zu dir?`,
  personalTitle: 'Verglichen mit deinen Antworten',
  types: 'Interessentypen',
  barsNote: (f) => `Balken: dieser Studiengang. Strich: ${f} allgemein.`,
  shift: (more, less, f, join) =>
    `${cap([more.length ? `stärker ${join(more)}` : '', less.length ? `weniger ${join(less)}` : ''].filter(Boolean).join(' und '))} als ${f} allgemein.`,
  pro: 'Dafür spricht, wenn dich das anzieht',
  contra: 'Eher nicht, wenn du vor allem das magst',
  fieldOnly: (f) => `Profil des Fachs ${f}. Zu diesem Studiengang liegen keine eigenen Angaben vor.`,
  compare: 'Mit meinen Antworten vergleichen',
  compareHint: 'Fragebogen, etwa 8 Minuten. Passende Fächer siehst du gratis.',
  toResult: 'Zu deinem Resultat',
  personalSummary: (t, tn, i, inN) => `${t} von ${tn} Interessentypen und ${i} von ${inN} Interessen gehören zu deinen stärksten.`,
  clash: (names) => `Du magst ${names}. Das kommt in diesem Studiengang kaum vor.`,
  liked: 'passt zu deinen Antworten',
  personalNote: 'Der Vergleich läuft in deinem Browser. Gesendet wird nichts.',
  readingNote: (date) => `Interessentypen und Schulfächer maschinell aus der Seite der Hochschule gelesen, Stand ${date}.`,
  contents: 'Inhalte',
  aboutTitle: 'Was diesen Studiengang ausmacht',
  focus: 'Schwerpunkte',
  partly: (languages) => `teilweise auch ${languages}`,
  afterTitle: 'Nach dem Studium',
  careersFrom: (fields) => `Typische Berufe aus ${fields}`,
  earningsField: (f) => `Medianlohn im Fach ${f}, ein Jahr nach dem Abschluss`,
  earningsNoMatch: 'Für diesen Abschluss gibt es keinen eigenen Wert.',
  moreFacts: 'Weitere Angaben',
}

const frCH: ProgrammeText = {
  fitTitle: 'Est-ce fait pour toi ?',
  fieldFitTitle: (f) => `${f}, est-ce fait pour toi ?`,
  personalTitle: 'Comparé à tes réponses',
  types: 'Types d’intérêts',
  barsNote: (f) => `Barre : cette filière. Trait : ${f} en général.`,
  shift: (more, less, f, join) =>
    `${cap([more.length ? `plus ${join(more)}` : '', less.length ? `moins ${join(less)}` : ''].filter(Boolean).join(' et '))} que le domaine ${f} en général.`,
  pro: 'Bon signe si cela t’attire',
  contra: 'Moins indiqué si c’est surtout cela que tu aimes',
  fieldOnly: (f) => `Profil du domaine ${f}. Cette filière n’a pas de profil propre.`,
  compare: 'Comparer avec mes réponses',
  compareHint: 'Questionnaire, environ 8 minutes. Les domaines qui te correspondent sont gratuits.',
  toResult: 'Voir ton résultat',
  personalSummary: (t, tn, i, inN) => `${t} types d’intérêts sur ${tn} et ${i} intérêts sur ${inN} font partie de tes plus forts.`,
  clash: (names) => `Tu aimes ${names}, ce qui n’apparaît guère dans cette filière.`,
  liked: 'correspond à tes réponses',
  personalNote: 'La comparaison se fait dans ton navigateur. Rien n’est envoyé.',
  readingNote: (date) => `Types d’intérêts et branches lus automatiquement sur la page de la haute école, état au ${date}.`,
  contents: 'Contenus',
  aboutTitle: 'Ce qui caractérise cette filière',
  focus: 'Orientations',
  partly: (languages) => `en partie aussi ${languages}`,
  afterTitle: 'Après les études',
  careersFrom: (fields) => `Métiers typiques : ${fields}`,
  earningsField: (f) => `Revenu médian en ${f}, un an après le diplôme`,
  earningsNoMatch: 'Il n’existe pas de chiffre propre à ce diplôme.',
  moreFacts: 'Autres informations',
}

const itCH: ProgrammeText = {
  fitTitle: 'Fa per te?',
  fieldFitTitle: (f) => `${f} fa per te?`,
  personalTitle: 'Confrontato con le tue risposte',
  types: 'Tipi di interesse',
  barsNote: (f) => `Barra: questo corso. Linea: ${f} in generale.`,
  shift: (more, less, f, join) =>
    `${cap([more.length ? `più ${join(more)}` : '', less.length ? `meno ${join(less)}` : ''].filter(Boolean).join(' e '))} rispetto all’area ${f} in generale.`,
  pro: 'Buon segno se ti attira',
  contra: 'Meno indicato se ti piace soprattutto questo',
  fieldOnly: (f) => `Profilo dell’area ${f}. Questo corso non ha un profilo proprio.`,
  compare: 'Confronta con le mie risposte',
  compareHint: 'Questionario, circa 8 minuti. Le aree adatte a te sono gratuite.',
  toResult: 'Vai al tuo risultato',
  personalSummary: (t, tn, i, inN) => `${t} tipi di interesse su ${tn} e ${i} interessi su ${inN} sono tra i tuoi più forti.`,
  clash: (names) => `Ti piace ${names}, che in questo corso conta poco.`,
  liked: 'corrisponde alle tue risposte',
  personalNote: 'Il confronto avviene nel tuo browser. Non viene inviato nulla.',
  readingNote: (date) => `Tipi di interesse e materie letti automaticamente dalla pagina della scuola, aggiornato al ${date}.`,
  contents: 'Contenuti',
  aboutTitle: 'Cosa caratterizza questo corso',
  focus: 'Indirizzi',
  partly: (languages) => `in parte anche ${languages}`,
  afterTitle: 'Dopo gli studi',
  careersFrom: (fields) => `Professioni tipiche: ${fields}`,
  earningsField: (f) => `Reddito mediano in ${f}, un anno dopo il diploma`,
  earningsNoMatch: 'Per questo titolo non esiste un dato proprio.',
  moreFacts: 'Altre informazioni',
}

const deDE = regionalizeDeep(deCH, 'de-DE')
const deAT = regionalizeDeep(deCH, 'de-AT')

export function programmePageText(locale: Locale): ProgrammeText {
  return { en, 'de-CH': deCH, 'de-DE': deDE, 'de-AT': deAT, 'fr-CH': frCH, 'it-CH': itCH }[locale]
}
