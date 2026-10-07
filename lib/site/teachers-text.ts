import { regionalizeDeep } from './regional.ts'
import type { Locale } from './config.ts'

/**
 * Text for the teachers' page: a free lesson on choosing a degree with a
 * printable worksheet, and a link schools can put on their own website.
 * Teachers are addressed with «Sie», the worksheet speaks to students with «du».
 */

const en = {
  nav: 'For teachers',
  title: 'Choosing a degree, in class',
  lead: 'A 45-minute lesson in which your students find out which fields of study fit their interests. All you need is this page, one device per student and the worksheet below. The lesson and the questionnaire are free, and nobody has to sign up.',
  metaTitle: 'Choosing a degree in class: lesson plan and worksheet',
  metaDesc: 'A 45-minute lesson on choosing a degree, for teachers: lesson plan, printable worksheet and a free questionnaire with no sign-up.',
  free: 'Free',
  minutes: (n: number) => `${n} min`,
  flowTitle: 'Lesson plan',
  flow: (start: string) => [
    { min: 5, title: 'Warm-up', text: 'Everyone writes down on the worksheet three fields of study they can picture themselves in today. Anyone without an idea yet writes that down too.' },
    { min: 10, title: 'Questionnaire', text: `The class opens ${start} and answers the questionnaire on interests, personality, school subjects and values. It has about 60 short questions, most students are done in 5 to 10 minutes. At home they can add YouTube, Instagram, TikTok or GitHub later; in class the questionnaire is enough.` },
    { min: 15, title: 'Read the result', text: 'Each student notes their top three fields and opens the page of one of them. It shows who the field suits, which school subjects it builds on and where it leads.' },
    { min: 10, title: 'Compare in pairs', text: 'In pairs, students compare the result with the three fields they wrote down at the start: what matches and what surprised them. The answers go on the worksheet.' },
    { min: 5, title: 'Next step', text: 'To finish, everyone sets one concrete next step with a date, such as an open day, a talk with the careers adviser or sitting in on a university lecture.' },
  ],
  notesTitle: 'Good to know',
  notes: (price: string) => [
    'Answers stay in the student’s browser. There is no account, and neither you nor we see who answered what.',
    'One laptop, tablet or phone per student is enough. The questionnaire works on small screens too.',
    `Fields and result are free. The list of every matching programme costs ${price}, and the lesson doesn’t need it.`,
    'Students under 16 should talk to their parents before connecting an account. The questionnaire connects nothing.',
  ],
  sheetTitle: 'Worksheet',
  sheetLead: 'One A4 page. Print it or project the questions.',
  print: 'Print worksheet',
  sheet: {
    heading: 'What should I study?',
    name: 'Name',
    date: 'Date',
    questions: [
      'Three fields of study I can picture myself in today:',
      'My top three fields in the result:',
      'What matches my list, and what surprised me:',
      'One field I want to look at more closely, and why:',
      'My next step, and by when:',
    ],
  },
  linkTitle: 'Link from your school website',
  linkLead: 'Many schools keep a list of tests and advice services on their page about choosing a degree. If you would like to add us, you can use this text and link.',
  anchor: (name: string) => `${name}: what should I study?`,
  blurb: 'A free questionnaire on interests, personality and school subjects that suggests fitting fields of study. No sign-up needed.',
  textLabel: 'Text',
  htmlLabel: 'HTML',
  copy: 'Copy',
  copied: 'Copied',
  pilotTitle: 'The full report for the whole class',
  pilotText: 'With the Counsellor plan your students also unlock the list of matching programmes, paid for by the school. The first 30 days are a free pilot for up to 30 reports.',
  pilotCta: 'Start the pilot',
}

export type TeachersText = typeof en

