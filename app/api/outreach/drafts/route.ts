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
  subject: string
  body: string
}

interface HumanizedDraft {
  opening: string
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

function htmlBody(body: string): string {
  const paragraphs = body.trim().split(/\n{2,}/).map((paragraph) => {
    const content = escapeHtml(paragraph)
      .replace(/https:\/\/whatshouldistudy\.ch(?:\/organisationen)?/g, (url) => `<a href="${url}">${url}</a>`)
      .replace(/\n/g, '<br>\r\n')
    return `<p>${content}</p>`
  })
  return `<html><body>${paragraphs.join('\r\n')}</body></html>`
}

function rawMessage(draft: DraftInput, from: string, senderName: string): string {
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
    base64Lines(draft.body.trim()),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(htmlBody(draft.body)),
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return `${headers.join('\r\n')}\r\n\r\n${parts}`
}

async function humanize(draft: DraftInput, apiKey: string | undefined, humanizerSkill: string): Promise<HumanizedDraft> {
  if (!apiKey) return { opening: draft.opening }
  const system = `${humanizerSkill.trim()}

Apply the skill to this one-to-one outreach opening. Only write the opening paragraph as Moritz Lauper. Personalize it using only the supplied organization name, page title, URL, and listed tools. Do not claim to have read page content beyond its title or listed tools. Do not describe, rename, or reduce the product; the reviewed product description stays unchanged. Avoid claiming the page lists tests unless listedTools contains them. Keep the opening to one or two natural, complete sentences. Use the supplied language. Apply Swiss German rules only when the language is German; for French and Italian, use natural, restrained language without inventing details. Plain text only, with no HTML, Markdown, or URLs. Return only the requested JSON.`
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      max_tokens: 180,
      system,
      messages: [{ role: 'user', content: JSON.stringify({ language: draft.lang, organization: draft.name, pageTitle: draft.pageTitle, pageUrl: draft.url, listedTools: draft.listedTools, currentOpening: draft.opening }) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { opening: { type: 'string' } },
            required: ['opening'],
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
  if (typeof parsed.opening !== 'string' || !parsed.opening.trim() || parsed.opening.length > 600 || /[\r\n]/.test(parsed.opening) || /<\/?[a-z][^>]*>/i.test(parsed.opening) || /https?:\/\//i.test(parsed.opening)) throw new Error('Anthropic returned an invalid opening')
  return { opening: parsed.opening.trim() }
}

export async function POST(req: Request) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 })
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > 150_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })

  let drafts: DraftInput[]
  let humanizerSkill: string
  try {
    const input = await req.json() as { drafts?: unknown; humanizerSkill?: unknown }
    if (!Array.isArray(input.drafts) || input.drafts.length > 10) throw new Error('Invalid batch')
    if (typeof input.humanizerSkill !== 'string' || input.humanizerSkill.length < 1_000 || input.humanizerSkill.length > 50_000) throw new Error('Invalid humanizer skill')
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

      let message: HumanizedDraft = { opening: draft.opening }
      if (anthropicKey) {
        try {
          message = await humanize(draft, anthropicKey, humanizerSkill)
          humanized++
        } catch (error) {
          console.warn('Outreach humanization failed; using reviewed template', { code: (error as Error).name })
        }
      }
      const finalized = { ...draft, body: draft.body.replace(draft.opening, message.opening) }
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