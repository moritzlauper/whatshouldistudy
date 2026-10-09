import { regionalize } from './site/regional.ts'

/** Domain and name of each country site, as the outreach mails link and sign them. */
const OUTREACH_SITES = [
  { domain: 'wasstudieren.ch', name: 'wasstudieren' },
  { domain: 'findemeinstudium.de', name: 'findemeinstudium' },
  { domain: 'wasstudieren.at', name: 'wasstudieren' },
  // The Swiss French and Italian versions.
  { domain: 'whatshouldistudy.ch', name: 'whatshouldistudy' },
]
const DOMAIN = '(?:wasstudieren\\.(?:ch|at)|findemeinstudium\\.de|whatshouldistudy\\.ch)'
const NAME = '(?:wasstudieren|findemeinstudium|whatshouldistudy)'

/** The country site a draft links to, by its first website line (Switzerland without one). */
export function outreachSite(body: string): { domain: string; name: string } {
  const host = new URL(outreachWebsiteUrls(body)[0] ?? 'https://wasstudieren.ch').hostname
  return OUTREACH_SITES.find((s) => s.domain === host) ?? OUTREACH_SITES[0]
}

/** Canonical country greeting: Swiss sentence start, German/Austrian comma continuation. */
export function formatOutreachGreeting(body: string, lang: string): string {
  if (lang !== 'de') return body
  const swiss = isSwissGermanOutreach(body, lang)
  if (!swiss) {
    const austrian = outreachWebsiteUrls(body).some((url) => new URL(url).hostname === 'wasstudieren.at')
    body = regionalize(body, austrian ? 'de-AT' : 'de-DE')
  }
  return body.replace(/^\s*Guten Tag,?\s+(\p{L})/u, (_match, firstLetter: string) => {
    const continuation = swiss ? firstLetter.toLocaleUpperCase('de-CH') : firstLetter.toLocaleLowerCase('de-DE')
    return `Guten Tag${swiss ? '' : ','}\n\n${continuation}`
  })
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

/** Exact website lines that the rewrite must preserve. */
export function outreachWebsiteUrls(body: string): string[] {
  return body.split(/\r?\n/).filter((line) => new RegExp(`^https://${DOMAIN}(?:/[a-z-]+)*$`).test(line))
}

export function isSwissGermanOutreach(body: string, lang: string): boolean {
  return lang === 'de' && !outreachWebsiteUrls(body).some((url) => {
    const parsed = new URL(url)
    return parsed.hostname !== 'wasstudieren.ch' || /^\/(?:deutschland|oesterreich)(?:\/|$)/.test(parsed.pathname)
  })
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function outreachHtmlBody(body: string, signatureHtml: string): string {
  const site = outreachSite(body)
  // The mail's first link is the site's home in its language (whatshouldistudy.ch/fr, not the root, which redirects by browser language).
  const home = outreachWebsiteUrls(body)[0] ?? `https://${site.domain}`
  // signature.html is the Swiss one: wasstudieren.ch, with the name on a line of its own and the logo from the global site.
  signatureHtml = signatureHtml
    .replaceAll('href="https://wasstudieren.ch"', `href="${home}"`)
    .replace(/https:\/\/(?:whatshouldistudy\.com|wasstudieren\.ch)\/icon-192\.png/g, `https://${site.domain}/icon-192.png`)
    .replaceAll('wasstudieren.ch', site.domain)
    .replaceAll('>wasstudieren<', `>${site.name}<`)
  const contentBody = body.trim().replace(new RegExp(`\n{2,}Moritz Lauper\n${NAME}\n${DOMAIN}\nteam@whatshouldistudy\\.com$`), '')
  const paragraphs = contentBody.split(/\n{2,}/).map((paragraph) => {
    const content = escapeHtml(paragraph)
      .replace(new RegExp(`https://${DOMAIN}(?:/[a-z-]+)*(?=\\s|$)`, 'g'), (url) => `<a href="${url}">${url}</a>`)
      .replace(/\n/g, '<br>\r\n')
    return `<p style="margin:0 0 12px 0;line-height:1.4">${content}</p>`
  })
  return `<html><body style="margin:0;line-height:1.4">${paragraphs.join('\r\n')}<div style="margin-top:12px">${signatureHtml}</div></body></html>`
}