const deCH: TeachersText = {
  nav: 'Für Lehrpersonen',
  title: 'Studienwahl im Unterricht',
  lead: 'Eine Lektion von 45 Minuten, in der Ihre Schülerinnen und Schüler herausfinden, welche Studienfächer zu ihren Interessen passen. Sie brauchen dafür nur diese Seite, ein Gerät pro Person und das Arbeitsblatt unten. Die Lektion und der Fragebogen sind kostenlos, und niemand muss sich anmelden.',
  metaTitle: 'Studienwahl im Unterricht: Lektion mit Arbeitsblatt',
  metaDesc: 'Eine Lektion von 45 Minuten zur Studienwahl für Lehrpersonen: Ablauf, Arbeitsblatt zum Ausdrucken und ein kostenloser Fragebogen ohne Anmeldung.',
  free: 'Kostenlos',
  minutes: (n: number) => `${n} Min.`,
  flowTitle: 'Ablauf',
  flow: (start: string) => [
    { min: 5, title: 'Einstieg', text: 'Alle schreiben auf dem Arbeitsblatt drei Studienfächer auf, die sie sich heute vorstellen können. Wer noch keine Idee hat, schreibt das hin.' },
    { min: 10, title: 'Fragebogen', text: `Die Klasse öffnet ${start} und beantwortet den Fragebogen zu Interessen, Persönlichkeit, Schulfächern und Werten. Er hat rund 60 kurze Fragen, die meisten sind nach 5 bis 10 Minuten fertig. Zu Hause lassen sich später YouTube, Instagram, TikTok oder GitHub dazunehmen, im Unterricht reicht der Fragebogen.` },
    { min: 15, title: 'Resultat lesen', text: 'Jede Person notiert ihre drei besten Studienfelder und öffnet die Seite von einem davon. Dort steht, für wen das Fach passt, auf welchen Schulfächern es aufbaut und wohin es führt.' },
    { min: 10, title: 'Zu zweit vergleichen', text: 'Zu zweit vergleichen die Jugendlichen das Resultat mit den drei Fächern vom Anfang: was sich deckt und was sie überrascht hat. Die Antworten kommen auf das Arbeitsblatt.' },
    { min: 5, title: 'Nächster Schritt', text: 'Zum Schluss legt jede Person einen konkreten nächsten Schritt mit Datum fest, zum Beispiel den Infotag einer Hochschule, ein Gespräch mit der Studienberatung oder den Besuch einer Vorlesung.' },
  ],
  notesTitle: 'Gut zu wissen',
  notes: (price: string) => [
    'Die Antworten bleiben im Browser der Jugendlichen. Es braucht kein Konto, und weder Sie noch wir sehen, wer was angekreuzt hat.',
    'Ein Laptop, Tablet oder Handy pro Person genügt. Der Fragebogen funktioniert auch auf kleinen Bildschirmen.',
    `Fächer und Resultat sind gratis. Die Liste aller passenden Studiengänge kostet ${price}, für die Lektion braucht es sie nicht.`,
    'Wer jünger als 16 ist, sollte mit den Eltern sprechen, bevor er oder sie ein Konto verbindet. Beim Fragebogen wird nichts verbunden.',
  ],
  sheetTitle: 'Arbeitsblatt',
  sheetLead: 'Eine Seite A4. Drucken Sie sie aus oder projizieren Sie die Fragen.',
  print: 'Arbeitsblatt drucken',
  sheet: {
    heading: 'Welches Studium passt zu mir?',
    name: 'Name',
    date: 'Datum',
    questions: [
      'Drei Studienfächer, die ich mir heute vorstellen kann:',
      'Meine drei besten Felder im Resultat:',
      'Was sich mit meiner Liste deckt und was mich überrascht hat:',
      'Ein Fach, das ich mir genauer anschaue, und warum:',
      'Mein nächster Schritt, und bis wann:',
    ],
  },
  linkTitle: 'Auf der Schulwebsite verlinken',
  linkLead: 'Viele Schulen führen auf ihrer Seite zur Studienwahl eine Liste mit Tests und Beratungsangeboten. Wenn Sie uns dort aufnehmen möchten, können Sie diesen Text und Link übernehmen.',
  anchor: (name: string) => `${name}: Welches Studium passt zu mir?`,
  blurb: 'Kostenloser Fragebogen zu Interessen, Persönlichkeit und Schulfächern, der passende Studienfächer vorschlägt. Es braucht keine Anmeldung.',
  textLabel: 'Als Text',
  htmlLabel: 'Als HTML',
  copy: 'Kopieren',
  copied: 'Kopiert',
  pilotTitle: 'Der volle Report für die ganze Klasse',
  pilotText: 'Mit dem Abo Beratung schalten Ihre Schülerinnen und Schüler auch die Liste der passenden Studiengänge frei, bezahlt von der Schule. Die ersten 30 Tage sind ein kostenloser Pilot für bis zu 30 Reports.',
  pilotCta: 'Pilot starten',
}

