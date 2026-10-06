import { regionalizeDeep } from './regional.ts'
import type { Locale } from './config.ts'
import type { OrgTier } from '../pricing.ts'

/**
 * Text for the organisation plans: the pricing page, the dashboard after
 * subscribing and the student's unlock through a school link. German addresses
 * organisations with «Sie», students with «du» like the rest of the site.
 */

const en = {
  nav: 'For schools',
  title: 'For schools and counselling services',
  lead: 'Give your students the full report. They run the analysis in their own browser, you share one link, and every full report unlocked through it counts towards your plan. Neither you nor we see their data.',
  yearly: 'Yearly',
  monthly: 'Monthly',
  save: 'Save 17%, two months free',
  perMonth: '/ month',
  billedYearly: (total: string) => `billed yearly: ${total}`,
  billedMonthly: 'billed monthly, cancel any time',
  recommended: 'Recommended',
  tiers: {
    counsellor: { name: 'Counsellor', who: 'Independent counsellors and small schools' },
    school: { name: 'School', who: 'Schools and career centres' },
    institution: { name: 'Institution', who: 'Universities, education authorities, large networks' },
  } satisfies Record<OrgTier, { name: string; who: string }>,
  reports: (n: string | null) => (n === null ? 'Unlimited full reports' : `${n} full reports a month`),
  features: ['One link for all your students', 'Full report with every matching programme', 'Student data stays in their browser', 'Invoices with your address and tax number', 'This month’s use at a glance'],
  cta: 'Start subscription',
  opening: 'Opening checkout …',
  failed: 'Could not start checkout.',
  stepsTitle: 'How it works',
  steps: [
    'Subscribe. You get two links: one for your students and one for you to manage the plan.',
    'Share the student link, in class, by email or on your intranet.',
    'Students run the analysis themselves. Each one who unlocks the full report uses one report of your plan.',
  ],
  faqTitle: 'Questions',
  faq: [
    ['What counts as a report?', 'One student unlocking the full programme report through your link. The free part, fields of study and the result, never counts. A student who unlocks keeps access for 12 months.'],
    ['What if we need more than our plan?', 'Once this month’s reports are used up, students see a note and can still buy the report themselves. The count starts again on the first of each month. You can move to a larger plan at any time in the customer portal.'],
    ['Do you see our students’ data?', 'No. The analysis runs in each student’s browser. We only count how many reports your link unlocked, not who unlocked them or what came out.'],
    ['Can we pay by invoice?', 'Stripe sends an invoice for every payment, with your address and tax number. For a yearly plan paid by bank transfer, write to us.'],
    ['How do we cancel?', 'In the customer portal, linked from your dashboard. The plan runs until the end of the period you paid for.'],
  ] as Array<[string, string]>,
  contact: 'Need something else, such as a pilot or a different number of reports? Write to',
  metaDesc: (thousand: string) => `Plans for schools and counselling services: one link for all students, 100, ${thousand} or unlimited full reports a month, billed yearly or monthly.`,

  welcome: {
    working: 'Setting up your plan …',
    title: 'Your plan is active',
    inactive: 'This subscription is no longer active.',
    failed: 'Something went wrong',
    plan: (name: string) => `Plan: ${name}`,
    used: (n: string, limit: string | null) => (limit === null ? `${n} reports used this month` : `${n} of ${limit} reports used this month`),
    lag: 'The count can trail by a few minutes.',
    studentLink: 'Link for your students',
    studentHint: 'Share this link. Students who open it can unlock the full report through your plan.',
    adminLink: 'Your dashboard',
    adminHint: 'Bookmark this page. Its address is the way back to your dashboard and to the customer portal, so keep it to yourself.',
    copy: 'Copy',
    copied: 'Copied',
    portal: 'Invoices, payment and cancelling',
    charged: 'If you were charged, reply to your Stripe receipt and we’ll sort it out.',
  },

  student: {
    via: 'Unlock through your school',
    note: 'Your school or counselling service pays for this.',
    limit: 'Your school has used up this month’s reports. You can still buy the report yourself.',
    inactive: 'Your school’s link is no longer active.',
    failed: 'Could not unlock.',
  },
}

export type OrgsText = typeof en

