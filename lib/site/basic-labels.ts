import type { BasicKey } from '../taxonomy/basic-interests.ts'
import type { Locale } from './config.ts'

/** Names of the basic interests as shown in results and reasons. */
const NAMES: Record<'de' | 'en' | 'fr' | 'it', Record<BasicKey, string>> = {
  de: {
    mechanics: 'Mechanik', construction: 'Bauen und Handwerk', engineering: 'Ingenieurwesen', agriculture: 'Landwirtschaft und Natur',
    protective: 'Sicherheit und Ermittlung', physicalScience: 'Physik, Chemie, Erde und All', lifeScience: 'Biologie',
    medicalScience: 'Medizinische Forschung', math: 'Mathematik', socialScience: 'Sozialwissenschaften', humanities: 'Geisteswissenschaften',
    design: 'Gestaltung', arts: 'Bildende Kunst', music: 'Musik', writing: 'Schreiben', media: 'Medien', teaching: 'Unterrichten',
    counseling: 'Beraten und begleiten', management: 'Führen und leiten', sales: 'Verkauf und Marketing', law: 'Recht und Politik',
    finance: 'Finanzen und Rechnungswesen', computing: 'Informatik',
  },
  en: {
    mechanics: 'Mechanics', construction: 'Construction and woodwork', engineering: 'Engineering', agriculture: 'Agriculture and nature',
    protective: 'Safety and investigation', physicalScience: 'Physical sciences', lifeScience: 'Life sciences',
    medicalScience: 'Medical research', math: 'Mathematics', socialScience: 'Social sciences', humanities: 'Humanities',
    design: 'Design', arts: 'Visual arts', music: 'Music', writing: 'Writing', media: 'Media', teaching: 'Teaching',
    counseling: 'Counselling', management: 'Management', sales: 'Sales and marketing', law: 'Law and government',
    finance: 'Finance and accounting', computing: 'Computing',
  },
  fr: {
    mechanics: 'Mécanique', construction: 'Construction et menuiserie', engineering: 'Ingénierie', agriculture: 'Agriculture et nature',
    protective: 'Sécurité et enquête', physicalScience: 'Sciences physiques', lifeScience: 'Sciences de la vie',
    medicalScience: 'Recherche médicale', math: 'Mathématiques', socialScience: 'Sciences sociales', humanities: 'Sciences humaines',
    design: 'Design', arts: 'Arts visuels', music: 'Musique', writing: 'Écriture', media: 'Médias', teaching: 'Enseignement',
    counseling: 'Conseil et accompagnement', management: 'Gestion et direction', sales: 'Vente et marketing', law: 'Droit et politique',
    finance: 'Finance et comptabilité', computing: 'Informatique',
  },
  it: {
    mechanics: 'Meccanica', construction: 'Costruzioni e falegnameria', engineering: 'Ingegneria', agriculture: 'Agricoltura e natura',
    protective: 'Sicurezza e indagini', physicalScience: 'Scienze fisiche', lifeScience: 'Scienze della vita',
    medicalScience: 'Ricerca medica', math: 'Matematica', socialScience: 'Scienze sociali', humanities: 'Scienze umane',
    design: 'Design', arts: 'Arti visive', music: 'Musica', writing: 'Scrittura', media: 'Media', teaching: 'Insegnamento',
    counseling: 'Consulenza e sostegno', management: 'Gestione e direzione', sales: 'Vendite e marketing', law: 'Diritto e politica',
    finance: 'Finanza e contabilità', computing: 'Informatica',
  },
}

export const basicLabel = (key: BasicKey, locale: Locale) =>
  NAMES[locale.startsWith('de') ? 'de' : locale.startsWith('fr') ? 'fr' : locale.startsWith('it') ? 'it' : 'en'][key]
