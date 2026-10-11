/**
 * Official pages of study programmes, checked by hand. For Swiss universities the
 * statistics name the institution and the programme, but not the programme's page,
 * so there was nothing to read. Where an entry exists here, it is used for the
 * reading and for the link; otherwise the feed's own link is used.
 */

interface OfficialPage {
  /** The institution's domain, without «www.». */
  host: string
  level: string
  /** The programme's name. */
  name: RegExp
  url: string
}

const OFFICIAL_PAGES: OfficialPage[] = [
  {
    host: 'unibe.ch',
    level: 'master',
    name: /soziolog|sociolog/i,
    url: 'https://www.soz.unibe.ch/studium/studienprogramme/master_soziologie/index_ger.htm',
  },
  {
    host: 'unine.ch',
    level: 'master',
    name: /soziolog|sociolog/i,
    url: 'https://www.unine.ch/socio/formation/sociologie-master',
  },
]

/** The programme's own official page, when one is checked and listed here. */
export function officialPageOf(p: { name: string; level: string; institutionUrl?: string }): string | undefined {
  if (!p.institutionUrl) return undefined
  let host: string
  try {
    host = new URL(p.institutionUrl).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
  return OFFICIAL_PAGES.find((o) => o.host === host && o.level === p.level && o.name.test(p.name))?.url
}