const frCH: TeachersText = {
  nav: 'Pour les enseignants',
  title: 'Le choix des études en classe',
  lead: 'Une leçon de 45 minutes pendant laquelle vos élèves découvrent quels domaines d’études correspondent à leurs intérêts. Il vous faut seulement cette page, un appareil par élève et la fiche de travail ci-dessous. La leçon et le questionnaire sont gratuits, et personne ne doit créer de compte.',
  metaTitle: 'Le choix des études en classe : leçon et fiche de travail',
  metaDesc: 'Une leçon de 45 minutes sur le choix des études pour les enseignants : déroulement, fiche de travail à imprimer et questionnaire gratuit sans inscription.',
  free: 'Gratuit',
  minutes: (n: number) => `${n} min`,
  flowTitle: 'Déroulement',
  flow: (start: string) => [
    { min: 5, title: 'Introduction', text: 'Chaque élève note sur la fiche trois domaines d’études qu’il ou elle envisage aujourd’hui. Qui n’a pas encore d’idée l’écrit aussi.' },
    { min: 10, title: 'Questionnaire', text: `La classe ouvre ${start} et répond au questionnaire sur les intérêts, la personnalité, les branches scolaires et les valeurs. Il compte environ 60 questions courtes, la plupart des élèves ont fini en 5 à 10 minutes. À la maison, on peut ensuite ajouter YouTube, Instagram, TikTok ou GitHub ; en classe, le questionnaire suffit.` },
    { min: 15, title: 'Lire le résultat', text: 'Chaque élève note ses trois meilleurs domaines et ouvre la page de l’un d’eux. On y voit pour qui il convient, sur quelles branches il s’appuie et où il mène.' },
    { min: 10, title: 'Comparer à deux', text: 'À deux, les élèves comparent le résultat avec les trois domaines notés au début : ce qui correspond et ce qui les a surpris. Les réponses vont sur la fiche.' },
    { min: 5, title: 'Prochaine étape', text: 'Pour finir, chaque élève fixe une prochaine étape concrète avec une date, par exemple une journée d’information d’une haute école, un entretien avec l’orientation ou la visite d’un cours.' },
  ],
  notesTitle: 'Bon à savoir',
  notes: (price: string) => [
    'Les réponses restent dans le navigateur de l’élève. Aucun compte n’est nécessaire, et ni vous ni nous ne voyons qui a répondu quoi.',
    'Un ordinateur portable, une tablette ou un téléphone par élève suffit. Le questionnaire fonctionne aussi sur petit écran.',
    `Les domaines et le résultat sont gratuits. La liste de toutes les formations correspondantes coûte ${price}, la leçon n’en a pas besoin.`,
    'Les élèves de moins de 16 ans devraient en parler à leurs parents avant de connecter un compte. Le questionnaire ne connecte rien.',
  ],
  sheetTitle: 'Fiche de travail',
  sheetLead: 'Une page A4. Imprimez-la ou projetez les questions.',
  print: 'Imprimer la fiche',
  sheet: {
    heading: 'Quelles études me correspondent ?',
    name: 'Nom',
    date: 'Date',
    questions: [
      'Trois domaines d’études que j’envisage aujourd’hui :',
      'Mes trois meilleurs domaines dans le résultat :',
      'Ce qui correspond à ma liste et ce qui m’a surpris :',
      'Un domaine que je veux regarder de plus près, et pourquoi :',
      'Ma prochaine étape, et d’ici quand :',
    ],
  },
  linkTitle: 'Lien pour le site de l’école',
  linkLead: 'Beaucoup d’écoles proposent, sur leur page consacrée au choix des études, une liste de tests et d’offres de conseil. Si vous souhaitez nous y ajouter, vous pouvez reprendre ce texte et ce lien.',
  anchor: (name: string) => `${name} : quelles études me correspondent ?`,
  blurb: 'Questionnaire gratuit sur les intérêts, la personnalité et les branches scolaires, qui propose des domaines d’études adaptés. Aucune inscription n’est nécessaire.',
  textLabel: 'Texte',
  htmlLabel: 'HTML',
  copy: 'Copier',
  copied: 'Copié',
  pilotTitle: 'Le rapport complet pour toute la classe',
  pilotText: 'Avec l’abonnement Conseil, vos élèves débloquent aussi la liste des formations correspondantes, payée par l’école. Les 30 premiers jours sont un pilote gratuit pour 30 rapports au maximum.',
  pilotCta: 'Démarrer le pilote',
}

