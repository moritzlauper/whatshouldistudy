/**
 * Swiss higher education institutions: type, place, language, fees and who
 * gets in. Fees are per semester in CHF for 2025/26, rounded and without
 * guarantee (semester fee incl. typical mandatory charges); `foreign` is the
 * fee for students with a foreign school-leaving certificate where it differs.
 *
 * `aliases` are the names under which the Federal Statistical Office (BFS)
 * lists the institution, used to match its data.
 */

export type ChType = 'uni' | 'eth' | 'fh' | 'ph'

export interface ChInstitution {
  id: string
  name: string
  type: ChType
  city: string
  canton: string
  url: string
  languages: string[]
  /** Unknown for some private schools. */
  feeCh?: number
  feeForeign?: number
  aliases: string[]
}

export const CH_TYPE_LABEL: Record<ChType, { de: string; en: string }> = {
  uni: { de: 'Universität', en: 'University' },
  eth: { de: 'ETH', en: 'Federal Institute of Technology' },
  fh: { de: 'Fachhochschule', en: 'University of Applied Sciences' },
  ph: { de: 'Pädagogische Hochschule', en: 'University of Teacher Education' },
}

/** Who gets in, by type of institution. */
export const CH_ADMISSION: Record<ChType, { de: string; en: string }> = {
  uni: {
    de: 'Gymnasiale Matura · Berufs- oder Fachmatura mit Passerelle',
    en: 'Swiss Matura (Gymnasium) · vocational Matura plus Passerelle',
  },
  eth: {
    de: 'Gymnasiale Matura · Berufs- oder Fachmatura mit Passerelle · ausländische Abschlüsse teils mit Aufnahmeprüfung',
    en: 'Swiss Matura (Gymnasium) · vocational Matura plus Passerelle · foreign diplomas partly with entrance exam',
  },
  fh: {
    de: 'Berufsmatura in passender Richtung · gymnasiale Matura oder Fachmatura plus ein Jahr Arbeitswelterfahrung',
    en: 'Vocational Matura in a related field · Swiss Matura plus one year of work experience',
  },
  ph: {
    de: 'Gymnasiale Matura · Fachmatura Pädagogik · Berufsmatura mit Ergänzungsprüfung',
    en: 'Swiss Matura (Gymnasium) · specialised Matura in education · vocational Matura with supplementary exam',
  },
}