const deCH: OrgsText = {
  nav: 'Für Schulen',
  title: 'Für Schulen und Beratungsstellen',
  lead: 'Geben Sie Ihren Schülerinnen und Schülern den vollen Report. Die Jugendlichen machen die Analyse in ihrem eigenen Browser, Sie teilen einen Link, und jeder volle Report, der darüber freigeschaltet wird, zählt zu Ihrem Abo. Die Daten der Jugendlichen sehen weder Sie noch wir.',
  yearly: 'Jährlich',
  monthly: 'Monatlich',
  save: '17% günstiger, zwei Monate gratis',
  perMonth: '/ Monat',
  billedYearly: (total: string) => `jährlich abgerechnet: ${total}`,
  billedMonthly: 'monatlich abgerechnet, jederzeit kündbar',
  recommended: 'Empfohlen',
  tiers: {
    counsellor: { name: 'Beratung', who: 'Laufbahnberatung und kleine Schulen' },
    school: { name: 'Schule', who: 'Schulen und Berufsberatungen' },
    institution: { name: 'Institution', who: 'Hochschulen, Bildungsverwaltungen, grosse Netzwerke' },
  },
  reports: (n: string | null) => (n === null ? 'Unbegrenzt volle Reports' : `${n} volle Reports pro Monat`),
  features: ['Ein Link für alle Ihre Schülerinnen und Schüler', 'Voller Report mit jedem passenden Studiengang', 'Die Daten bleiben im Browser der Jugendlichen', 'Rechnung mit Ihrer Adresse und Steuernummer', 'Verbrauch des Monats jederzeit sichtbar'],
  cta: 'Abo starten',
  opening: 'Checkout wird geöffnet …',
  failed: 'Der Checkout liess sich nicht starten.',
  stepsTitle: 'So funktioniert es',
  steps: [
    'Abo abschliessen. Sie erhalten zwei Links: einen für Ihre Schülerinnen und Schüler und einen, mit dem Sie das Abo verwalten.',
    'Den Link für die Jugendlichen teilen, im Unterricht, per Mail oder im Intranet.',
    'Die Jugendlichen machen die Analyse selbst. Wer den vollen Report freischaltet, verbraucht einen Report Ihres Abos.',
  ],
  faqTitle: 'Fragen',
  faq: [
    ['Was zählt als Report?', 'Wenn jemand über Ihren Link den vollen Studiengang-Report freischaltet. Der kostenlose Teil, also Studienfelder und Ergebnis, zählt nie. Wer einmal freigeschaltet hat, behält den Zugang 12 Monate.'],
    ['Was, wenn wir mehr brauchen?', 'Sind die Reports des Monats aufgebraucht, sehen die Jugendlichen einen Hinweis und können den Report selbst kaufen. Am Ersten jedes Monats beginnt die Zählung neu. Im Kundenportal wechseln Sie jederzeit in ein grösseres Abo.'],
    ['Sehen Sie die Daten unserer Jugendlichen?', 'Nein. Die Analyse läuft im Browser der Jugendlichen. Wir zählen nur, wie viele Reports Ihr Link freigeschaltet hat, nicht wer und mit welchem Ergebnis.'],
    ['Können wir auf Rechnung zahlen?', 'Stripe stellt für jede Zahlung eine Rechnung mit Ihrer Adresse und Steuernummer aus. Für ein Jahresabo mit Zahlung per Überweisung schreiben Sie uns.'],
    ['Wie kündigen wir?', 'Im Kundenportal, verlinkt in Ihrer Übersicht. Das Abo läuft bis zum Ende der bezahlten Periode.'],
  ],
  contact: 'Brauchen Sie etwas anderes, etwa einen Pilotversuch oder eine andere Anzahl Reports? Schreiben Sie an',
  metaDesc: (thousand: string) => `Abos für Schulen und Beratungsstellen: ein Link für alle Jugendlichen, 100, ${thousand} oder unbegrenzt volle Reports pro Monat, jährlich oder monatlich abgerechnet.`,

  welcome: {
    working: 'Ihr Abo wird eingerichtet …',
    title: 'Ihr Abo ist aktiv',
    inactive: 'Dieses Abo ist nicht mehr aktiv.',
    failed: 'Etwas ist schiefgelaufen',
    plan: (name: string) => `Abo: ${name}`,
    used: (n: string, limit: string | null) => (limit === null ? `${n} Reports in diesem Monat verbraucht` : `${n} von ${limit} Reports in diesem Monat verbraucht`),
    lag: 'Die Zählung kann ein paar Minuten hinterherhinken.',
    studentLink: 'Link für Ihre Schülerinnen und Schüler',
    studentHint: 'Teilen Sie diesen Link. Wer ihn öffnet, kann den vollen Report über Ihr Abo freischalten.',
    adminLink: 'Ihre Übersicht',
    adminHint: 'Setzen Sie ein Lesezeichen auf diese Seite. Über ihre Adresse kommen Sie zurück zur Übersicht und ins Kundenportal, geben Sie sie deshalb nicht weiter.',
    copy: 'Kopieren',
    copied: 'Kopiert',
    portal: 'Rechnungen, Zahlung und Kündigung',
    charged: 'Falls Ihnen etwas belastet wurde, antworten Sie auf die Quittung von Stripe, dann klären wir das.',
  },

  student: {
    via: 'Über deine Schule freischalten',
    note: 'Das bezahlt deine Schule oder Beratungsstelle.',
    limit: 'Deine Schule hat die Reports für diesen Monat aufgebraucht. Du kannst den Report trotzdem selbst kaufen.',
    inactive: 'Der Link deiner Schule ist nicht mehr aktiv.',
    failed: 'Freischalten hat nicht geklappt.',
  },
}

const TEXTS: Record<Locale, OrgsText> = { en, 'de-CH': deCH, 'de-DE': regionalizeDeep(deCH, 'de-DE'), 'de-AT': regionalizeDeep(deCH, 'de-AT') }

export const orgsText = (locale: Locale): OrgsText => TEXTS[locale]