const itCH: TeachersText = {
  nav: 'Per i docenti',
  title: 'La scelta degli studi in classe',
  lead: 'Una lezione di 45 minuti in cui i vostri studenti scoprono quali aree di studio corrispondono ai loro interessi. Vi servono solo questa pagina, un dispositivo per persona e la scheda di lavoro qui sotto. La lezione e il questionario sono gratuiti, e nessuno deve creare un account.',
  metaTitle: 'La scelta degli studi in classe: lezione e scheda di lavoro',
  metaDesc: 'Una lezione di 45 minuti sulla scelta degli studi per docenti: svolgimento, scheda di lavoro da stampare e questionario gratuito senza registrazione.',
  free: 'Gratis',
  minutes: (n: number) => `${n} min`,
  flowTitle: 'Svolgimento',
  flow: (start: string) => [
    { min: 5, title: 'Introduzione', text: 'Ognuno scrive sulla scheda tre aree di studio che oggi riesce a immaginarsi. Chi non ha ancora un’idea lo scrive.' },
    { min: 10, title: 'Questionario', text: `La classe apre ${start} e risponde al questionario su interessi, personalità, materie scolastiche e valori. Ha circa 60 domande brevi, la maggior parte finisce in 5–10 minuti. A casa si possono poi aggiungere YouTube, Instagram, TikTok o GitHub; in classe basta il questionario.` },
    { min: 15, title: 'Leggere il risultato', text: 'Ognuno annota le sue tre aree migliori e apre la pagina di una di esse. Lì si vede a chi si addice, su quali materie si basa e dove porta.' },
    { min: 10, title: 'Confronto a coppie', text: 'A coppie si confronta il risultato con le tre aree scritte all’inizio: che cosa coincide e che cosa ha sorpreso. Le risposte vanno sulla scheda.' },
    { min: 5, title: 'Prossimo passo', text: 'Per finire ognuno fissa un prossimo passo concreto con una data, per esempio la giornata informativa di una scuola universitaria, un colloquio con l’orientamento o la visita di una lezione.' },
  ],
  notesTitle: 'Da sapere',
  notes: (price: string) => [
    'Le risposte restano nel browser dello studente. Non serve un account, e né voi né noi vediamo chi ha risposto cosa.',
    'Basta un portatile, un tablet o un telefono per persona. Il questionario funziona anche su schermi piccoli.',
    `Le aree e il risultato sono gratuiti. La lista di tutti i corsi adatti costa ${price}, per la lezione non serve.`,
    'Chi ha meno di 16 anni dovrebbe parlarne con i genitori prima di collegare un account. Il questionario non collega nulla.',
  ],
  sheetTitle: 'Scheda di lavoro',
  sheetLead: 'Una pagina A4. Stampatela o proiettate le domande.',
  print: 'Stampa la scheda',
  sheet: {
    heading: 'Che cosa dovrei studiare?',
    name: 'Nome',
    date: 'Data',
    questions: [
      'Tre aree di studio che oggi riesco a immaginarmi:',
      'Le mie tre aree migliori nel risultato:',
      'Che cosa coincide con la mia lista e che cosa mi ha sorpreso:',
      'Un’area che voglio guardare più da vicino, e perché:',
      'Il mio prossimo passo, ed entro quando:',
    ],
  },
  linkTitle: 'Link per il sito della scuola',
  linkLead: 'Molte scuole hanno, nella pagina sulla scelta degli studi, un elenco di test e offerte di consulenza. Se volete aggiungerci, potete riprendere questo testo e questo link.',
  anchor: (name: string) => `${name}: che cosa dovrei studiare?`,
  blurb: 'Questionario gratuito su interessi, personalità e materie scolastiche che propone aree di studio adatte. Non serve registrarsi.',
  textLabel: 'Testo',
  htmlLabel: 'HTML',
  copy: 'Copia',
  copied: 'Copiato',
  pilotTitle: 'Il report completo per tutta la classe',
  pilotText: 'Con l’abbonamento Consulenza i vostri studenti sbloccano anche la lista dei corsi adatti, pagata dalla scuola. I primi 30 giorni sono un pilota gratuito per al massimo 30 report.',
  pilotCta: 'Avvia il pilota',
}

const TEXTS: Record<Locale, TeachersText> = { en, 'de-CH': deCH, 'de-DE': regionalizeDeep(deCH, 'de-DE'), 'de-AT': regionalizeDeep(deCH, 'de-AT'), 'fr-CH': frCH, 'it-CH': itCH }

export const teachersText = (locale: Locale): TeachersText => TEXTS[locale]

/** The link a school puts on its website: text and HTML, pointing at the free part. */
export function schoolLink(t: TeachersText, name: string, url: string) {
  const anchor = t.anchor(name)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return {
    text: `${anchor} ${t.blurb} ${url}`,
    html: `<a href="${esc(url)}">${esc(anchor)}</a>: ${esc(t.blurb)}`,
  }
}
