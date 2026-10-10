/**
 * Sends one mail through the site's mailbox, for the «Mail» workflow.
 *
 * Without TO it only checks: the SMTP secrets are set (never printed) and the
 * addresses on the page in LOOKUP, so the recipient can be read off the
 * publisher's own imprint before anything goes out. With TO, SUBJECT and BODY
 * it sends, with a blind copy to the sending mailbox.
 */
import nodemailer from 'nodemailer'

const { SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT, LOOKUP, TO, SUBJECT, BODY, FROM_NAME } = process.env

if (!SMTP_USER || !SMTP_PASS) {
  console.error('SMTP_USER or SMTP_PASS is not set as a repository secret.')
  process.exit(1)
}
console.log(`SMTP: secrets set, host ${SMTP_HOST || 'mail.infomaniak.com'}, sender domain ${SMTP_USER.split('@')[1]}`)

if (LOOKUP) {
  const html = await (await fetch(LOOKUP, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text()
  const found = new Set([...html.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map((m) => m[0].toLowerCase()).filter((a) => !/\.(png|jpe?g|svg|webp|gif)$/.test(a)))
  console.log(`Addresses on ${LOOKUP}: ${[...found].join(', ') || 'none'}`)
}

if (TO) {
  if (!SUBJECT || !BODY) throw new Error('SUBJECT and BODY are needed to send')
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i.test(TO)) throw new Error('TO is not a single address')
  const port = Number(SMTP_PORT) || 465
  const transport = nodemailer.createTransport({ host: SMTP_HOST || 'mail.infomaniak.com', port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  const info = await transport.sendMail({ from: `${FROM_NAME || 'Moritz Lauper'} <${SMTP_USER}>`, to: TO, bcc: SMTP_USER, subject: SUBJECT, text: BODY })
  console.log(`Sent to ${TO}: ${info.response}`)
}
