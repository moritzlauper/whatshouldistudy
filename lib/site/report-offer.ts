import type { Locale } from './config.ts'

const de = {
  landingCta: (price: string) => `Los geht’s – ${price} einmalig`,
  landingSummary: 'Dein vollständiger Studienbericht mit Platz 1, passenden Studiengängen und persönlicher KI-Analyse.',
  landingReassurance: 'Kein Abo',
  title: 'Deine Studiengänge. Mit KI-Analyse.',
  price: (price: string) => `Einmalig ${price} · kein Abo`,
  intro: 'Die Fachrichtungen geben dir eine erste Orientierung. Im vollen Report findest du konkrete Studiengänge und erfährst, was davon zu dir passt.',
  features: [
    { title: 'Studiengänge mit deinem Profil vergleichen', text: 'Gleicht deine Interessen, Themen und Lieblingsfächer mit Studiengängen ab und begründet passende Treffer.' },
    { title: 'Inhalte und Schwerpunkte verstehen', text: 'Zeigt, was du dort lernst, welche Vertiefungen passen und was du vor der Bewerbung abklären solltest – soweit die Hochschulseiten diese Angaben liefern.' },
    { title: 'Deinen Verlauf besser einordnen', text: 'Optional mit «Meine Aktivitäten»: Ordnet importierte Videotitel und ausgewählte News-Themen nach ihrem Inhalt ein. Zeigt, wie sich dadurch deine Fächer und Studiengang-Empfehlungen verändern.' },
  ],
  consent: 'Die persönliche KI-Analyse startest du nach dem Kauf selbst, mit deiner Einwilligung. Ohne Upload kannst du den Studiengang-Vergleich mit deinem Fragebogen nutzen.',
  cta: 'Report mit KI-Analyse freischalten',
  included: 'KI-Analyse im Preis enthalten',
  lockedTitle: 'Studiengangdetails im vollen Report',
  lockedText: 'Namen, Hochschulen und persönliche Begründungen werden nach dem Freischalten sichtbar.',
  labels: ['Studiengang & Hochschule', 'Inhalte & Vertiefungen', 'Warum passt das zu dir?', 'Gebühren & Zulassung'],
}

const en: typeof de = {
  landingCta: (price) => `Get started – ${price} once`,
  landingSummary: 'Your full study report with your top match, relevant programmes and personal AI analysis.',
  landingReassurance: 'No subscription',
  title: 'Your programmes. With AI analysis.',
  price: (price) => `${price} once · no subscription`,
  intro: 'Your fields give you a starting point. The full report shows specific programmes and explains how they fit you.',
  features: [
    { title: 'Compare programmes with your profile', text: 'Matches your interests, topics and favourite subjects to programmes and explains relevant matches.' },
    { title: 'Understand course content and specialisations', text: 'Shows what you would study, relevant specialisations and what to check before applying, where university pages provide this information.' },
    { title: 'Make more sense of your history', text: 'Optional with My Activity: classifies imported video titles and selected news topics by content. Shows how this changes your fields and programme recommendations.' },
  ],
  consent: 'You start personal AI analysis yourself after purchase, with your consent. Without an upload, you can use your questionnaire for the programme comparison.',
  cta: 'Unlock report with AI analysis',
  included: 'AI analysis included in the price',
  lockedTitle: 'Programme details in the full report',
  lockedText: 'Unlock to see names, universities and personal explanations.',
  labels: ['Programme & university', 'Content & specialisations', 'Why does it fit you?', 'Fees & admission'],
}

const fr: typeof de = {
  landingCta: (price) => `C’est parti – ${price} en une fois`,
  landingSummary: 'Ton rapport d’orientation complet avec ton premier choix, des formations adaptées et une analyse IA personnelle.',
  landingReassurance: 'Sans abonnement',
  title: 'Tes formations. Avec une analyse IA.',
  price: (price) => `${price} en une fois · sans abonnement`,
  intro: 'Tes domaines te donnent une première orientation. Le rapport complet présente des formations précises et explique en quoi elles te correspondent.',
  features: [
    { title: 'Comparer les formations à ton profil', text: 'Compare tes intérêts, tes thèmes et tes matières préférées aux formations et explique les correspondances.' },
    { title: 'Comprendre les contenus et spécialisations', text: 'Présente les contenus, les spécialisations pertinentes et les points à vérifier avant de postuler, selon les informations publiées par les établissements.' },
    { title: 'Mieux comprendre ton historique', text: 'En option avec Mon activité : classe les titres de vidéos importés et certains thèmes d’actualité selon leur contenu. Montre comment cela change tes domaines et les formations recommandées.' },
  ],
  consent: 'Tu lances toi-même l’analyse IA personnelle après l’achat, avec ton consentement. Sans import, tu peux comparer les formations à partir de ton questionnaire.',
  cta: 'Débloquer le rapport avec analyse IA',
  included: 'Analyse IA incluse dans le prix',
  lockedTitle: 'Détails des formations dans le rapport complet',
  lockedText: 'Les noms, établissements et explications personnelles apparaissent après le déblocage.',
  labels: ['Formation et établissement', 'Contenus et spécialisations', 'Pourquoi cette formation te correspond', 'Frais et admission'],
}

const it: typeof de = {
  landingCta: (price) => `Inizia – ${price} una tantum`,
  landingSummary: 'Il tuo report di orientamento completo con la prima scelta, corsi adatti a te e analisi IA personale.',
  landingReassurance: 'Nessun abbonamento',
  title: 'I tuoi corsi. Con analisi IA.',
  price: (price) => `${price} una tantum · nessun abbonamento`,
  intro: 'Le aree ti danno un primo orientamento. Il report completo presenta corsi concreti e spiega come corrispondono al tuo profilo.',
  features: [
    { title: 'Confrontare i corsi con il tuo profilo', text: 'Confronta i tuoi interessi, temi e materie preferite con i corsi e spiega le corrispondenze.' },
    { title: 'Capire contenuti e specializzazioni', text: 'Mostra cosa studieresti, le specializzazioni pertinenti e cosa verificare prima della candidatura, quando gli atenei pubblicano queste informazioni.' },
    { title: 'Capire meglio la tua cronologia', text: 'Facoltativo con Le mie attività: classifica i titoli dei video importati e alcuni temi delle notizie in base al contenuto. Mostra come cambiano le aree e i corsi consigliati.' },
  ],
  consent: 'Avvii tu l’analisi IA personale dopo l’acquisto, con il tuo consenso. Senza importare dati, puoi confrontare i corsi usando il questionario.',
  cta: 'Sblocca il report con analisi IA',
  included: 'Analisi IA inclusa nel prezzo',
  lockedTitle: 'Dettagli dei corsi nel report completo',
  lockedText: 'Nomi, atenei e spiegazioni personali diventano visibili dopo lo sblocco.',
  labels: ['Corso e ateneo', 'Contenuti e specializzazioni', 'Perché fa per te?', 'Tasse e ammissione'],
}

export function reportOfferText(locale: Locale) {
  return locale.startsWith('de') ? de : locale.startsWith('fr') ? fr : locale.startsWith('it') ? it : en
}
