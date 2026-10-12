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
    url: 'https://www.wiso.unibe.ch/studies/study_programs/master_s_in_sociology/index_eng.html',
  },
  {
    host: 'unine.ch',
    level: 'master',
    name: /soziolog|sociolog/i,
    url: 'https://www.unine.ch/socio/formation/sociologie-master',
  },
  {
    host: 'usi.ch',
    level: 'bachelor',
    name: /^Bachelor Philosophie$/,
    url: 'https://www.usi.ch/it/formazione/bachelor/filosofia',
  },
  {
    host: 'usi.ch',
    level: 'master',
    name: /^Master Philosophie$/,
    url: 'https://www.usi.ch/en/education/master/philosophy',
  },
  {
    host: 'unine.ch',
    level: 'master',
    name: /^Master Philosophie$/,
    url: 'https://www.unine.ch/unine/home/formation/masters/lettres-et-sciences-humaines/master_flsh/philosophie/philosophy.html',
  },
  {
    host: 'usi.ch',
    level: 'bachelor',
    name: /^Bachelor Italienische Sprach- und Literaturwissenschaften$/,
    url: 'https://www.usi.ch/bllci',
  },
  {
    host: 'unidistance.ch',
    level: 'bachelor',
    name: /^Bachelor Historische und Kulturwissenschaften \(fächerübergreifend\)$/,
    url: 'https://unidistance.ch/en/studies/bachelor/bachelor-in-history',
  },
  {
    host: 'unidistance.ch',
    level: 'master',
    name: /^Master Historische und Kulturwissenschaften \(fächerübergreifend\)$/,
    url: 'https://unidistance.ch/en/history/master',
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
