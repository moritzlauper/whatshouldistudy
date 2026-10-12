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
  {
    host: 'ehsm.admin.ch',
    level: 'bachelor',
    name: /^Bachelor Sport$/,
    url: 'https://www.ehsm.admin.ch/de/studium',
  },
  {
    host: 'ehsm.admin.ch',
    level: 'master',
    name: /^Master Spitzensport$/,
    url: 'https://www.ehsm.admin.ch/de/master-studium-spitzensport',
  },
  {
    host: 'zhdk.ch',
    level: 'bachelor',
    name: /^Bachelor Film$/,
    url: 'https://www.zhdk.ch/studium/film',
  },
  {
    host: 'zhdk.ch',
    level: 'bachelor',
    name: /^Bachelor Musik$/,
    url: 'https://www.zhdk.ch/studium/musik',
  },
  {
    host: 'zhdk.ch',
    level: 'master',
    name: /^Master Design$/,
    url: 'https://www.zhdk.ch/studium/design',
  },
  {
    host: 'zhdk.ch',
    level: 'bachelor',
    name: /^Bachelor Theater$/,
    url: 'https://www.zhdk.ch/studium/theater',
  },
  {
    host: 'zhdk.ch',
    level: 'master',
    name: /^Master Theater$/,
    url: 'https://www.zhdk.ch/studium/theater/match',
  },
  {
    host: 'zhdk.ch',
    level: 'bachelor',
    name: /^Bachelor Contemporary Dance$/,
    url: 'https://www.zhdk.ch/studium/tanz/contemporarydance',
  },
  {
    host: 'zhdk.ch',
    level: 'master',
    name: /^Master Transdisziplinarität$/,
    url: 'https://www.zhdk.ch/studium/transdisziplinaritaet',
  },
  {
    host: 'zhdk.ch',
    level: 'master',
    name: /^Master Composition and Theory$/,
    url: 'https://www.zhdk.ch/studium/musik/11773/komposition-theorie-11762',
  },
  {
    host: 'phtg.ch',
    level: 'bachelor',
    name: /^Bachelor Sekundarstufe I$/,
    url: 'https://phtg.ch/studium/sekundarstufe-i',
  },
  {
    host: 'phtg.ch',
    level: 'master',
    name: /^Master Sekundarstufe I$/,
    url: 'https://phtg.ch/studium/sekundarstufe-i',
  },
  {
    host: 'phgr.ch',
    level: 'master',
    name: /^Master Sekundarstufe I$/,
    url: 'https://phgr.ch/de/sub/ausbildung/sekstudium/',
  },
  {
    host: 'phlu.ch',
    level: 'master',
    name: /^Master Sekundarstufe II \(Gymnasiale Maturitätsschulen\)$/,
    url: 'https://www.phlu.ch/studium/studiengaenge/sekundarstufe-2-gymnasiale-bildung.html',
  },
  {
    host: 'phlu.ch',
    level: 'master',
    name: /^Master Sekundarstufe II \(Berufsbildung\)$/,
    url: 'https://www.phlu.ch/studium/studiengaenge/sekundarstufe-2-berufsbildung.html',
  },
  {
    host: 'phlu.ch',
    level: 'master',
    name: /^Master Sekundarstufe I$/,
    url: 'https://www.phlu.ch/studium/studiengaenge/sekundarstufe-1.html',
  },
  {
    host: 'phlu.ch',
    level: 'bachelor',
    name: /^Bachelor Sekundarstufe I$/,
    url: 'https://www.phlu.ch/studium/studiengaenge/sekundarstufe-1.html',
  },
  {
    host: 'phlu.ch',
    level: 'master',
    name: /^Master Heilpädagogik$/,
    url: 'https://www.phlu.ch/studium/studiengaenge/schulische-heilpaedagogik.html',
  },
  {
    host: 'phlu.ch',
    level: 'master',
    name: /^Master Fachdidaktik$/,
    url: 'https://www.phlu.ch/studium/studiengaenge/masterstudiengaenge-fachdidaktik.html',
  },
  {
    host: 'kalaidos-fh.ch',
    level: 'bachelor',
    name: /^Bachelor Pflege$/,
    url: 'https://www.kalaidos-fh.ch/de-CH/Studiengaenge/BSc-Bachelor-Nursing',
  },
  {
    host: 'kalaidos-fh.ch',
    level: 'master',
    name: /^Master Wirtschaftsinformatik$/,
    url: 'https://www.kalaidos-fh.ch/de-CH/Studiengaenge/MSc-Master-Business-Information-Technology',
  },
  {
    host: 'kalaidos-fh.ch',
    level: 'bachelor',
    name: /^Bachelor Wirtschaftsinformatik$/,
    url: 'https://www.kalaidos-fh.ch/de-CH/Studiengaenge/BSc-Bachelor-Business-Information-Technology',
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
