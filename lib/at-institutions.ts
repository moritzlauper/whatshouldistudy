/**
 * Austrian higher education institutions: public universities (including the
 * six arts universities), universities of applied sciences (FH), universities
 * of teacher education (PH) and private universities. `aliases` are the names
 * under which the statistics list them, used to match their data.
 */

export type AtType = 'uni' | 'art' | 'fh' | 'ph' | 'priv'

export interface AtInstitution {
  id: string
  name: string
  type: AtType
  city: string
  state: string
  url: string
  languages: string[]
  aliases: string[]
}

const i = (id: string, name: string, type: AtType, city: string, state: string, url: string, languages: string[], aliases: string[] = []): AtInstitution => ({ id, name, type, city, state, url, languages, aliases })

export const AT_INSTITUTIONS: AtInstitution[] = [
  // Public universities
  i('univie', 'Universität Wien', 'uni', 'Wien', 'W', 'https://www.univie.ac.at', ['de', 'en'], ['Uni Wien']),
  i('unigraz', 'Universität Graz', 'uni', 'Graz', 'ST', 'https://www.uni-graz.at', ['de', 'en'], ['Karl-Franzens-Universität Graz', 'Uni Graz']),
  i('uibk', 'Universität Innsbruck', 'uni', 'Innsbruck', 'T', 'https://www.uibk.ac.at', ['de', 'en'], ['Leopold-Franzens-Universität Innsbruck', 'Uni Innsbruck']),
  i('meduniwien', 'Medizinische Universität Wien', 'uni', 'Wien', 'W', 'https://www.meduniwien.ac.at', ['de', 'en'], ['MedUni Wien']),
  i('medunigraz', 'Medizinische Universität Graz', 'uni', 'Graz', 'ST', 'https://www.medunigraz.at', ['de', 'en'], ['MedUni Graz']),
  i('meduniibk', 'Medizinische Universität Innsbruck', 'uni', 'Innsbruck', 'T', 'https://www.i-med.ac.at', ['de', 'en'], ['MedUni Innsbruck']),
  i('plus', 'Paris Lodron Universität Salzburg', 'uni', 'Salzburg', 'S', 'https://www.plus.ac.at', ['de', 'en'], ['Universität Salzburg', 'Uni Salzburg']),
  i('tuwien', 'Technische Universität Wien', 'uni', 'Wien', 'W', 'https://www.tuwien.at', ['de', 'en'], ['TU Wien']),
  i('tugraz', 'Technische Universität Graz', 'uni', 'Graz', 'ST', 'https://www.tugraz.at', ['de', 'en'], ['TU Graz']),
  i('unileoben', 'Montanuniversität Leoben', 'uni', 'Leoben', 'ST', 'https://www.unileoben.ac.at', ['de', 'en'], ['Montanuniversität']),
  i('boku', 'Universität für Bodenkultur Wien', 'uni', 'Wien', 'W', 'https://boku.ac.at', ['de', 'en'], ['BOKU', 'BOKU University']),
  i('vetmed', 'Veterinärmedizinische Universität Wien', 'uni', 'Wien', 'W', 'https://www.vetmeduni.ac.at', ['de', 'en'], ['Vetmeduni Vienna', 'Vetmeduni']),
  i('wu', 'Wirtschaftsuniversität Wien', 'uni', 'Wien', 'W', 'https://www.wu.ac.at', ['de', 'en'], ['WU Wien', 'WU']),
  i('jku', 'Johannes Kepler Universität Linz', 'uni', 'Linz', 'OÖ', 'https://www.jku.at', ['de', 'en'], ['Universität Linz', 'JKU']),
  i('aau', 'Universität Klagenfurt', 'uni', 'Klagenfurt', 'K', 'https://www.aau.at', ['de', 'en'], ['Alpen-Adria-Universität Klagenfurt']),
  i('uwk', 'Universität für Weiterbildung Krems', 'uni', 'Krems', 'NÖ', 'https://www.donau-uni.ac.at', ['de', 'en'], ['Donau-Universität Krems']),
  i('itu', 'IT:U Interdisciplinary Transformation University Austria', 'uni', 'Linz', 'OÖ', 'https://it-u.at', ['en'], ['IT:U', 'Interdisciplinary Transformation University']),
  // Public arts universities
  i('akbild', 'Akademie der bildenden Künste Wien', 'art', 'Wien', 'W', 'https://www.akbild.ac.at', ['de', 'en']),
  i('angewandte', 'Universität für angewandte Kunst Wien', 'art', 'Wien', 'W', 'https://www.dieangewandte.at', ['de', 'en'], ['Die Angewandte']),
  i('mdw', 'mdw – Universität für Musik und darstellende Kunst Wien', 'art', 'Wien', 'W', 'https://www.mdw.ac.at', ['de', 'en'], ['Universität für Musik und darstellende Kunst Wien']),
  i('mozarteum', 'Universität Mozarteum Salzburg', 'art', 'Salzburg', 'S', 'https://www.moz.ac.at', ['de', 'en'], ['Mozarteum']),
  i('kug', 'Kunstuniversität Graz', 'art', 'Graz', 'ST', 'https://www.kug.ac.at', ['de', 'en'], ['Universität für Musik und darstellende Kunst Graz']),
  i('kunstunilinz', 'Kunstuniversität Linz', 'art', 'Linz', 'OÖ', 'https://www.kunstuni-linz.at', ['de', 'en'], ['Universität für künstlerische und industrielle Gestaltung Linz']),
  // Universities of applied sciences
  i('technikum', 'FH Technikum Wien', 'fh', 'Wien', 'W', 'https://www.technikum-wien.at', ['de', 'en'], ['Fachhochschule Technikum Wien', 'UAS Technikum Wien']),
  i('campuswien', 'FH Campus Wien', 'fh', 'Wien', 'W', 'https://www.fh-campuswien.ac.at', ['de', 'en'], ['Fachhochschule Campus Wien', 'Hochschule Campus Wien', 'Hochschule für Angewandte Wissenschaften Campus Wien']),
  i('fhwien', 'FHWien der WKW', 'fh', 'Wien', 'W', 'https://www.fh-wien.ac.at', ['de', 'en'], ['FH Wien der WKW', 'Fachhochschule Wien der Wirtschaftskammer Wien', 'Betriebs- und Forschungseinrichtungen der Wiener Wirtschaft']),
  i('bfiwien', 'FH des BFI Wien', 'fh', 'Wien', 'W', 'https://www.fh-vie.ac.at', ['de', 'en'], ['Fachhochschule des BFI Wien', 'Hochschule für Wirtschaft & Gesellschaft des BFI Wien', 'des BFI Wien']),
  i('lauder', 'Lauder Business School', 'fh', 'Wien', 'W', 'https://www.lbs.ac.at', ['en']),
  i('fhstp', 'FH St. Pölten', 'fh', 'St. Pölten', 'NÖ', 'https://www.fhstp.ac.at', ['de', 'en'], ['Fachhochschule St. Pölten', 'Hochschule für Angewandte Wissenschaften St. Pölten']),
  i('fhwn', 'FH Wiener Neustadt', 'fh', 'Wiener Neustadt', 'NÖ', 'https://www.fhwn.ac.at', ['de', 'en'], ['Fachhochschule Wiener Neustadt']),
  i('imc', 'IMC Krems', 'fh', 'Krems', 'NÖ', 'https://www.imc.ac.at', ['de', 'en'], ['IMC Fachhochschule Krems', 'IMC University of Applied Sciences Krems']),
  i('milak', 'FH für angewandte Militärwissenschaften', 'fh', 'Wiener Neustadt', 'NÖ', 'https://www.milak.at', ['de'], ['Fachhochschule für angewandte Militärwissenschaften', 'Theresianische Militärakademie']),
  i('fernfh', 'Ferdinand Porsche FernFH', 'fh', 'Wiener Neustadt', 'NÖ', 'https://www.fernfh.ac.at', ['de'], ['Ferdinand Porsche FERNFH', 'Ferdinand Porsche Fernfachhochschule']),
  i('hsburgenland', 'Hochschule Burgenland', 'fh', 'Eisenstadt', 'B', 'https://www.hochschule-burgenland.at', ['de', 'en'], ['FH Burgenland', 'Fachhochschule Burgenland', 'Hochschule für Angewandte Wissenschaften Burgenland']),
  i('joanneum', 'FH JOANNEUM', 'fh', 'Graz', 'ST', 'https://www.fh-joanneum.at', ['de', 'en'], ['Fachhochschule Joanneum']),
  i('campus02', 'CAMPUS 02', 'fh', 'Graz', 'ST', 'https://www.campus02.at', ['de'], ['Campus 02 Fachhochschule der Wirtschaft']),
  i('fhkaernten', 'FH Kärnten', 'fh', 'Villach', 'K', 'https://www.fh-kaernten.at', ['de', 'en'], ['Fachhochschule Kärnten', 'CU Hochschule Kärnten', 'Carinthia University of Applied Sciences']),
  i('fhooe', 'FH Oberösterreich', 'fh', 'Linz', 'OÖ', 'https://www.fh-ooe.at', ['de', 'en'], ['Fachhochschule Oberösterreich', 'FH OÖ', 'FH OÖ Studienbetriebs GmbH']),
  i('fhgooe', 'FH Gesundheitsberufe OÖ', 'fh', 'Linz', 'OÖ', 'https://www.fh-gesundheitsberufe.at', ['de'], ['FH Gesundheitsberufe Oberösterreich']),
  i('fhsalzburg', 'FH Salzburg', 'fh', 'Puch bei Hallein', 'S', 'https://www.fh-salzburg.ac.at', ['de', 'en'], ['Fachhochschule Salzburg']),
  i('mci', 'MCI Management Center Innsbruck', 'fh', 'Innsbruck', 'T', 'https://www.mci.edu', ['de', 'en'], ['MCI', 'Management Center Innsbruck', 'MCI | Die Unternehmerische Hochschule']),
  i('fhkufstein', 'FH Kufstein Tirol', 'fh', 'Kufstein', 'T', 'https://www.fh-kufstein.ac.at', ['de', 'en'], ['Fachhochschule Kufstein', 'Hochschule Kufstein Tirol', 'HOK']),
  i('fhgtirol', 'fh gesundheit', 'fh', 'Innsbruck', 'T', 'https://www.fhg-tirol.ac.at', ['de'], ['FH Gesundheit Tirol', 'fhg – Zentrum für Gesundheitsberufe Tirol']),
  i('fhv', 'FH Vorarlberg', 'fh', 'Dornbirn', 'V', 'https://www.fhv.at', ['de', 'en'], ['Fachhochschule Vorarlberg']),
  // Universities of teacher education
  i('phwien', 'Pädagogische Hochschule Wien', 'ph', 'Wien', 'W', 'https://www.phwien.ac.at', ['de'], ['PH Wien']),
  i('kphwien', 'KPH Wien/Krems', 'ph', 'Wien', 'W', 'https://www.kphvie.ac.at', ['de'], ['Kirchliche Pädagogische Hochschule Wien/Krems']),
  i('phnoe', 'Pädagogische Hochschule Niederösterreich', 'ph', 'Baden', 'NÖ', 'https://www.ph-noe.ac.at', ['de'], ['PH Niederösterreich', 'PH NÖ']),
  i('phooe', 'Pädagogische Hochschule Oberösterreich', 'ph', 'Linz', 'OÖ', 'https://ph-ooe.at', ['de'], ['PH Oberösterreich', 'PH OÖ']),
  i('phdl', 'Private Pädagogische Hochschule der Diözese Linz', 'ph', 'Linz', 'OÖ', 'https://www.ph-linz.at', ['de'], ['PH der Diözese Linz', 'PHDL']),
  i('phst', 'Pädagogische Hochschule Steiermark', 'ph', 'Graz', 'ST', 'https://www.phst.at', ['de'], ['PH Steiermark']),
  i('augustinum', 'Private Pädagogische Hochschule Augustinum', 'ph', 'Graz', 'ST', 'https://www.pph-augustinum.at', ['de'], ['PPH Augustinum']),
  i('phkaernten', 'Pädagogische Hochschule Kärnten', 'ph', 'Klagenfurt', 'K', 'https://www.ph-kaernten.ac.at', ['de'], ['PH Kärnten']),
  i('phsalzburg', 'Pädagogische Hochschule Salzburg Stefan Zweig', 'ph', 'Salzburg', 'S', 'https://www.phsalzburg.at', ['de'], ['PH Salzburg', 'Pädagogische Hochschule Salzburg']),
  i('phtirol', 'Pädagogische Hochschule Tirol', 'ph', 'Innsbruck', 'T', 'https://ph-tirol.ac.at', ['de'], ['PH Tirol']),
  i('kphes', 'KPH Edith Stein', 'ph', 'Stams', 'T', 'https://www.kph-es.at', ['de'], ['Kirchliche Pädagogische Hochschule Edith Stein']),
  i('phvorarlberg', 'Pädagogische Hochschule Vorarlberg', 'ph', 'Feldkirch', 'V', 'https://www.ph-vorarlberg.ac.at', ['de'], ['PH Vorarlberg']),
  i('phburgenland', 'Pädagogische Hochschule Burgenland', 'ph', 'Eisenstadt', 'B', 'https://www.ph-burgenland.at', ['de'], ['PH Burgenland']),
  i('haup', 'Hochschule für Agrar- und Umweltpädagogik', 'ph', 'Wien', 'W', 'https://www.haup.ac.at', ['de'], ['HAUP']),
  // Private universities
  i('bruckner', 'Anton Bruckner Privatuniversität', 'priv', 'Linz', 'OÖ', 'https://www.bruckneruni.at', ['de', 'en']),
  i('suttner', 'Bertha von Suttner Privatuniversität', 'priv', 'St. Pölten', 'NÖ', 'https://www.suttneruni.at', ['de'], ['Bertha von Suttner Privatuniversität St. Pölten']),
  i('ceu', 'Central European University', 'priv', 'Wien', 'W', 'https://www.ceu.edu', ['en'], ['CEU', 'CEU PU - Central European University Private University']),
  i('fresenius', 'Charlotte Fresenius Privatuniversität', 'priv', 'Wien', 'W', 'https://www.charlotte-fresenius-uni.at', ['de']),
  i('dpu', 'Danube Private University', 'priv', 'Krems', 'NÖ', 'https://www.dp-uni.ac.at', ['de', 'en'], ['DPU']),
  i('gmpu', 'Gustav Mahler Privatuniversität für Musik', 'priv', 'Klagenfurt', 'K', 'https://www.gmpu.ac.at', ['de']),
  i('jam', 'JAM MUSIC LAB Private University', 'priv', 'Wien', 'W', 'https://www.jammusiclab.com', ['en', 'de']),
  i('kl', 'Karl Landsteiner Privatuniversität', 'priv', 'Krems', 'NÖ', 'https://www.kl.ac.at', ['de'], ['Karl Landsteiner Privatuniversität für Gesundheitswissenschaften']),
  i('kulinz', 'Katholische Privat-Universität Linz', 'priv', 'Linz', 'OÖ', 'https://www.ku-linz.at', ['de'], ['KU Linz']),
  i('modul', 'MODUL University Vienna', 'priv', 'Wien', 'W', 'https://www.modul.ac.at', ['en']),
  i('muk', 'MUK Privatuniversität der Stadt Wien', 'priv', 'Wien', 'W', 'https://www.muk.ac.at', ['de', 'en'], ['Musik und Kunst Privatuniversität der Stadt Wien']),
  i('ndu', 'New Design University', 'priv', 'St. Pölten', 'NÖ', 'https://www.ndu.ac.at', ['de', 'en'], ['NDU']),
  i('pmu', 'Paracelsus Medizinische Privatuniversität', 'priv', 'Salzburg', 'S', 'https://www.pmu.ac.at', ['de'], ['PMU']),
  i('sfu', 'Sigmund Freud Privatuniversität', 'priv', 'Wien', 'W', 'https://www.sfu.ac.at', ['de', 'en'], ['SFU']),
  i('umit', 'UMIT TIROL', 'priv', 'Hall in Tirol', 'T', 'https://www.umit-tirol.at', ['de'], ['Private Universität für Gesundheitswissenschaften, Medizinische Informatik und Technik']),
  i('webster', 'Webster Vienna Private University', 'priv', 'Wien', 'W', 'https://www.webster.ac.at', ['en'], ['Webster University Vienna']),
  i('haydn', 'Joseph Haydn Privathochschule', 'priv', 'Eisenstadt', 'B', 'https://www.haydnkons.at', ['de'], ['Joseph Haydn Konservatorium']),
  i('heiligenkreuz', 'Hochschule Heiligenkreuz', 'priv', 'Heiligenkreuz', 'NÖ', 'https://www.hochschule-heiligenkreuz.at', ['de'], ['Philosophisch-Theologische Hochschule Benedikt XVI. Heiligenkreuz']),
  i('stella', 'Stella Vorarlberg Privathochschule für Musik', 'priv', 'Feldkirch', 'V', 'https://www.stella-vorarlberg.at', ['de'], ['Stella Vorarlberg']),
  i('seeburg', 'Privatuniversität Schloss Seeburg', 'priv', 'Seekirchen am Wallersee', 'S', 'https://www.uni-seeburg.at', ['de'], ['Schloss Seeburg']),
]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const BY_ALIAS = new Map<string, AtInstitution>()
for (const x of AT_INSTITUTIONS) for (const a of [x.name, ...x.aliases]) BY_ALIAS.set(norm(a), x)

