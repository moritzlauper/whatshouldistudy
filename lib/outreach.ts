/** Swiss-style German greetings have no comma; the next paragraph starts a sentence. */
export function formatOutreachGreeting(body: string, lang: string): string {
  if (lang !== 'de') return body
  return body.replace(/^(\s*Guten Tag[^\r\n,]*\r?\n\s*)(\p{Ll})/u, (_match, greeting: string, firstLetter: string) => greeting + firstLetter.toLocaleUpperCase('de-CH'))
}

/** Explicit in new clients; legacy drafts put the question before farewell/signature. */
export function outreachCallToAction(draft: { body: string; callToAction?: string }): string {
  const question = draft.callToAction ?? draft.body.trim().split(/\n{2,}/).at(-3)
  if (!question || !question.includes('?') || !draft.body.includes(question)) throw new Error('Invalid call to action')
  return question
}

interface MailboxReader {
  mailboxOpen(path: string, options: { readOnly: boolean }): Promise<unknown>
  search(query: { or: Array<{ header: Record<string, string> } | { to: string }> }): Promise<number[] | false | undefined>
}

/** Read only: preserve edited drafts and recognise sent mail even if its custom header was stripped. */
export async function existingOutreach(client: MailboxReader, mailboxes: string[], draft: { id: string; to: string }): Promise<boolean> {
  for (const mailbox of mailboxes) {
    await client.mailboxOpen(mailbox, { readOnly: true })
    const matches = await client.search({ or: [{ header: { 'X-Outreach-ID': draft.id } }, { to: draft.to }] })
    if (!Array.isArray(matches)) throw new Error('Mailbox duplicate check failed')
    if (matches.length) return true
  }
  return false
}
