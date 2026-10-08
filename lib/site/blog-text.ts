import { regionalizeDeep } from './regional.ts'
import type { Locale } from './config.ts'

/** Text around the blog posts: index page, article frame, call to action. */

const en = {
  nav: 'Blog',
  title: 'Blog',
  lead: 'A new article every week on choosing a degree: fields, admission, costs, salaries and studying abroad, each with its sources.',
  metaTitle: 'Blog: choosing what to study',
  metaDesc: 'Weekly articles on choosing a degree: fields of study, admission, costs, graduate salaries and studying abroad, with sources.',
  empty: 'The first article is on its way.',
  published: (date: string) => `Published ${date}`,
  read: 'Read the article',
  back: 'All articles',
  fields: 'Fields in this article',
  sources: 'Sources',
  aiNote: 'This article was researched and written with AI and checked against the sources listed below. If you spot a mistake, write to us.',
  ctaTitle: 'Which field fits you?',
  ctaText: 'The questionnaire takes about ten minutes and compares your interests with 80 fields of study. The result is free.',
  ctaButton: 'Start the questionnaire',
}

export type BlogText = typeof en

const deCH: BlogText = {
  nav: 'Blog',
  title: 'Blog',
  lead: 'Jede Woche ein neuer Artikel zur Studienwahl: Fächer, Zulassung, Kosten, Löhne und Studium im Ausland, jeweils mit Quellen.',
  metaTitle: 'Blog zur Studienwahl',
  metaDesc: 'Wöchentliche Artikel zur Studienwahl: Studienfächer, Zulassung, Kosten, Löhne nach dem Studium und Studium im Ausland, mit Quellen.',
  empty: 'Der erste Artikel ist in Arbeit.',
  published: (date: string) => `Veröffentlicht am ${date}`,
  read: 'Artikel lesen',
  back: 'Alle Artikel',
  fields: 'Fächer in diesem Artikel',
  sources: 'Quellen',
  aiNote: 'Dieser Artikel wurde mit KI recherchiert und geschrieben und mit den Quellen unten abgeglichen. Wenn dir ein Fehler auffällt, schreib uns.',
  ctaTitle: 'Welches Fach passt zu dir?',
  ctaText: 'Der Fragebogen dauert etwa zehn Minuten und vergleicht deine Interessen mit 80 Studienfächern. Das Resultat ist gratis.',
  ctaButton: 'Zum Fragebogen',
}

const TEXTS: Partial<Record<Locale, BlogText>> = { en, 'de-CH': deCH, 'de-DE': regionalizeDeep(deCH, 'de-DE'), 'de-AT': regionalizeDeep(deCH, 'de-AT') }

/** French and Italian have no blog. */
export const blogText = (locale: Locale): BlogText | null => TEXTS[locale] ?? null