/** Finds an institution by any of its names (exact, then the longest contained alias). */
export function findAtInstitution(name: string): AtInstitution | undefined {
  const n = norm(name)
  const exact = BY_ALIAS.get(n)
  if (exact) return exact
  if (n.length <= 3) return undefined
  let best: [number, AtInstitution] | undefined
  for (const [alias, inst] of BY_ALIAS) if (alias.length > 5 && n.includes(alias) && (!best || alias.length > best[0])) best = [alias.length, inst]
  return best?.[1]
}

/**
 * Tuition per year in EUR, without the ÖH contribution (about EUR 25 per semester).
 * Public universities: free for EU/EEA students within the standard duration plus
 * two semesters, EUR 726.72 per semester for others. FH: up to EUR 363.36 per
 * semester, more for non-EU students at some. Private: their own prices.
 */
export function atTuition(type: AtType): { domestic?: number; eu?: number; international?: number; note: string } {
  switch (type) {
    case 'uni':
    case 'art':
      return { domestic: 0, eu: 0, international: 1453.44, note: 'Studienbeitrag nur für Drittstaaten oder nach Toleranzsemestern, dazu ÖH-Beitrag' }
    case 'ph':
      return { domestic: 0, eu: 0, international: 726.72, note: 'Studienbeitrag nur für Drittstaaten, dazu ÖH-Beitrag' }
    case 'fh':
      return { domestic: 726.72, eu: 726.72, note: 'Studienbeitrag bis 363,36 € pro Semester, für Drittstaaten je nach FH mehr' }
    case 'priv':
      return { note: 'Privatuniversität: Studiengebühren laut Hochschule' }
  }
}
