import { ImapFlow } from 'imapflow'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createTransport } from 'nodemailer'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const ISSUER = 'https://token.actions.githubusercontent.com'
const AUDIENCE = 'wsis-outreach-drafts'
const REPOSITORY = 'moritzlauper/whatshouldistudy-outreach'
const WORKFLOW = `${REPOSITORY}/.github/workflows/check.yml@refs/heads/main`
const SELF_TEST_RECIPIENT = 'moritz.lauper@hispeed.ch'
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`))

interface DraftInput {
  id: string
  name: string
  to: string
  url: string
  lang: 'de' | 'fr' | 'it'
  pageTitle: string
  listedTools: string[]
  opening: string
  subject: string
  body: string
}

interface HumanizedDraft {
  body: string
}

async function authorize(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: AUDIENCE })
    if (payload.repository !== REPOSITORY || payload.workflow_ref !== WORKFLOW) return null
    if (payload.event_name !== 'schedule' && payload.event_name !== 'workflow_dispatch') return null
    return payload.event_name
  } catch {
    return null
  }
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]/g, ' ').trim()
}

function base64Lines(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? ''
}

function rawMessage(draft: DraftInput, from: string, senderName: string): string {
  const subject = `=?UTF-8?B?${Buffer.from(cleanHeader(draft.subject)).toString('base64')}?=`
  const fromHeader = senderName ? `From: =?UTF-8?B?${Buffer.from(senderName).toString('base64')}?= <${from}>` : `From: ${from}`
  const headers = [
    fromHeader,
    ...(draft.to ? [`To: ${cleanHeader(draft.to)}`] : []),
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    `X-Outreach-ID: ${draft.id}`,
  ]
  return `${headers.join('\r\n')}\r\n\r\n${base64Lines(draft.body.trim())}`
}

async function humanize(draft: DraftInput, apiKey: string | undefined, humanizerSkill: string): Promise<HumanizedDraft> {
  if (!apiKey) return { body: draft.body }
  const system = `${humanizerSkill.trim()}

