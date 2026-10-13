/**
 * DBH institution codes (table 211) joined to official websites listed by HK-dir:
 * https://studyinnorway.no/higher-education-institutions-norway (checked 2026-10-13).
 * The DBH API omits its documented Nettside field; English directory names do not
 * match the Norwegian programme rows. Unlisted institutions remain unknown.
 */
export const NO_WEBSITES: Record<string, string> = {
  '0217': 'https://samas.no/', '0232': 'https://www.himolde.no/',
  '0236': 'https://www.hivolda.no/', '0238': 'https://www.hvl.no/',
  '0256': 'https://www.hiof.no/', '1110': 'https://www.uio.no/',
  '1120': 'https://www.uib.no/', '1130': 'https://uit.no/',
  '1150': 'https://www.ntnu.no/', '1160': 'https://www.uis.no/',
  '1171': 'https://www.uia.no/', '1173': 'https://www.nmbu.no/',
  '1174': 'https://www.nord.no/', '1175': 'https://www.oslomet.no/',
  '1176': 'https://www.usn.no/', '1177': 'https://www.inn.no/',
  '1210': 'https://nmh.no/', '1220': 'https://www.aho.no/',
  '1240': 'https://www.nhh.no/', '1260': 'https://www.nih.no/',
  '1301': 'https://www.politihogskolen.no/', '1302': 'https://www.krus.no/',
  '1303': 'https://www.forsvaret.no/', '1404': 'https://www.nski.no/',
  '1407': 'https://oslonyehoyskole.no/', '1409': 'https://www.noroff.no/',
  '1412': 'https://limpimusic.com/', '6220': 'https://khio.no/',
  '8202': 'https://ldh.no/', '8208': 'https://www.vid.no/',
  '8221': 'https://mf.no/', '8223': 'https://www.nla.no/',
  '8224': 'https://dmmh.no/', '8225': 'https://www.steinerhoyskolen.no/',
  '8232': 'https://ansgarhoyskole.no/', '8234': 'https://fih.fjellhaug.no/',
  '8241': 'https://www.bi.no/', '8243': 'https://bas.org/',
  '8248': 'https://hlt.no/', '8253': 'https://www.kristiania.no/',
}
