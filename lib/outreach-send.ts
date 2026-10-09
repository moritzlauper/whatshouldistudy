import type { ImapFlow } from 'imapflow'
import { existingOutreach } from './outreach.ts'

export const OUTREACH_SEND_LOCK = 'WSIS-Outreach-Send-Lock'

export class OutreachSendBusy extends Error {}

export function outreachDailySendLimit(value = process.env.OUTREACH_DAILY_SEND_LIMIT): number {
  const limit = value === undefined ? 10 : Number(value)
  if (!Number.isInteger(limit) || limit < 0 || limit > 10 || value?.trim() === '') throw new Error('OUTREACH_DAILY_SEND_LIMIT must be an integer between 0 and 10')
  return limit
}

export function outreachDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

type SendMailbox = Pick<ImapFlow, 'mailboxCreate' | 'mailboxDelete' | 'mailboxOpen' | 'search' | 'fetch' | 'append' | 'messageFlagsRemove'>

export async function sendOutreach(
  client: SendMailbox,
  mailboxes: { sent: string; drafts: string },
  draft: { id: string; to: string },
  raw: string,
  deliver: () => Promise<unknown>,
  limit: number,
  now: () => Date = () => new Date(),
): Promise<{ sent: number; skipped: number; limitReached: boolean }> {
  try {
    await client.mailboxCreate(OUTREACH_SEND_LOCK)
  } catch {
    throw new OutreachSendBusy('Outreach sending is locked; retry later or inspect a stale lock')
  }
  try {
    if (await existingOutreach(client, [mailboxes.sent, mailboxes.drafts], draft)) return { sent: 0, skipped: 1, limitReached: false }
    const date = now()
    const day = outreachDay(date)
    await client.mailboxOpen(mailboxes.sent, { readOnly: false })
    const since = new Date(`${day}T00:00:00Z`)
    since.setUTCDate(since.getUTCDate() - 1)
    const matches = await client.search({ header: { 'X-Outreach-ID': '' }, since }, { uid: true })
    if (!Array.isArray(matches)) throw new Error('Outreach daily count failed')
    let count = 0
    let fetched = 0
    if (matches.length) {
      for await (const message of client.fetch(matches, { internalDate: true }, { uid: true })) {
        fetched++
        if (!(message.internalDate instanceof Date)) throw new Error('Outreach message date is missing')
        if (outreachDay(message.internalDate) === day) count++
      }
    }
    if (fetched !== matches.length) throw new Error('Outreach daily count is incomplete')
    if (count >= limit) return { sent: 0, skipped: 0, limitReached: true }
    if (outreachDay(now()) !== day) throw new Error('Outreach day changed; retry the request')
    const reservation = await client.append(mailboxes.sent, raw, ['\\Seen', '\\Draft'], date)
    if (!reservation || !reservation.uid) throw new Error('Could not reserve an outreach send')
    await deliver()
    const finalized = await client.messageFlagsRemove(reservation.uid, ['\\Draft'], { uid: true })
    if (!finalized) throw new Error('Could not finalize the sent copy')
    return { sent: 1, skipped: 0, limitReached: false }
  } finally {
    await client.mailboxDelete(OUTREACH_SEND_LOCK)
  }
}