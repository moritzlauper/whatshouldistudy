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

const frCH: OrgsText = {
  nav: 'Pour les écoles',
  title: 'Pour les écoles et les services d’orientation',
  lead: 'Offrez le rapport complet à vos élèves. Ils font l’analyse dans leur propre navigateur, vous partagez un seul lien, et chaque rapport complet débloqué par ce lien compte dans votre abonnement. Ni vous ni nous ne voyons leurs données.',
  yearly: 'Annuel',
  monthly: 'Mensuel',
  save: '17% d’économie, deux mois offerts',
  perMonth: '/ mois',
  billedYearly: (total: string) => `facturé annuellement : ${total}`,
  billedMonthly: 'facturé mensuellement, résiliable à tout moment',
  recommended: 'Recommandé',
  tiers: {
    counsellor: { name: 'Conseil', who: 'Conseillères et conseillers indépendants, petites écoles' },
    school: { name: 'École', who: 'Écoles et centres d’orientation' },
    institution: { name: 'Institution', who: 'Hautes écoles, administrations de l’éducation, grands réseaux' },
  },
  reports: (n: string | null) => (n === null ? 'Rapports complets illimités' : `${n} rapports complets par mois`),
  features: ['Un seul lien pour tous vos élèves', 'Rapport complet avec chaque formation qui correspond', 'Les données des élèves restent dans leur navigateur', 'Factures avec votre adresse et votre numéro TVA', 'L’utilisation du mois en un coup d’œil'],
  cta: 'Commencer l’abonnement',
  opening: 'Ouverture du paiement …',
  failed: 'Le paiement n’a pas pu démarrer.',
  stepsTitle: 'Comment ça marche',
  steps: [
    'Abonnez-vous. Vous recevez deux liens : un pour vos élèves et un pour gérer l’abonnement.',
    'Partagez le lien élèves, en classe, par e-mail ou sur votre intranet.',
    'Les élèves font l’analyse eux-mêmes. Chaque élève qui débloque le rapport complet utilise un rapport de votre abonnement.',
  ],
  faqTitle: 'Questions',
  faq: [
    ['Qu’est-ce qui compte comme rapport ?', 'Un ou une élève qui débloque le rapport complet des formations par votre lien. La partie gratuite, les domaines d’études et le résultat, ne compte jamais. L’accès reste ouvert 12 mois.'],
    ['Et si nous dépassons notre abonnement ?', 'Une fois les rapports du mois utilisés, les élèves voient un avis et peuvent toujours acheter le rapport eux-mêmes. Le compteur repart le premier de chaque mois. Vous pouvez passer à un abonnement plus grand à tout moment dans le portail client.'],
    ['Voyez-vous les données de nos élèves ?', 'Non. L’analyse tourne dans le navigateur de chaque élève. Nous comptons seulement combien de rapports votre lien a débloqués, pas qui les a débloqués ni ce qui en est sorti.'],
    ['Pouvons-nous payer sur facture ?', 'Stripe envoie une facture pour chaque paiement, avec votre adresse et votre numéro TVA. Pour un abonnement annuel payé par virement, écrivez-nous.'],
    ['Comment résilier ?', 'Dans le portail client, accessible depuis votre tableau de bord. L’abonnement court jusqu’à la fin de la période payée.'],
  ] as Array<[string, string]>,
  contact: 'Besoin d’autre chose, d’un projet pilote ou d’un autre nombre de rapports ? Écrivez à',
  metaDesc: (thousand: string) => `Abonnements pour écoles et services d’orientation : un lien pour tous les élèves, 100, ${thousand} ou un nombre illimité de rapports complets par mois, facturés annuellement ou mensuellement.`,

  welcome: {
    working: 'Activation de votre abonnement …',
    title: 'Votre abonnement est actif',
    inactive: 'Cet abonnement n’est plus actif.',
    failed: 'Une erreur s’est produite',
    plan: (name: string) => `Abonnement : ${name}`,
    used: (n: string, limit: string | null) => (limit === null ? `${n} rapports utilisés ce mois-ci` : `${n} rapports sur ${limit} utilisés ce mois-ci`),
    lag: 'Le compteur peut avoir quelques minutes de retard.',
    studentLink: 'Lien pour vos élèves',
    studentHint: 'Partagez ce lien. Les élèves qui l’ouvrent peuvent débloquer le rapport complet grâce à votre abonnement.',
    adminLink: 'Votre tableau de bord',
    adminHint: 'Ajoutez cette page à vos favoris. Son adresse est le chemin vers votre tableau de bord et le portail client, gardez-la pour vous.',
    copy: 'Copier',
    copied: 'Copié',
    portal: 'Factures, paiement et résiliation',
    charged: 'Si vous avez été débité, répondez à votre reçu Stripe et nous réglerons cela.',
  },

  student: {
    via: 'Débloquer via votre école',
    note: 'Votre école ou votre service d’orientation prend ce rapport en charge.',
    limit: 'Votre école a utilisé tous les rapports de ce mois. Vous pouvez toujours acheter le rapport vous-même.',
    inactive: 'Le lien de votre école n’est plus actif.',
    failed: 'Le déblocage a échoué.',
  },
}

