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
  subject: string
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
  const body = [draft.body.trim(), '', `Quelle: ${draft.url}`].join('\n')
  return `${headers.join('\r\n')}\r\n\r\n${Buffer.from(body, 'utf8').toString('base64')}`
}

export async function POST(req: Request) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 })
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > 150_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })

  let drafts: DraftInput[]
  try {
    const input = await req.json() as { drafts?: unknown }
    if (!Array.isArray(input.drafts) || input.drafts.length > 10) throw new Error('Invalid batch')
    drafts = input.drafts as DraftInput[]
    if (drafts.some((draft) => !draft || !/^[a-z0-9-]{1,100}$/.test(draft.id) || typeof draft.name !== 'string' || typeof draft.to !== 'string' || typeof draft.url !== 'string' || typeof draft.subject !== 'string' || typeof draft.body !== 'string' || draft.to.length > 254 || draft.subject.length > 200 || draft.body.length > 10_000)) throw new Error('Invalid draft')
  } catch {
    return NextResponse.json({ error: 'Invalid draft batch' }, { status: 400 })
  }

  const host = process.env.IMAP_HOST || 'mail.infomaniak.com'
  const port = Number(process.env.IMAP_PORT || 993)
  const user = process.env.SMTP_USER || process.env.SMTP_ADMIN_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'team@whatshouldistudy.com'
  const password = process.env.SMTP_PASSWORD || process.env.SMTP_PASS
  if (!password) return NextResponse.json({ error: 'Mailbox password is not configured' }, { status: 503 })

  const client = new ImapFlow({ host, port, secure: true, auth: { user, pass: password }, logger: false, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 })
  try {
    await client.connect()
    const mailboxes = await client.list()
    const draftsMailbox = mailboxes.find((mailbox) => mailbox.specialUse === '\\Drafts') ?? mailboxes.find((mailbox) => /(^|[./])(drafts|entwürfe)$/i.test(mailbox.path))
    const sentMailbox = mailboxes.find((mailbox) => mailbox.specialUse === '\\Sent') ?? mailboxes.find((mailbox) => /(^|[./])(sent|sent items|gesendet)$/i.test(mailbox.path))
    if (!draftsMailbox) throw new Error('Infomaniak Drafts folder not found')

    let created = 0
    let skipped = 0
    for (const draft of drafts) {
      let exists = false
      for (const mailbox of [draftsMailbox, sentMailbox].filter(Boolean)) {
        await client.mailboxOpen(mailbox!.path, { readOnly: true })
        const matches = await client.search({ header: { 'X-Outreach-ID': draft.id } })
        if (matches && matches.length > 0) {
          exists = true
          break
        }
      }
      if (exists) {
        skipped++
        continue
      }
      const appended = await client.append(draftsMailbox.path, rawMessage(draft, user, process.env.SMTP_SENDER_NAME || 'whatshouldistudy'), ['\\Draft'])
      if (!appended) throw new Error(`Could not create draft ${draft.id}`)
      created++
    }
    return NextResponse.json({ created, skipped })
  } catch (error) {
    const mailError = error as Error & { code?: string; responseCode?: number }
    console.error('Outreach IMAP draft creation failed', { code: mailError.code ?? 'UNKNOWN', responseCode: mailError.responseCode })
    return NextResponse.json({ error: 'Could not create the mailbox drafts' }, { status: 502 })
  } finally {
    if (client.usable) await client.logout().catch(() => {})
    else client.close()
  }
}