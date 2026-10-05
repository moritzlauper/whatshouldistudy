import { fieldsForTitle } from './common.ts'

/**
 * Subject words in German programme titles. The lexicon is built for video
 * titles and matches whole words; German programme names are compounds
 * («Sozialanthropologie», «Orchesterdirigieren», «Elementarpädagogik»), so the
 * German scrapers add these stems as candidate fields. Only programme titles
 * go through here, never a person's history.
 */

const S: Array<[RegExp, string[]]> = [
  // Mathematics, computing
  [/computational|mathemat|aktuar/, ['mathematics']],
  [/statistik|data science|datenwissenschaft|data analytics|datenanalyse|biometrie|aktuar/, ['statistics-data-science']],
  [/informatik|informatics|software|programmier|informationstechnolog|computer science|computational|informationswissenschaft|computing|webentwicklung|\bit-|\bit (?:management|security|systeme)/, ['computer-science']],
  [/künstliche intelligenz|\bki\b|machine learning|artificial intelligence|\bai\b/, ['artificial-intelligence']],
  [/it-sicherheit|informationssicherheit|cyber/, ['cybersecurity']],
  [/informationswissenschaft|wirtschaftsinformatik|informationsmanagement|informationssysteme|digitale transformation|digital business|e-business|business informatics|information systems|digitalisierung/, ['information-systems']],
  [/technische informatik|embedded|eingebettete|computer engineering|computertechnik/, ['computer-engineering']],
  // Natural sciences
  [/physik|physics|\bnano/, ['physics']],
  [/\bastro|astrophys|astronom/, ['astronomy']],
  [/chemi|chemistry/, ['chemistry']],
  [/naturwissenschaft/, ['physics', 'chemistry', 'biology']],
  [/biolog|biowissenschaft|life science|biotechnolog|bioinformatik|biodiversität/, ['biology']],
  [/molekular|biochem|genetik|genom|zellbiolog|mikrobiolog|biotechnolog|biomedizin/, ['molecular-biology']],
  [/neuro/, ['neuroscience']],
  [/kognitionswiss|cognitive science|kognitive/, ['cognitive-science']],
  [/limnolog|gewässer|umwelt|ökolog|nachhaltig|klima|sustainab|environment|naturschutz|ressourcen|biodiversität|wasserwirtschaft|kreislaufwirtschaft/, ['environmental-science']],
  [/geolog|geowissenschaft|geophysik|meteorolog|mineralog|erdwissenschaft|hydrolog|glaziolog|petrolog|rohstoff|bergbau|montan|markscheid|angewandte geo/, ['earth-sciences']],
  [/limnolog|meeresbiolog|meereswissenschaft|ozeanograph|marine/, ['marine-biology']],
  [/zoolog|tierwissenschaft|wildtier|verhaltensbiolog|nutztierwissenschaft/, ['zoology']],
  [/geograph|geoinformati|kartograph|geodäsie|vermessung|\bgis\b/, ['geography']],
  // Engineering
  [/maschinenbau|maschinenwesen|(?<!bio)mechanik|konstruktion|produktionstechnik|fertigungstechnik|feinwerktechnik|antriebstechnik/, ['mechanical-engineering']],
  [/elektro|elektronik|nachrichtentechnik|informationstechnik|kommunikationstechnik|automatisierung|regelungstechnik|halbleiter|photonik|optotechnik|lasertechnik/, ['electrical-engineering']],
  [/bauingenieur|bauwesen|bautechnik|baubetrieb|hochbau|tiefbau|wasserbau|holzbau|stahlbau|ingenieurbau|baumanagement|bauphysik|infrastruktur|siedlungswasser|verkehrswesen|verkehrsingenieur|konstruktiver/, ['civil-engineering']],
  [/raumfahrt|aerospace|luftfahrttechnik|flugzeugbau/, ['aerospace-engineering']],
  [/fahrzeug|automobil|automotive|motorsport/, ['automotive-engineering']],
  [/verfahrenstechnik|chemieingenieur|chemical engineering|prozesstechnik|chemietechnik/, ['chemical-engineering']],
  [/medizintechnik|biomedizinische technik|biomedical engineering|medizinische technik|medizinphysik/, ['biomedical-engineering']],
  [/\bnano|werkstoff|material|kunststoff|metallurg|polymer|nanotechn|holztechn/, ['materials-science']],
  [/mechatronik|robotik|robotics/, ['robotics-mechatronics']],
  [/energie|energy|erneuerbare|elektromobil|photovoltaik|solartechn|windenergie/, ['energy-engineering']],
  [/wirtschaftsingenieur|industrial engineering|produktionsmanagement|industrie 4|sicherheitstechnik|qualitätsmanagement|technisches management|prozessmanagement|fabrikplanung/, ['industrial-engineering']],
  // Built environment and design
  [/architektur|baukunst|architecture|interior design|raumgestaltung/, ['architecture']],
  [/stadtplanung|städtebau|raumplanung|raumordnung|raumforschung|regionalentwicklung|landschaftsarchitektur|landschaftsplanung|urbanistik|urban|immobilien/, ['urban-planning']],
  [/industriedesign|produktdesign|industrial design|product design|möbeldesign|transportation design/, ['industrial-design']],
  [/\bgame|games\b|spieleentwicklung|computerspiel|digitale spiele/, ['game-design']],
  [/interaktionsdesign|interaction design|user experience|\bux\b|usability|mensch-computer|mensch-maschine|human-computer/, ['ux-design']],
  [/grafik|graphic|kommunikationsdesign|visuelle kommunikation|informationsdesign|mediendesign|illustration|typogra|editorial design|^design$|\bdesign\b(?! thinking)/, ['graphic-design']],
  [/\bmode\b|modedesign|fashion|textil|bekleidung|schmuck/, ['fashion-design']],
  // Health
  [/(?<!zahn|tier|veterinär|phyto)medizin(?!technik|informatik|physik|recht)|humanmedizin|medical/, ['medicine']],
  [/(?<!landschafts|denkmal|kultur|natur|landes|rechts)pflege|hebamm|geburtshilf|nursing/, ['nursing']],
  [/pharma/, ['pharmacy']],
  [/zahnmedizin|zahnheilkunde|dental/, ['dentistry']],
  [/tiermedizin|veterinär/, ['veterinary-medicine']],
  [/physiotherap|ergotherap|logopäd|osteopath|rehabilitation|therapiewissenschaft|sprachtherap|orthoptik|podolog/, ['physiotherapy']],
  [/(?<!tran)sport|bewegungswiss|trainingswiss|kinesiolog/, ['sports-science']],
  [/ernährung|oecotroph|ökotroph|diätolog|lebensmittel|\bfood/, ['nutrition']],
  [/katastrophen|humanitär|rettungs|notfall|gesundheit|public health|epidemiolog|prävention/, ['public-health']],
  [/psycholog|psychotherap/, ['psychology']],
  // Economy and society
  [/volkswirt|\bvwl\b|ökonomi|economics|wirtschaftswissenschaft|wirtschaftspolitik/, ['economics']],
  [/betriebswirt|\bbwl\b|business|management|unternehmensführung|(?<!land|forst|holz|wasser|abfall|kreislauf|garten|vieh|volks|haus)wirtschaft|kaufm|industrie(?!design)|personalwesen|human resource/, ['business-management']],
  [/finanz|rechnungswesen|controlling|steuer(?!ung)|accounting|banking|\bbank|versicherung|wirtschaftsprüf|taxation|aktuar|investment|treuhand|audit/, ['finance-accounting']],
  [/marketing|vertrieb|\bsales|werbung|markenführung|handelsmanagement|e-commerce|retail/, ['marketing']],
  [/entrepreneur|gründung|innovationsmanagement|startup|start-up|unternehmertum/, ['entrepreneurship']],
  [/logistik|supply chain|verkehr|mobilität|transport|schifffahrt|nautik|spedition|beschaffung/, ['logistics']],
  [/tourismus|hotel|hospitality|freizeit|eventmanagement|gastgewerbe|destination/, ['hospitality-tourism']],
  [/politik|politolog|political|governance|internationale beziehungen|international relations|internationale studien|european studies|europastudien|verwaltungswiss|public administration|public management|öffentliche verwaltung|verwaltung|diplomat|friedens|konfliktforschung|staatswissenschaft/, ['political-science']],
  [/(?<!ge|auf)recht|\bjura\b|jurist|\blaw\b|\blaws\b|legal|\bll\.?b|\bll\.?m|notar|justiz|rechtspfleg/, ['law']],
  [/kriminolog|kriminalist|polizei|police|forensi|strafvollzug/, ['criminology']],
  [/soziolog|sozialwissenschaft|social science|gender|geschlechterforschung|gesellschaft|diversity|migration|demograph/, ['sociology']],
  [/anthropolog|ethnolog|volkskunde|kulturwissenschaft|cultural studies|kulturanalyse/, ['anthropology']],
  [/soziale arbeit|deaf studies|diakon|caritas|sozialarbeit|sozialpädagog|sozialmanagement|heilpädagog|kindheitspädagog|sozialwesen|social work|inklusion|frühpädagog/, ['social-work']],
  [/pädagog|erziehungswiss|bildungswiss|lehramt|\berziehung|(?<!aus|weiter|fort)bildungs|\bbildung\b|berufsausbildung|facheinschlägig|didaktik|lehrer|primarstufe|sekundarstufe|elementarbildung|education|erwachsenenbildung|berufsbildung|unterrichtsfach/, ['education']],
  [/journalis|reportage/, ['journalism']],
  [/kommunikationswiss|medienwiss|publizistik|medien|kommunikation(?!stechnik|snetze)|public relations|öffentlichkeitsarbeit|\bmedia\b/, ['media-communication']],
  // Humanities
  [/geschichte|histor|osteuropa|klassik|antike|mediävistik|mittelalter|byzantin/, ['history']],
  [/archäolog|archaeolog|frühgeschichte|ägyptolog|altorientalist|prähistor|altertumswiss/, ['archaeology']],
  [/philosoph|ethik/, ['philosophy']],
  [/diakon|gemeindepädagog|theolog|religion|judaist|jüdisch|islamisch|islamwiss|kirchenmusik|katholisch|evangelisch|bibel|buddhis|theology/, ['religious-studies']],
  [/gebärdensprache|deaf studies|linguist|sprachwiss|phonetik|übersetz|dolmetsch|translation(?!al)|translatorik|terminolog|deutsch als (?:fremd|zweit)sprache|\bdaf\b|\bdaz\b/, ['linguistics']],
  [/sprachen|sprache und|afrika|\basien|ostasien|südasien|asienwiss|orientalist|orientwiss|nahost|sinolog|sinophon|japanolog|koreanolog|indolog|arabist|turkolog|iranist|slaw|slav|romanist|anglist|amerikanist|germanist|skandinav|nordist|finnougr|hungarolog|gräzist|latinist|philolog|fremdsprache|\bdeutsch\b|französisch|koreanisch|arabisch|türkisch|griechisch|latein|hebräisch|persisch|ungarisch|kroatisch|serbisch|slowenisch|slowakisch|rumänisch|bulgarisch|ukrainisch|finnisch|schwedisch|norwegisch|dänisch|osteuropa|klassik|spanisch|italienisch|englisch|russisch|chinesisch|japanisch|polnisch|portugiesisch|niederländisch|tschechisch|deutsch-.*studien/, ['languages']],
  [/\bdeutsch\b|literatur|komparatist|kreatives schreiben|creative writing|germanist|anglist|romanist|slawist|slavist|editionswiss|buchwiss|philolog/, ['literature']],
  [/liberal arts|studium generale|geisteswissenschaft|humanities|kulturwissenschaften/, ['liberal-arts']],
  // Arts
  [/(?<!aufführungs|bau)kunst(?!stoff)|\bart\b|malerei|bildhauer|bildende|kunstgeschichte|kunstwissenschaft|restaurier|konservierung|fine art/, ['fine-arts']],
  [/kunstgeschichte|kunstwissenschaft/, ['history']],
  [/film|kamera|drehbuch|regie|bewegtbild|cinema|\bkino/, ['film-production']],
  [/animation|vfx|visual effects|motion design|trickfilm/, ['animation-vfx']],
  [/musik|music|dirig|instrumental|orgel|klavier|cembalo|gesang|komposition|violin|violoncello|viola|kontrabass|gitarre|harfe|flöte|oboe|klarinette|fagott|\bhorn\b|trompete|posaune|tuba|schlagwerk|schlagzeug|saxophon|akkordeon|\bchor(?!eo)|jazz|tonsatz|\binstrument\b|kammermusik|liedgestaltung|\boper\b|blasorchester|ensembleleitung/, ['music']],
  [/tonmeister|tontechnik|audio(?!log)|\bsound|musikproduktion|musikinformatik|recording|elektroakustik/, ['music-production']],
  [/schauspiel|theater|darstellende|\btanz|choreogra|bühne|musical|regie|puppenspiel|zirkus|performance art|performance studies|performativ|dramaturg/, ['performing-arts']],
  // Applied
  [/kulinar|culinary|kochkunst|gastronomie/, ['culinary-arts']],
  [/agrar|landwirtschaft|forst|gartenbau|weinbau|önolog|oenolog|pflanzenbau|pflanzenwissenschaft|nutztier|agronom|holzwirtschaft|bodenkultur|landschaftsbau|phytomedizin/, ['agriculture']],
  [/luftfahrt(?!technik)|\bpilot|aviation|flugverkehr/, ['aviation']],
]

/** Candidate fields for a German programme title. */
export function germanTitleFields(title: string): string[] {
  const t = title.toLowerCase()
  const out = new Set<string>()
  for (const [re, fields] of S) if (re.test(t)) for (const f of fields) out.add(f)
  return [...out]
}

/**
 * Fields for a German programme title. Teacher education keeps its school
 * subjects next to education: «Lehramt Spanisch» is education and languages.
 */
export function germanFields(title: string): { fields: string[]; confidence: number } {
  const candidates = germanTitleFields(title)
  const r = fieldsForTitle(title, candidates)
  if (!/lehramt|unterrichtsfach/i.test(title)) return r
  const subjects = [...r.fields, ...candidates].filter((f) => f !== 'education')
  return { fields: ['education', ...new Set(subjects)].slice(0, 3), confidence: Math.max(r.confidence, 0.7) }
}