export const CH_INSTITUTIONS: ChInstitution[] = [
  // Federal institutes of technology
  { id: 'ethz', name: 'ETH Zürich', type: 'eth', city: 'Zürich', canton: 'ZH', url: 'https://ethz.ch', languages: ['de', 'en'], feeCh: 730, aliases: ['ETH Zürich', 'ETHZ', 'Eidgenössische Technische Hochschule Zürich', 'ETH Zurich', 'ETH'] },
  { id: 'epfl', name: 'EPFL', type: 'eth', city: 'Lausanne', canton: 'VD', url: 'https://www.epfl.ch', languages: ['fr', 'en'], feeCh: 730, aliases: ['EPFL', 'EPF Lausanne', 'Ecole polytechnique fédérale de Lausanne', 'ETH Lausanne', 'EPF'] },
  // Cantonal universities
  { id: 'uzh', name: 'Universität Zürich', type: 'uni', city: 'Zürich', canton: 'ZH', url: 'https://www.uzh.ch', languages: ['de', 'en'], feeCh: 770, aliases: ['Universität Zürich', 'UZH', 'Zürich UNI', 'Uni Zürich', 'ZH'] },
  { id: 'unibe', name: 'Universität Bern', type: 'uni', city: 'Bern', canton: 'BE', url: 'https://www.unibe.ch', languages: ['de', 'en'], feeCh: 750, feeForeign: 950, aliases: ['Universität Bern', 'UniBE', 'Bern UNI', 'Uni Bern', 'BE'] },
  { id: 'unibas', name: 'Universität Basel', type: 'uni', city: 'Basel', canton: 'BS', url: 'https://www.unibas.ch', languages: ['de', 'en'], feeCh: 850, aliases: ['Universität Basel', 'UniBas', 'Basel UNI', 'Uni Basel', 'BS'] },
  { id: 'unilu', name: 'Universität Luzern', type: 'uni', city: 'Luzern', canton: 'LU', url: 'https://www.unilu.ch', languages: ['de'], feeCh: 810, feeForeign: 1210, aliases: ['Universität Luzern', 'UniLU', 'Luzern UNI', 'Uni Luzern', 'LU'] },
  { id: 'unisg', name: 'Universität St. Gallen (HSG)', type: 'uni', city: 'St. Gallen', canton: 'SG', url: 'https://www.unisg.ch', languages: ['de', 'en'], feeCh: 1229, feeForeign: 3129, aliases: ['Universität St. Gallen', 'HSG', 'St. Gallen UNI', 'Universität St.Gallen', 'SG'] },
  { id: 'unifr', name: 'Université de Fribourg / Universität Freiburg', type: 'uni', city: 'Fribourg', canton: 'FR', url: 'https://www.unifr.ch', languages: ['fr', 'de', 'en'], feeCh: 720, feeForeign: 870, aliases: ['Université de Fribourg', 'Universität Freiburg', 'Fribourg UNI', 'UniFR', 'FR'] },
  { id: 'unige', name: 'Université de Genève', type: 'uni', city: 'Genève', canton: 'GE', url: 'https://www.unige.ch', languages: ['fr', 'en'], feeCh: 500, aliases: ['Université de Genève', 'Genève UNI', 'UniGE', 'Universität Genf', 'GE'] },
  { id: 'unil', name: 'Université de Lausanne', type: 'uni', city: 'Lausanne', canton: 'VD', url: 'https://www.unil.ch', languages: ['fr', 'en'], feeCh: 580, aliases: ['Université de Lausanne', 'Lausanne UNI', 'UNIL', 'Universität Lausanne', 'LS'] },
  { id: 'unine', name: 'Université de Neuchâtel', type: 'uni', city: 'Neuchâtel', canton: 'NE', url: 'https://www.unine.ch', languages: ['fr', 'en'], feeCh: 515, feeForeign: 790, aliases: ['Université de Neuchâtel', 'Neuchâtel UNI', 'UniNE', 'Universität Neuenburg', 'NE'] },
  { id: 'usi', name: 'Università della Svizzera italiana', type: 'uni', city: 'Lugano', canton: 'TI', url: 'https://www.usi.ch', languages: ['it', 'en'], feeCh: 2000, feeForeign: 4000, aliases: ['Università della Svizzera italiana', 'USI', 'Lugano UNI', 'Universität der italienischen Schweiz', 'LUG'] },
  { id: 'unidistance', name: 'UniDistance Suisse', type: 'uni', city: 'Brig', canton: 'VS', url: 'https://unidistance.ch', languages: ['de', 'fr', 'en'], feeCh: 1200, aliases: ['UniDistance Suisse', 'Fernuniversität Schweiz', 'FernUni Schweiz', 'UniDistance', 'FS-CH', 'FernUni'] },
  { id: 'iheid', name: 'Geneva Graduate Institute (IHEID)', type: 'uni', city: 'Genève', canton: 'GE', url: 'https://www.graduateinstitute.ch', languages: ['en', 'fr'], feeCh: 1000, aliases: ['IHEID', 'Geneva Graduate Institute', 'Institut de hautes études internationales et du développement'] },
  // Universities of applied sciences
  { id: 'bfh', name: 'Berner Fachhochschule', type: 'fh', city: 'Bern', canton: 'BE', url: 'https://www.bfh.ch', languages: ['de', 'fr'], feeCh: 750, feeForeign: 950, aliases: ['Berner Fachhochschule', 'BFH'] },
  { id: 'hes-so', name: 'HES-SO Haute école spécialisée de Suisse occidentale', type: 'fh', city: 'Delémont', canton: 'JU', url: 'https://www.hes-so.ch', languages: ['fr', 'de'], feeCh: 500, aliases: ['HES-SO', 'Haute école spécialisée de Suisse occidentale', 'Fachhochschule Westschweiz'] },
  { id: 'fhnw', name: 'Fachhochschule Nordwestschweiz', type: 'fh', city: 'Windisch', canton: 'AG', url: 'https://www.fhnw.ch', languages: ['de', 'en'], feeCh: 700, feeForeign: 1000, aliases: ['Fachhochschule Nordwestschweiz', 'FHNW'] },
  { id: 'zfh', name: 'ZHAW Zürcher Hochschule für Angewandte Wissenschaften', type: 'fh', city: 'Winterthur', canton: 'ZH', url: 'https://www.zhaw.ch', languages: ['de', 'en'], feeCh: 720, feeForeign: 1220, aliases: ['ZHAW', 'Zürcher Hochschule für Angewandte Wissenschaften', 'Zürcher Fachhochschule', 'ZFH'] },
  { id: 'zhdk', name: 'Zürcher Hochschule der Künste', type: 'fh', city: 'Zürich', canton: 'ZH', url: 'https://www.zhdk.ch', languages: ['de', 'en'], feeCh: 720, feeForeign: 1220, aliases: ['Zürcher Hochschule der Künste', 'ZHdK'] },
  { id: 'hslu', name: 'Hochschule Luzern', type: 'fh', city: 'Luzern', canton: 'LU', url: 'https://www.hslu.ch', languages: ['de', 'en'], feeCh: 800, feeForeign: 1000, aliases: ['Hochschule Luzern', 'HSLU', 'Fachhochschule Zentralschweiz'] },
  { id: 'ost', name: 'OST Ostschweizer Fachhochschule', type: 'fh', city: 'St. Gallen', canton: 'SG', url: 'https://www.ost.ch', languages: ['de'], feeCh: 750, feeForeign: 1050, aliases: ['OST Ostschweizer Fachhochschule', 'OST', 'Ostschweizer Fachhochschule', 'FHO Fachhochschule Ostschweiz', 'Fachhochschule Ostschweiz', 'FHO'] },
  { id: 'supsi', name: 'SUPSI Scuola universitaria professionale della Svizzera italiana', type: 'fh', city: 'Mendrisio', canton: 'TI', url: 'https://www.supsi.ch', languages: ['it', 'en'], feeCh: 800, feeForeign: 1600, aliases: ['SUPSI', 'Scuola universitaria professionale della Svizzera italiana', 'Fachhochschule der italienischen Schweiz'] },
  { id: 'ffhs', name: 'Fernfachhochschule Schweiz', type: 'fh', city: 'Brig', canton: 'VS', url: 'https://www.ffhs.ch', languages: ['de'], feeCh: 3500, aliases: ['Fernfachhochschule Schweiz', 'FFHS'] },
  { id: 'kalaidos', name: 'Kalaidos Fachhochschule', type: 'fh', city: 'Zürich', canton: 'ZH', url: 'https://www.kalaidos-fh.ch', languages: ['de'], feeCh: 5000, aliases: ['Kalaidos Fachhochschule', 'Kalaidos FH', 'Kalaidos', 'Kal FH'] },
  { id: 'fhgr', name: 'Fachhochschule Graubünden', type: 'fh', city: 'Chur', canton: 'GR', url: 'https://www.fhgr.ch', languages: ['de', 'en'], feeCh: 750, feeForeign: 950, aliases: ['TH CHUR', 'FHGR', 'Fachhochschule Graubünden', 'FH Graubünden', 'Technische Hochschule Graubünden', 'HTW Chur'] },
  { id: 'hwz', name: 'HWZ Hochschule für Wirtschaft Zürich', type: 'fh', city: 'Zürich', canton: 'ZH', url: 'https://fh-hwz.ch', languages: ['de'], aliases: ['HWZ', 'Hochschule für Wirtschaft Zürich'] },
  { id: 'ehsm', name: 'Eidgenössische Hochschule für Sport Magglingen', type: 'fh', city: 'Magglingen', canton: 'BE', url: 'https://www.ehsm.admin.ch', languages: ['de', 'fr'], feeCh: 700, aliases: ['EHSM', 'Eidgenössische Hochschule für Sport Magglingen'] },
  { id: 'hfh', name: 'Interkantonale Hochschule für Heilpädagogik', type: 'ph', city: 'Zürich', canton: 'ZH', url: 'https://www.hfh.ch', languages: ['de'], feeCh: 700, aliases: ['Interkantonale Hochschule für Heilpädagogik', 'HfH'] },
  // Universities of teacher education
  { id: 'phzh', name: 'Pädagogische Hochschule Zürich', type: 'ph', city: 'Zürich', canton: 'ZH', url: 'https://phzh.ch', languages: ['de'], feeCh: 720, aliases: ['Pädagogische Hochschule Zürich', 'PHZH'] },
  { id: 'phbern', name: 'PHBern', type: 'ph', city: 'Bern', canton: 'BE', url: 'https://www.phbern.ch', languages: ['de'], feeCh: 750, aliases: ['Pädagogische Hochschule Bern', 'PHBern', 'PH Bern'] },
  { id: 'phlu', name: 'Pädagogische Hochschule Luzern', type: 'ph', city: 'Luzern', canton: 'LU', url: 'https://www.phlu.ch', languages: ['de'], feeCh: 800, aliases: ['Pädagogische Hochschule Luzern', 'PH Luzern', 'PHLU'] },
  { id: 'phsg', name: 'Pädagogische Hochschule St. Gallen', type: 'ph', city: 'St. Gallen', canton: 'SG', url: 'https://www.phsg.ch', languages: ['de'], feeCh: 700, aliases: ['Pädagogische Hochschule St. Gallen', 'PHSG', 'PH St. Gallen'] },
  { id: 'phtg', name: 'Pädagogische Hochschule Thurgau', type: 'ph', city: 'Kreuzlingen', canton: 'TG', url: 'https://www.phtg.ch', languages: ['de'], feeCh: 700, aliases: ['Pädagogische Hochschule Thurgau', 'PHTG', 'PH Thurgau'] },
  { id: 'phsz', name: 'Pädagogische Hochschule Schwyz', type: 'ph', city: 'Goldau', canton: 'SZ', url: 'https://www.phsz.ch', languages: ['de'], feeCh: 700, aliases: ['Pädagogische Hochschule Schwyz', 'PHSZ', 'PH Schwyz'] },
  { id: 'phzg', name: 'Pädagogische Hochschule Zug', type: 'ph', city: 'Zug', canton: 'ZG', url: 'https://www.phzg.ch', languages: ['de'], feeCh: 700, aliases: ['Pädagogische Hochschule Zug', 'PH Zug', 'PHZG'] },
  { id: 'phsh', name: 'Pädagogische Hochschule Schaffhausen', type: 'ph', city: 'Schaffhausen', canton: 'SH', url: 'https://www.phsh.ch', languages: ['de'], feeCh: 700, aliases: ['Pädagogische Hochschule Schaffhausen', 'PHSH', 'PH Schaffhausen'] },
  { id: 'phgr', name: 'Pädagogische Hochschule Graubünden', type: 'ph', city: 'Chur', canton: 'GR', url: 'https://phgr.ch', languages: ['de', 'it', 'rm'], feeCh: 700, aliases: ['Pädagogische Hochschule Graubünden', 'PHGR', 'PH Graubünden'] },
  { id: 'phvs', name: 'Pädagogische Hochschule Wallis / HEP-VS', type: 'ph', city: 'Brig', canton: 'VS', url: 'https://www.hepvs.ch', languages: ['de', 'fr'], feeCh: 700, aliases: ['Pädagogische Hochschule Wallis', 'HEP-VS', 'PH Wallis', 'Haute école pédagogique du Valais'] },
  { id: 'hepvd', name: 'Haute école pédagogique Vaud', type: 'ph', city: 'Lausanne', canton: 'VD', url: 'https://www.hepl.ch', languages: ['fr'], feeCh: 600, aliases: ['Haute école pédagogique Vaud', 'HEP Vaud', 'HEP-VD', 'Pädagogische Hochschule Waadt'] },
  { id: 'hepbejune', name: 'HEP-BEJUNE', type: 'ph', city: 'Delémont', canton: 'JU', url: 'https://www.hep-bejune.ch', languages: ['fr'], feeCh: 600, aliases: ['HEP-BEJUNE', 'Haute école pédagogique BEJUNE', 'PH Bern-Jura-Neuenburg'] },
  { id: 'hepfr', name: 'HEP | PH FR', type: 'ph', city: 'Fribourg', canton: 'FR', url: 'https://www.hepfr.ch', languages: ['fr', 'de'], feeCh: 600, aliases: ['HEP Fribourg', 'PH Freiburg', 'Pädagogische Hochschule Freiburg', 'Haute école pédagogique Fribourg', 'HEP | PH FR'] },
  { id: 'dfa', name: 'SUPSI-DFA (Formazione docenti)', type: 'ph', city: 'Locarno', canton: 'TI', url: 'https://www.supsi.ch/dfa', languages: ['it'], feeCh: 800, aliases: ['SUPSI-DFA', 'Dipartimento formazione e apprendimento', 'DFA'] },
  { id: 'fhnw-ph', name: 'Pädagogische Hochschule FHNW', type: 'ph', city: 'Windisch', canton: 'AG', url: 'https://www.fhnw.ch/ph', languages: ['de'], feeCh: 700, aliases: ['Pädagogische Hochschule FHNW', 'PH FHNW'] },
]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

const BY_ALIAS = new Map<string, ChInstitution>()
for (const i of CH_INSTITUTIONS) for (const a of [i.name, ...i.aliases]) BY_ALIAS.set(norm(a), i)

/** Finds an institution by any of its names (exact, then by containment). */
export function findChInstitution(name: string): ChInstitution | undefined {
  const n = norm(name)
  const exact = BY_ALIAS.get(n)
  if (exact) return exact
  if (n.length <= 3) return undefined
  for (const [alias, inst] of BY_ALIAS) if (alias.length > 3 && (n.includes(alias) || alias.includes(n))) return inst
  return undefined
}
