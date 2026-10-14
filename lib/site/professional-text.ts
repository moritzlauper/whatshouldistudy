import type { Locale } from './config.ts'

/** Short notices stay translated even where the full manual is available in English. */
export function professionalText(locale: Locale) {
  if (locale.startsWith('de-')) return {
    title: 'Verfahrensmanual und Fachinformationen',
    link: 'Manual, Datenschutz und Validierungsstand',
    notice: 'Eine Orientierungshilfe, kein validiertes diagnostisches Instrument. Für das Gesamtverfahren fehlen bisher empirische Nachweise zur Reliabilität und Validität.',
    institution: 'Für Schulen und Beratungsstellen: Vor einem Einsatz sind die eigenen Datenschutz- und KI-Vorgaben zu prüfen. Diese Dokumentation ist keine behördliche Freigabe.',
  }
  if (locale === 'fr-CH') return {
    title: 'Manuel et informations professionnelles (en anglais)',
    link: 'Manuel, protection des données et validation (en anglais)',
    notice: 'Un outil d’orientation, pas un instrument diagnostique validé. La fiabilité et la validité de la procédure complète ne sont pas encore démontrées empiriquement.',
    institution: 'Écoles et services de conseil : vérifiez vos règles de protection des données et d’utilisation de l’IA avant tout usage. Cette documentation ne constitue pas une autorisation officielle.',
  }
  if (locale === 'it-CH') return {
    title: 'Manuale e informazioni professionali (in inglese)',
    link: 'Manuale, protezione dei dati e validazione (in inglese)',
    notice: 'Uno strumento di orientamento, non uno strumento diagnostico validato. Affidabilità e validità dell’intera procedura non sono ancora dimostrate empiricamente.',
    institution: 'Scuole e servizi di consulenza: verificate le vostre regole sulla protezione dei dati e sull’IA prima dell’uso. Questa documentazione non è un’autorizzazione ufficiale.',
  }
  return {
    title: 'Procedure manual and professional information',
    link: 'Manual, data protection and validation status',
    notice: 'An exploration tool, not a validated diagnostic instrument. Empirical evidence of reliability and validity for the complete procedure is not yet available.',
    institution: 'Schools and counselling services must check their own data protection and AI policies before use. This documentation is not institutional approval.',
  }
}
