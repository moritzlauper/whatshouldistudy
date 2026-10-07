import { existingOutreach, formatOutreachGreeting, outreachCallToAction } from '@/lib/outreach.ts'
import { randomUUID } from 'node:crypto'
import { ImapFlow } from 'imapflow'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const ISSUER = 'https://token.actions.githubusercontent.com'
const AUDIENCE = 'wsis-outreach-drafts'
const REPOSITORY = 'moritzlauper/whatshouldistudy-outreach'
const WORKFLOW = `${REPOSITORY}/.github/workflows/check.yml@refs/heads/main`
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
  callToAction?: string
  subject: string
  body: string
}

interface HumanizedDraft {
  body: string
}

async function authorize(req: Request): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: AUDIENCE })
    return payload.repository === REPOSITORY && payload.workflow_ref === WORKFLOW && (payload.event_name === 'schedule' || payload.event_name === 'workflow_dispatch')
  } catch {
    return false
  }
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]/g, ' ').trim()
}

function base64Lines(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? ''
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function htmlBody(body: string, signatureHtml: string): string {
  const contentBody = body.trim().replace(/\n{2,}Moritz Lauper\nwhatshouldistudy\nwhatshouldistudy\.ch\nteam@whatshouldistudy\.com$/, '')
  const paragraphs = contentBody.split(/\n{2,}/).map((paragraph) => {
    const content = escapeHtml(paragraph)
      .replace(/https:\/\/whatshouldistudy\.ch(?:\/organisationen)?/g, (url) => `<a href="${url}">${url}</a>`)
      .replace(/\n/g, '<br>\r\n')
    return `<p style="margin:0 0 12px 0;line-height:1.4">${content}</p>`
  })
  return `<html><body style="margin:0;line-height:1.4">${paragraphs.join('\r\n')}<div style="margin-top:12px">${signatureHtml}</div></body></html>`
}

function rawMessage(draft: DraftInput, from: string, senderName: string, signatureHtml: string): string {
  const body = formatOutreachGreeting(draft.body.trim(), draft.lang)
  const boundary = `wsis-${randomUUID()}`
  const subject = `=?UTF-8?B?${Buffer.from(cleanHeader(draft.subject)).toString('base64')}?=`
  const fromHeader = senderName ? `From: =?UTF-8?B?${Buffer.from(senderName).toString('base64')}?= <${from}>` : `From: ${from}`
  const headers = [
    fromHeader,
    ...(draft.to ? [`To: ${cleanHeader(draft.to)}`] : []),
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `X-Outreach-ID: ${draft.id}`,
  ]
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(body),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(htmlBody(body, signatureHtml)),
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return `${headers.join('\r\n')}\r\n\r\n${parts}`
}

async function humanize(draft: DraftInput, apiKey: string | undefined, humanizerSkill: string): Promise<HumanizedDraft> {
  if (!apiKey) return { body: draft.body }
  const system = `${humanizerSkill.trim()}

Rewrite the complete supplied email as a concise one-to-one message from Moritz Lauper. Apply the Humanizer skill to the whole text, not just the opening. Personalize it using only the organization name, page title, URL, and listed tools. Do not claim to have read page content beyond its title or listed tools. Preserve Moritz's supplied biography, all product facts, the statement that the source code is open source and publicly viewable, the supplied individual price and currency, the 14-day organisation trial, the privacy statements, both exact website URLs, the greeting, and the sign-off. The entire outreach must be strictly self-service. Never offer, promise, or imply any future personal action or availability from Moritz or his team: no presentations, demos, calls, meetings, scheduling, personal onboarding, advice, follow-ups, sending materials, or manual setup. This also prohibits polite offers such as “Ich stelle der Person die Plattform gerne kurz vor” or “Bei Fragen stehe ich gerne zur Verfügung”. Recipients must be able to explore, try, and use the platform independently through the supplied website links. Calls to action may only ask recipients to visit or try the website, add a link, or forward the link internally; never ask for an introduction or contact details so Moritz can follow up. Remove any conflicting offer from the supplied draft; this self-service rule takes precedence over preserving wording or claims. Preserve the supplied self-service call to action exactly as the final question; do not replace it with a generic usefulness question. Do not assume the recipient always works with pupils. Keep the two URLs exactly as plain-text URLs on their own lines. Do not add, remove, or alter factual claims. For Swiss German emails, keep “Guten Tag” without a comma on its own line, followed by a blank line, and start the next paragraph with a capital letter: “Guten Tag\n\nAuf Ihrer Seite …”, never “Guten Tag\n\nauf Ihrer Seite …”. Preserve the supplied salutation punctuation; do not import the lowercase continuation used after a comma in German correspondence. Use the supplied language and return only the requested JSON. No HTML or Markdown.`
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      max_tokens: 900,
      system,
      messages: [{ role: 'user', content: JSON.stringify({ language: draft.lang, organization: draft.name, pageTitle: draft.pageTitle, pageUrl: draft.url, listedTools: draft.listedTools, requiredCallToAction: outreachCallToAction(draft), originalSubject: draft.subject, originalBody: draft.body }) }],
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
  const urls = draft.body.split(/\r?\n/).filter((line) => /^https:\/\/whatshouldistudy\.ch(?:\/[a-z-]+)*(?:\/organisationen)?$/.test(line))
  const prices = [...draft.body.matchAll(/CHF\s*17|17\s*CHF|€\s*17|17\s*€/g)].map(([price]) => price)
  const requiredCallToAction = outreachCallToAction(draft)
  if (typeof parsed.body !== 'string' || !parsed.body.trim() || parsed.body.length > 10_000 || /<\/?[a-z][^>]*>/i.test(parsed.body)) throw new Error('Anthropic returned an invalid body')
  if (urls.some((url) => !parsed.body.includes(url))) throw new Error('Anthropic removed a required website link')
  if (requiredCallToAction && !parsed.body.includes(requiredCallToAction)) throw new Error('Anthropic removed or changed the concrete call to action')
  if (prices.some((price) => !parsed.body.includes(price))) throw new Error('Anthropic removed or changed the individual price')
  if (/14 Tage|14 jours|14 giorni/.test(draft.body) && !/14 Tage|14 jours|14 giorni/.test(parsed.body)) throw new Error('Anthropic removed the organisation trial')
  if (/open source/i.test(draft.body)) {
    const publicSource = draft.lang === 'de'
      ? /öffentlich (?:einsehbar|zugänglich)|für alle (?:öffentlich )?einsehbar/i
      : draft.lang === 'fr'
        ? /accessible au public|consultable par (?:tous|toutes)|publiquement accessible/i
        : /consultabile pubblicamente|accessibile al pubblico|visibile a tutti/i
    if (!/open source/i.test(parsed.body) || !publicSource.test(parsed.body)) throw new Error('Anthropic removed the public open-source statement')
  }
  const swissGerman = draft.lang === 'de' && !/https:\/\/whatshouldistudy\.ch\/(?:deutschland|oesterreich)(?:\/|\s|$)/.test(draft.body)
  if (swissGerman && /ß/.test(parsed.body)) throw new Error('Anthropic returned non-Swiss German spelling')
  return { body: parsed.body.trim() }
}

export async function POST(req: Request) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 })
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > 150_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })

  let drafts: DraftInput[]
  let humanizerSkill: string
  let signatureHtml: string
  try {
    const input = await req.json() as { drafts?: unknown; humanizerSkill?: unknown; signatureHtml?: unknown }
    if (!Array.isArray(input.drafts) || input.drafts.length !== 1) throw new Error('Invalid batch')
    if (typeof input.humanizerSkill !== 'string' || input.humanizerSkill.length < 1_000 || input.humanizerSkill.length > 50_000) throw new Error('Invalid humanizer skill')
    if (typeof input.signatureHtml !== 'string' || input.signatureHtml.length < 1 || input.signatureHtml.length > 20_000 || /<(script|iframe|object)\b|javascript:|\son[a-z]+\s*=/i.test(input.signatureHtml)) throw new Error('Invalid signature')
    humanizerSkill = input.humanizerSkill
    signatureHtml = input.signatureHtml
    drafts = input.drafts as DraftInput[]
    if (drafts.some((draft) => !draft || !/^[a-z0-9-]{1,100}$/.test(draft.id) || typeof draft.name !== 'string' || typeof draft.to !== 'string' || typeof draft.url !== 'string' || !['de', 'fr', 'it'].includes(draft.lang) || typeof draft.pageTitle !== 'string' || draft.pageTitle.length > 500 || !Array.isArray(draft.listedTools) || draft.listedTools.length > 20 || draft.listedTools.some((tool) => typeof tool !== 'string' || tool.length > 100) || typeof draft.opening !== 'string' || draft.opening.length > 600 || typeof draft.subject !== 'string' || typeof draft.body !== 'string' || draft.to.length > 254 || draft.subject.length > 200 || draft.body.length > 10_000)) throw new Error('Invalid draft')
    for (const draft of drafts) {
      if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(draft.to)) throw new Error('Invalid recipient')
      if (draft.callToAction !== undefined && typeof draft.callToAction !== 'string') throw new Error('Invalid question')
      outreachCallToAction(draft)
    }
  } catch {
    return NextResponse.json({ error: 'Invalid draft batch' }, { status: 400 })
  }

  const host = process.env.IMAP_HOST || 'mail.infomaniak.com'
  const port = Number(process.env.IMAP_PORT || 993)
  const user = process.env.SMTP_USER || process.env.SMTP_ADMIN_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'team@whatshouldistudy.com'
  const password = process.env.SMTP_PASSWORD || process.env.SMTP_PASS
  if (!password) return NextResponse.json({ error: 'Mailbox password is not configured' }, { status: 503 })
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  const client = new ImapFlow({ host, port, secure: true, auth: { user, pass: password }, logger: false, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 })
  const deadline = setTimeout(() => client.close(), 50_000)
  try {
    await client.connect()
    const mailboxes = await client.list()
    const draftsMailbox = mailboxes.find((mailbox) => mailbox.specialUse === '\\Drafts') ?? mailboxes.find((mailbox) => /(^|[./])(drafts|entwürfe)$/i.test(mailbox.path))
    const sentMailbox = mailboxes.find((mailbox) => mailbox.specialUse === '\\Sent') ?? mailboxes.find((mailbox) => /(^|[./])(sent|sent items|gesendet)$/i.test(mailbox.path))
    if (!draftsMailbox || !sentMailbox) throw new Error('Required Infomaniak folders not found')

    let created = 0
    let skipped = 0
    let humanized = 0
    for (const draft of drafts) {
      if (await existingOutreach(client, [sentMailbox.path, draftsMailbox.path], draft)) {
        skipped++
        continue
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
      const appended = await client.append(draftsMailbox.path, rawMessage(finalized, user, process.env.SMTP_SENDER_NAME || 'Moritz Lauper | wasstudieren', signatureHtml), ['\\Draft'])
      if (!appended) throw new Error(`Could not create draft ${draft.id}`)
      created++
    }
    return NextResponse.json({ created, skipped, humanized })
  } catch (error) {
    const mailError = error as Error & { code?: string; responseCode?: number }
    console.error('Outreach IMAP draft creation failed', { code: mailError.code ?? 'UNKNOWN', responseCode: mailError.responseCode })
    return NextResponse.json({ error: 'Could not create the mailbox drafts' }, { status: 502 })
  } finally {
    clearTimeout(deadline)
    if (client.usable) await client.logout().catch(() => {})
    else client.close()
  }
}
