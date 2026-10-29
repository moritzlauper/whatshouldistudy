import type { BasicKey } from '../taxonomy/basic-interests.ts'
import type { Locale } from './config.ts'

/** Names of the basic interests as shown in results and reasons. */
const NAMES: Record<'de' | 'en' | 'fr' | 'it', Record<BasicKey, string>> = {
  de: {
    mechanics: 'Mechanik', construction: 'Bauen und Handwerk', engineering: 'Ingenieurwesen', agriculture: 'Landwirtschaft und Natur',
    protective: 'Sicherheit und Ermittlung',
    medicalScience: 'Medizinische Forschung', socialScience: 'Sozialwissenschaften',
    design: 'Gestaltung', media: 'Medien', teaching: 'Unterrichten',
    counseling: 'Beraten und begleiten', management: 'Führen und leiten', sales: 'Verkauf und Marketing', law: 'Recht und Politik',
    finance: 'Finanzen und Rechnungswesen',
  },
  en: {
    mechanics: 'Mechanics', construction: 'Construction and woodwork', engineering: 'Engineering', agriculture: 'Agriculture and nature',
    protective: 'Safety and investigation',
    medicalScience: 'Medical research', socialScience: 'Social sciences',
    design: 'Design', media: 'Media', teaching: 'Teaching',
    counseling: 'Counselling', management: 'Management', sales: 'Sales and marketing', law: 'Law and government',
    finance: 'Finance and accounting',
  },
  fr: {
    mechanics: 'Mécanique', construction: 'Construction et menuiserie', engineering: 'Ingénierie', agriculture: 'Agriculture et nature',
    protective: 'Sécurité et enquête',
    medicalScience: 'Recherche médicale', socialScience: 'Sciences sociales',
    design: 'Design', media: 'Médias', teaching: 'Enseignement',
    counseling: 'Conseil et accompagnement', management: 'Gestion et direction', sales: 'Vente et marketing', law: 'Droit et politique',
    finance: 'Finance et comptabilité',
  },
  it: {
    mechanics: 'Meccanica', construction: 'Costruzioni e falegnameria', engineering: 'Ingegneria', agriculture: 'Agricoltura e natura',
    protective: 'Sicurezza e indagini',
    medicalScience: 'Ricerca medica', socialScience: 'Scienze sociali',
    design: 'Design', media: 'Media', teaching: 'Insegnamento',
    counseling: 'Consulenza e sostegno', management: 'Gestione e direzione', sales: 'Vendite e marketing', law: 'Diritto e politica',
    finance: 'Finanza e contabilità',
  },
}

export const basicLabel = (key: BasicKey, locale: Locale) =>
  NAMES[locale.startsWith('de') ? 'de' : locale.startsWith('fr') ? 'fr' : locale.startsWith('it') ? 'it' : 'en'][key]
