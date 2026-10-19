import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import nodemailer from 'nodemailer'
import { CONTACT, SITE_URL, hostsFor } from '../site.ts'
import { LOCAL_SITES, SITES } from '../site/config.ts'
import { redis } from './usage.ts'

export interface PaidSession {
  id: string
  mode?: string
  payment_status?: string
  success_url?: string | null
  locale?: string | null
  customer_details?: { email?: string | null } | null
  metadata?: Record<string, string> | null
}

const COPY = {
  de: {
    subject: 'Dein bezahlter Studienwahl-Report – Zugangslink',
    intro: 'Vielen Dank! Deine Zahlung ist angekommen. Hier kannst du deinen vollständigen Studienwahl-Report freischalten:',
    instructions: 'Öffne den Link möglichst im selben Browser und auf demselben Gerät, auf dem du den Fragebogen ausgefüllt oder Daten importiert hast. Dein Profil liegt in diesem Browser. Falls es dort noch kein Profil gibt, führt dich die Seite zuerst zum Fragebogen. Du musst nicht nochmals bezahlen.',
    footer: 'Dein Zugang gilt 12 Monate. Bewahre diese E-Mail auf und teile den persönlichen Link nicht öffentlich. Den Report kannst du auf der Ergebnisseite ansehen und über die E-Mail-Funktion mitsamt deinem Ergebnis sichern.',
  },
  en: {
    subject: 'Your paid study-choice report – access link',
    intro: 'Thank you! Your payment has arrived. Use this link to unlock your full study-choice report:',
    instructions: 'Open the link in the same browser and on the same device where you completed the questionnaire or imported data, if possible. Your profile is stored in that browser. If there is no profile yet, the site will take you to the questionnaire first. You do not need to pay again.',
    footer: 'Your access is valid for 12 months. Keep this email and do not share your personal link publicly. View your report on the results page and use its email feature to save a link that includes your result.',
  },
  fr: {
    subject: 'Ton rapport payé sur le choix des études – lien d’accès',
    intro: 'Merci ! Ton paiement a bien été reçu. Ce lien te permet de débloquer ton rapport complet :',
    instructions: 'Ouvre si possible ce lien dans le même navigateur et sur le même appareil que pour le questionnaire ou l’importation des données. Ton profil est conservé dans ce navigateur. Si aucun profil n’y est présent, le site te guidera d’abord vers le questionnaire. Tu ne dois pas payer à nouveau.',
    footer: 'Ton accès est valable 12 mois. Conserve cet e-mail et ne partage pas ce lien personnel publiquement. Consulte ton rapport sur la page des résultats et utilise sa fonction e-mail pour sauvegarder un lien contenant aussi ton résultat.',
  },
  it: {
    subject: 'Il tuo report pagato sulla scelta degli studi – link di accesso',
    intro: 'Grazie! Il tuo pagamento è stato ricevuto. Puoi sbloccare il report completo con questo link:',
    instructions: 'Apri il link preferibilmente nello stesso browser e sullo stesso dispositivo usati per compilare il questionario o importare i dati. Il tuo profilo è conservato in quel browser. Se non è ancora presente un profilo, il sito ti guiderà prima al questionario. Non devi pagare di nuovo.',
    footer: 'Il tuo accesso è valido per 12 mesi. Conserva questa email e non condividere pubblicamente il link personale. Puoi consultare il report nella pagina dei risultati e usare la funzione email per salvare un link che includa anche il tuo risultato.',
  },
} as const

/** Only our one-time report sessions, including purchases before email delivery existed. */
export function paymentEmail(session: PaidSession) {
  if (session.mode !== 'payment' || session.payment_status !== 'paid') return null
  if (!/^cs_(?:live|test)_[A-Za-z0-9]+$/.test(session.id)) return null
  const site = session.metadata?.site
  if (!site || !Object.hasOwn(SITES, site)) return null
  if (session.metadata?.product && session.metadata.product !== 'wsis_report') return null
  let url: URL
  try {
    url = new URL(session.success_url ?? '')
    const origins = new Set([new URL(SITE_URL).origin, ...LOCAL_SITES.flatMap(s => hostsFor(s).map(h => `https://${h}`))])
    if (url.protocol !== 'https:' || !origins.has(url.origin) || url.username || url.password) return null
    if (!/\/(?:unlocked|freigeschaltet)$/.test(url.pathname)) return null
    url.search = new URLSearchParams({ session_id: session.id }).toString()
    url.hash = ''
  } catch { return null }
  const email = session.customer_details?.email?.trim()
  if (!email || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('Paid session has no valid email')
  const language = (session.metadata?.locale || session.locale || (site === 'global' ? 'en' : 'de')).split('-')[0]
  const copy = COPY[language as keyof typeof COPY] ?? COPY.en
  return { to: email, subject: copy.subject, text: `${copy.intro}\n\n${url}\n\n${copy.instructions}\n\n${copy.footer}\n\n${CONTACT}` }
}

export async function sendPaymentEmail(session: PaidSession) {
  const mail = paymentEmail(session)
  if (!mail) return 'ignored'
  const user = process.env.SMTP_USER || CONTACT
  if (!process.env.SMTP_PASSWORD || !user) throw new Error('Payment email SMTP is not configured')
  // No email addresses, profiles or access links stored in Redis.
  const key = `wsis:payment-email:v1:${createHash('sha256').update(session.id).digest('hex')}`
  const lock = `${key}:lock`
  const owner = randomUUID()
  if (await redis(['GET', key])) return 'already-sent'
  if (await redis(['SET', lock, owner, 'NX', 'EX', 120]) !== 'OK') throw new Error('Payment email is in progress')
  let transport: ReturnType<typeof nodemailer.createTransport> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    if (await redis(['GET', key])) return 'already-sent'
    const port = Number(process.env.SMTP_PORT || 587)
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.infomaniak.com', port,
      secure: port === 465, requireTLS: port === 587,
      auth: { user, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 10_000,
    })
    const result = await Promise.race([
      transport.sendMail({ ...mail, from: process.env.SMTP_FROM || user, messageId: `<${key.split(':').at(-1)}@whatshouldistudy.com>` }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { transport?.close(); reject(new Error('Payment email timed out')) }, 20_000) }),
    ])
    if (!result.accepted.length) throw new Error('Payment email was not accepted')
    await redis(['SET', key, 'sent', 'EX', 400 * 86400])
    return 'sent'
  } finally {
    clearTimeout(timer)
    transport?.close()
    await redis(['EVAL', "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end", 1, lock, owner])
  }
}
