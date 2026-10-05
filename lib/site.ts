export const SITE_NAME = 'whatshouldistudy'
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://whatshouldistudy.com').replace(/\/$/, '')
/** The Swiss site's own domain, once it has one (e.g. https://wasstudiere.ch). Until then it lives at /schweiz. */
export const CH_URL = process.env.NEXT_PUBLIC_CH_URL?.replace(/\/$/, '') || ''
export const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@whatshouldistudy.com'

/** Absolute address of a Swiss page, for canonical links and the sitemap. */
export function chUrl(path = ''): string {
  return CH_URL ? `${CH_URL}${path || '/'}` : `${SITE_URL}/schweiz${path}`
}

/** Hosts that serve the Swiss site at their root: WSIS_CH_HOSTS, plus the host of NEXT_PUBLIC_CH_URL. */
export function chHosts(): string[] {
  const hosts = (process.env.WSIS_CH_HOSTS ?? '').split(',')
  if (CH_URL) {
    try {
      const h = new URL(CH_URL).hostname
      hosts.push(h, h.startsWith('www.') ? h.slice(4) : `www.${h}`)
    } catch {
      // Ignore a malformed URL.
    }
  }
  return [...new Set(hosts.map((h) => h.trim().toLowerCase()).filter(Boolean))]
}