Rewrite the complete supplied email as a concise one-to-one message from Moritz Lauper. Apply the Humanizer skill to the whole text, not just the opening. Personalize it using only the organization name, page title, URL, and listed tools. Do not claim to have read page content beyond its title or listed tools. Preserve Moritz's supplied biography, all product facts, the CHF 17 individual price, the 14-day organisation trial, the privacy statements, both exact website URLs, the greeting, and the sign-off. Preserve the supplied concrete call to action exactly as the final question; do not replace it with a generic usefulness question. Do not assume the recipient always works with pupils. Keep the two URLs exactly as plain-text URLs on their own lines. Do not add, remove, or alter factual claims. Use the supplied language and return only the requested JSON. No HTML or Markdown.`
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      max_tokens: 900,
      system,
      messages: [{ role: 'user', content: JSON.stringify({ language: draft.lang, organization: draft.name, pageTitle: draft.pageTitle, pageUrl: draft.url, listedTools: draft.listedTools, requiredCallToAction: draft.body.trim().split(/\n{2,}/).at(-2), originalSubject: draft.subject, originalBody: draft.body }) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { body: { type: 'string' } },
            required: ['body'],
            additionalProperties: false,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Anthropic API returned HTTP ${response.status}`)
  const result = await response.json() as { content?: Array<{ type: string; text?: string }> }
  const text = result.content?.find((block) => block.type === 'text')?.text
  if (!text) throw new Error('Anthropic returned no text')
  const parsed = JSON.parse(text) as HumanizedDraft
  const urls = [...draft.body.matchAll(/https:\/\/whatshouldistudy\.ch(?:\/organisationen)?/g)].map(([url]) => url)
  const requiredCallToAction = draft.body.trim().split(/\n{2,}/).at(-2)
  if (typeof parsed.body !== 'string' || !parsed.body.trim() || parsed.body.length > 10_000 || /<\/?[a-z][^>]*>/i.test(parsed.body)) throw new Error('Anthropic returned an invalid body')
  if (urls.some((url) => !parsed.body.includes(url))) throw new Error('Anthropic removed a required website link')
  if (requiredCallToAction && !parsed.body.includes(requiredCallToAction)) throw new Error('Anthropic removed or changed the concrete call to action')
  if (/CHF 17|17 CHF/.test(draft.body) && !/CHF 17|17 CHF/.test(parsed.body)) throw new Error('Anthropic removed the individual price')
  if (/14 Tage|14 jours|14 giorni/.test(draft.body) && !/14 Tage|14 jours|14 giorni/.test(parsed.body)) throw new Error('Anthropic removed the organisation trial')
  if (draft.lang === 'de' && /ß/.test(parsed.body)) throw new Error('Anthropic returned non-Swiss German spelling')
  return { body: parsed.body.trim() }
}

export async function POST(req: Request) {
  const eventName = await authorize(req)
  if (!eventName) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 })
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > 150_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })

  let drafts: DraftInput[]
  let humanizerSkill: string
  let sendTest = false
  try {
    const input = await req.json() as { drafts?: unknown; humanizerSkill?: unknown; sendTest?: unknown }
    if (!Array.isArray(input.drafts) || input.drafts.length > 10) throw new Error('Invalid batch')
    if (typeof input.humanizerSkill !== 'string' || input.humanizerSkill.length < 1_000 || input.humanizerSkill.length > 50_000) throw new Error('Invalid humanizer skill')
    if (input.sendTest !== undefined && typeof input.sendTest !== 'boolean') throw new Error('Invalid test mode')
    sendTest = input.sendTest === true
    humanizerSkill = input.humanizerSkill
    drafts = input.drafts as DraftInput[]
    if (drafts.some((draft) => !draft || !/^[a-z0-9-]{1,100}$/.test(draft.id) || typeof draft.name !== 'string' || typeof draft.to !== 'string' || typeof draft.url !== 'string' || !['de', 'fr', 'it'].includes(draft.lang) || typeof draft.pageTitle !== 'string' || draft.pageTitle.length > 500 || !Array.isArray(draft.listedTools) || draft.listedTools.length > 20 || draft.listedTools.some((tool) => typeof tool !== 'string' || tool.length > 100) || typeof draft.opening !== 'string' || draft.opening.length > 600 || typeof draft.subject !== 'string' || typeof draft.body !== 'string' || draft.to.length > 254 || draft.subject.length > 200 || draft.body.length > 10_000)) throw new Error('Invalid draft')
  } catch {
    return NextResponse.json({ error: 'Invalid draft batch' }, { status: 400 })
  }

  const host = process.env.IMAP_HOST || 'mail.infomaniak.com'
  const port = Number(process.env.IMAP_PORT || 993)
  const user = process.env.SMTP_USER || process.env.SMTP_ADMIN_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'team@whatshouldistudy.com'
  const password = process.env.SMTP_PASSWORD || process.env.SMTP_PASS
  if (!password) return NextResponse.json({ error: 'Mailbox password is not configured' }, { status: 503 })
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (sendTest) {
    const testDraft = drafts[0]
    if (eventName !== 'workflow_dispatch' || drafts.length !== 1 || testDraft.id !== 'internal-format-test' || testDraft.to !== SELF_TEST_RECIPIENT) {
      return NextResponse.json({ error: 'Test sending is restricted to one self-test recipient' }, { status: 400 })
    }

    let message: HumanizedDraft = { body: testDraft.body }
    let humanized = 0
    if (anthropicKey) {
      try {
        message = await humanize(testDraft, anthropicKey, humanizerSkill)
        humanized = 1
      } catch (error) {
        console.warn('Outreach self-test humanization failed; using reviewed template', { code: (error as Error).name })
      }
    }

    const smtpPort = Number(process.env.SMTP_PORT || 465)
    const transporter = createTransport({
      host: process.env.SMTP_HOST || 'mail.infomaniak.com',
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
    try {
      await transporter.sendMail({
        from: { name: 'Moritz Lauper', address: user },
        to: SELF_TEST_RECIPIENT,
        subject: cleanHeader(testDraft.subject),
        text: message.body,
      })
      return NextResponse.json({ sent: 1, humanized })
    } catch (error) {
      const mailError = error as Error & { code?: string }
      console.error('Outreach self-test email failed', { code: mailError.code ?? 'UNKNOWN' })
      return NextResponse.json({ error: 'Test email could not be sent' }, { status: 502 })
    } finally {
      transporter.close()
    }
  }

  const client = new ImapFlow({ host, port, secure: true, auth: { user, pass: password }, logger: false, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 })
  try {
    await client.connect()
    const mailboxes = await client.list()
    const draftsMailbox = mailboxes.find((mailbox) => mailbox.specialUse === '\\Drafts') ?? mailboxes.find((mailbox) => /(^|[./])(drafts|entwürfe)$/i.test(mailbox.path))
    const sentMailbox = mailboxes.find((mailbox) => mailbox.specialUse === '\\Sent') ?? mailboxes.find((mailbox) => /(^|[./])(sent|sent items|gesendet)$/i.test(mailbox.path))
    if (!draftsMailbox) throw new Error('Infomaniak Drafts folder not found')

    let created = 0
    let skipped = 0
    let humanized = 0
    for (const draft of drafts) {
      if (sentMailbox) {
        await client.mailboxOpen(sentMailbox.path, { readOnly: true })
        const sent = await client.search({ header: { 'X-Outreach-ID': draft.id } })
        if (sent && sent.length > 0) {
          skipped++
          continue
        }
      }

      await client.mailboxOpen(draftsMailbox.path)
      const oldDrafts = await client.search({ header: { 'X-Outreach-ID': draft.id } }, { uid: true })
      const oldUids = Array.isArray(oldDrafts) ? oldDrafts : []
      if (oldUids.length > 0) {
        const deleted = await client.messageDelete(oldUids, { uid: true })
        if (!deleted) throw new Error(`Could not replace draft ${draft.id}`)
      }

      let message: HumanizedDraft = { body: draft.body }
      if (anthropicKey) {
        try {
          message = await humanize(draft, anthropicKey, humanizerSkill)
          humanized++
        } catch (error) {
          console.warn('Outreach humanization failed; using reviewed template', { code: (error as Error).name })
        }
      }
      const finalized = { ...draft, body: message.body }
      const appended = await client.append(draftsMailbox.path, rawMessage(finalized, user, process.env.SMTP_SENDER_NAME || 'whatshouldistudy'), ['\\Draft'])
      if (!appended) throw new Error(`Could not create draft ${draft.id}`)
      created++
    }
    return NextResponse.json({ created, skipped, humanized })
  } catch (error) {
    const mailError = error as Error & { code?: string; responseCode?: number }
    console.error('Outreach IMAP draft creation failed', { code: mailError.code ?? 'UNKNOWN', responseCode: mailError.responseCode })
    return NextResponse.json({ error: 'Could not create the mailbox drafts' }, { status: 502 })
  } finally {
    if (client.usable) await client.logout().catch(() => {})
    else client.close()
  }
}