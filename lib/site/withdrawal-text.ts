import { CONTACT } from '../site.ts'
import { regionalize } from './regional.ts'

/**
 * Right of withdrawal for the one-time report, the same on every site and for
 * buyers from every country. It does not end when the report is opened, so
 * checkout needs no waiver (§ 356 Abs. 5 BGB). Shown in the terms, in a note
 * before and in Stripe Checkout, and in the payment email (durable medium).
 */
export interface WithdrawalText {
  heading: string
  body: string[]
  formHeading: string
  form: string[]
  /** One sentence for the checkout button and the Stripe payment page. */
  note: string
  termsLink: string
}

const OPERATOR = process.env.NEXT_PUBLIC_OPERATOR
const OPERATOR_ADDRESS = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS
const POSTAL = OPERATOR && OPERATOR_ADDRESS ? `${OPERATOR}, ${OPERATOR_ADDRESS}` : ''
const ADDRESSEE = [POSTAL, CONTACT].filter(Boolean).join(', ')

const TEXTS: Record<'de' | 'en' | 'fr' | 'it', WithdrawalText> = {
  de: {
    heading: 'Widerrufsrecht',
    body: [
      'Du kannst den Kauf des vollen Reports innert 14 Tagen ohne Angabe von Gründen widerrufen. Die Frist beginnt am Tag des Kaufs. Das gilt auf allen unseren Seiten und für Käufe aus jedem Land, auch wenn du den Report schon geöffnet hast.',
      `Für den Widerruf genügt eine eindeutige Erklärung, am einfachsten eine E-Mail an ${CONTACT}.${POSTAL ? ` Per Post erreichst du uns unter ${POSTAL}.` : ''} Du kannst dafür das Muster unten verwenden, musst aber nicht. Für die Frist reicht es, wenn du den Widerruf vor ihrem Ablauf abschickst.`,
      'Nach einem Widerruf erstatten wir dir den vollen Betrag unverzüglich, spätestens innert 14 Tagen ab Eingang deiner Erklärung. Das Geld geht in der Währung, in der du bezahlt hast, an dasselbe Zahlungsmittel wie beim Kauf, ausser wir vereinbaren etwas anderes. Für die Erstattung fallen keine Gebühren an.',
    ],
    formHeading: 'Muster-Widerrufsformular',
    form: [
      'Wenn du den Kauf widerrufen willst, kannst du diesen Text ausfüllen und uns schicken.',
      `An: ${ADDRESSEE}`,
      'Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den vollen Report (digitale Inhalte).',
      'Gekauft am:',
      'E-Mail-Adresse beim Kauf:',
      'Name:',
      'Anschrift:',
      'Unterschrift (nur bei Mitteilung auf Papier):',
      'Datum:',
    ],
    note: 'Der Report wird nach der Zahlung sofort freigeschaltet. Du kannst den Kauf innert 14 Tagen ohne Angabe von Gründen widerrufen, auch nach dem Öffnen.',
    termsLink: 'AGB und Widerrufsbelehrung',
  },
  en: {
    heading: 'Right of withdrawal',
    body: [
      'You can withdraw from your purchase of the full report within 14 days without giving any reason. The period starts on the day of purchase. This applies on all our sites and to purchases from every country, even if you have already opened the report.',
      `A clear statement is enough to withdraw, most simply an email to ${CONTACT}.${POSTAL ? ` By post, write to ${POSTAL}.` : ''} You may use the model form below, but you don’t have to. To meet the deadline, it is enough to send your withdrawal before the period ends.`,
      'After a withdrawal we refund the full amount without undue delay and at the latest within 14 days of receiving it. The money goes back in the currency you paid in and to the payment method you used, unless we agree otherwise. We charge no fees for the refund.',
    ],
    formHeading: 'Model withdrawal form',
    form: [
      'If you want to withdraw, you can fill in this text and send it to us.',
      `To: ${ADDRESSEE}`,
      'I hereby withdraw from the contract I concluded for the full report (digital content).',
      'Purchased on:',
      'Email address used for the purchase:',
      'Name:',
      'Address:',
      'Signature (only if sent on paper):',
      'Date:',
    ],
    note: 'The report unlocks right after payment. You can withdraw within 14 days without giving a reason, even after opening it.',
    termsLink: 'Terms and right of withdrawal',
  },
  fr: {
    heading: 'Droit de rétractation',
    body: [
      'Tu peux te rétracter de l’achat du rapport complet dans un délai de 14 jours, sans donner de motif. Le délai court à partir du jour de l’achat. Ce droit s’applique sur tous nos sites et aux achats depuis tous les pays, même si tu as déjà ouvert le rapport.',
      `Une déclaration claire suffit, le plus simple étant un e-mail à ${CONTACT}.${POSTAL ? ` Par courrier : ${POSTAL}.` : ''} Tu peux utiliser le modèle ci-dessous, sans obligation. Pour respecter le délai, il suffit d’envoyer ta rétractation avant son expiration.`,
      'Après une rétractation, nous te remboursons le montant total sans retard excessif, au plus tard dans les 14 jours suivant sa réception. Le remboursement se fait dans la devise du paiement et sur le moyen de paiement utilisé, sauf accord contraire. Il ne t’est facturé aucun frais.',
    ],
    formHeading: 'Modèle de formulaire de rétractation',
    form: [
      'Si tu veux te rétracter, tu peux compléter ce texte et nous l’envoyer.',
      `À : ${ADDRESSEE}`,
      'Par la présente, je me rétracte du contrat conclu pour le rapport complet (contenu numérique).',
      'Acheté le :',
      'Adresse e-mail utilisée pour l’achat :',
      'Nom :',
      'Adresse :',
      'Signature (uniquement en cas d’envoi sur papier) :',
      'Date :',
    ],
    note: 'Le rapport est débloqué dès le paiement. Tu peux te rétracter dans les 14 jours sans motif, même après l’avoir ouvert.',
    termsLink: 'Conditions et droit de rétractation',
  },
  it: {
    heading: 'Diritto di recesso',
    body: [
      'Puoi recedere dall’acquisto del report completo entro 14 giorni senza indicarne il motivo. Il termine decorre dal giorno dell’acquisto. Il diritto vale su tutti i nostri siti e per gli acquisti da qualsiasi paese, anche se hai già aperto il report.',
      `Basta una dichiarazione esplicita, nel modo più semplice un’email a ${CONTACT}.${POSTAL ? ` Per posta: ${POSTAL}.` : ''} Puoi usare il modulo qui sotto, ma non è obbligatorio. Per rispettare il termine basta inviare il recesso prima della scadenza.`,
      'Dopo il recesso ti rimborsiamo l’intero importo senza indebito ritardo, al più tardi entro 14 giorni dalla ricezione. Il rimborso avviene nella valuta del pagamento e con lo stesso mezzo di pagamento, salvo diverso accordo. Non addebitiamo costi per il rimborso.',
    ],
    formHeading: 'Modulo tipo di recesso',
    form: [
      'Se vuoi recedere, puoi compilare questo testo e inviarcelo.',
      `A: ${ADDRESSEE}`,
      'Con la presente recedo dal contratto concluso per il report completo (contenuto digitale).',
      'Acquistato il:',
      'Indirizzo email usato per l’acquisto:',
      'Nome:',
      'Indirizzo:',
      'Firma (solo se inviato su carta):',
      'Data:',
    ],
    note: 'Il report si sblocca subito dopo il pagamento. Puoi recedere entro 14 giorni senza indicarne il motivo, anche dopo averlo aperto.',
    termsLink: 'Condizioni e diritto di recesso',
  },
}

const regional = (t: WithdrawalText, locale: 'de-DE' | 'de-AT'): WithdrawalText => ({
  heading: t.heading,
  body: t.body.map((s) => regionalize(s, locale)),
  formHeading: t.formHeading,
  form: t.form.map((s) => regionalize(s, locale)),
  note: regionalize(t.note, locale),
  termsLink: t.termsLink,
})
const DE_DE = regional(TEXTS.de, 'de-DE')
const DE_AT = regional(TEXTS.de, 'de-AT')

/** Text for a locale or language tag (de-DE, de, fr-CH …); unknown languages get English. */
export function withdrawalText(tag?: string | null): WithdrawalText {
  if (tag === 'de-DE') return DE_DE
  if (tag === 'de-AT') return DE_AT
  return TEXTS[(tag ?? '').split('-')[0] as keyof typeof TEXTS] ?? TEXTS.en
}

/** Plain text for emails. */
export function withdrawalPlain(t: WithdrawalText): string {
  return `${t.heading}\n\n${t.body.join('\n\n')}\n\n${t.formHeading}\n\n${t.form.join('\n')}`
}