const itCH: OrgsText = {
  nav: 'Per le scuole',
  title: 'Per scuole e servizi di orientamento',
  lead: 'Date ai vostri studenti il report completo. Fanno l’analisi nel proprio browser, voi condividete un solo link, e ogni report completo sbloccato tramite quel link conta nel vostro abbonamento. Né voi né noi vediamo i loro dati.',
  yearly: 'Annuale',
  monthly: 'Mensile',
  save: 'Risparmiate il 17%, due mesi gratis',
  perMonth: '/ mese',
  billedYearly: (total: string) => `fatturato annualmente: ${total}`,
  billedMonthly: 'fatturato mensilmente, disdicibile in qualsiasi momento',
  recommended: 'Consigliato',
  tiers: {
    counsellor: { name: 'Consulenza', who: 'Consulenti indipendenti e piccole scuole' },
    school: { name: 'Scuola', who: 'Scuole e centri di orientamento' },
    institution: { name: 'Istituzione', who: 'Università, autorità scolastiche, grandi reti' },
  },
  reports: (n: string | null) => (n === null ? 'Report completi illimitati' : `${n} report completi al mese`),
  features: ['Un solo link per tutti i vostri studenti', 'Report completo con ogni corso di studio adatto', 'I dati degli studenti restano nel loro browser', 'Fatture con il vostro indirizzo e numero IVA', 'L’utilizzo del mese a colpo d’occhio'],
  cta: 'Inizia l’abbonamento',
  opening: 'Apertura del pagamento …',
  failed: 'Impossibile avviare il pagamento.',
  stepsTitle: 'Come funziona',
  steps: [
    'Abbonatevi. Ricevete due link: uno per i vostri studenti e uno per gestire l’abbonamento.',
    'Condividete il link per gli studenti, in classe, via e-mail o sulla vostra intranet.',
    'Gli studenti fanno l’analisi da soli. Ogni studente che sblocca il report completo usa un report del vostro abbonamento.',
  ],
  faqTitle: 'Domande',
  faq: [
    ['Cosa conta come report?', 'Uno studente che sblocca il report completo dei corsi tramite il vostro link. La parte gratuita, i campi di studio e il risultato, non conta mai. L’accesso resta valido 12 mesi.'],
    ['E se ci serve più del nostro abbonamento?', 'Esauriti i report del mese, gli studenti vedono un avviso e possono comunque acquistare il report da soli. Il conteggio riparte il primo di ogni mese. Potete passare a un abbonamento più grande in qualsiasi momento nel portale clienti.'],
    ['Vedete i dati dei nostri studenti?', 'No. L’analisi avviene nel browser di ogni studente. Contiamo solo quanti report ha sbloccato il vostro link, non chi li ha sbloccati né cosa ne è risultato.'],
    ['Possiamo pagare con fattura?', 'Stripe invia una fattura per ogni pagamento, con il vostro indirizzo e numero IVA. Per un abbonamento annuale pagato con bonifico, scriveteci.'],
    ['Come si disdice?', 'Nel portale clienti, raggiungibile dalla vostra dashboard. L’abbonamento resta attivo fino alla fine del periodo pagato.'],
  ] as Array<[string, string]>,
  contact: 'Vi serve altro, un progetto pilota o un numero diverso di report? Scrivete a',
  metaDesc: (thousand: string) => `Abbonamenti per scuole e servizi di orientamento: un link per tutti gli studenti, 100, ${thousand} o report completi illimitati al mese, fatturati annualmente o mensilmente.`,

  welcome: {
    working: 'Attivazione dell’abbonamento …',
    title: 'Il vostro abbonamento è attivo',
    inactive: 'Questo abbonamento non è più attivo.',
    failed: 'Qualcosa è andato storto',
    plan: (name: string) => `Abbonamento: ${name}`,
    used: (n: string, limit: string | null) => (limit === null ? `${n} report usati questo mese` : `${n} di ${limit} report usati questo mese`),
    lag: 'Il conteggio può avere qualche minuto di ritardo.',
    studentLink: 'Link per i vostri studenti',
    studentHint: 'Condividete questo link. Gli studenti che lo aprono possono sbloccare il report completo con il vostro abbonamento.',
    adminLink: 'La vostra dashboard',
    adminHint: 'Salvate questa pagina nei preferiti. Il suo indirizzo è la via per la dashboard e il portale clienti, quindi tenetelo per voi.',
    copy: 'Copia',
    copied: 'Copiato',
    portal: 'Fatture, pagamento e disdetta',
    charged: 'Se vi è stato addebitato un importo, rispondete alla ricevuta Stripe e sistemeremo tutto.',
  },

  student: {
    via: 'Sblocca tramite la tua scuola',
    note: 'Paga la tua scuola o il tuo servizio di orientamento.',
    limit: 'La tua scuola ha esaurito i report di questo mese. Puoi comunque acquistare il report da solo.',
    inactive: 'Il link della tua scuola non è più attivo.',
    failed: 'Sblocco non riuscito.',
  },
}

const TEXTS: Record<Locale, OrgsText> = { en, 'de-CH': deCH, 'de-DE': regionalizeDeep(deCH, 'de-DE'), 'de-AT': regionalizeDeep(deCH, 'de-AT'), 'fr-CH': frCH, 'it-CH': itCH }

export const orgsText = (locale: Locale): OrgsText => TEXTS[locale]
