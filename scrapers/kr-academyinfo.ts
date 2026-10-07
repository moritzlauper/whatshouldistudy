/**
 * South Korea: every department and major at universities, colleges and
 * graduate schools, from Korea Higher Education Information (대학알리미,
 * academyinfo.go.kr, run by the Korean Council for University Education for
 * the Ministry of Education). Two files from its download board:
 *
 * - «학부/과(전공) 리스트»: one row per department with degree, duration,
 *   location, status and the official subject classification (KEDI 계열);
 * - «학교 개황 정보»: every institution with its English name, founding type
 *   (national, public, private), website and English address.
 *
 * Both are updated a few times a year; we look up the newest post of each.
 * The server is slow (often under 50 kB/s), so a download may take minutes.
 * Tuition is not in these files: we show the published averages for national
 * and private institutions, marked as estimates. International students pay
 * the same as Korean students.
 */
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import { programmeId } from '../lib/programmes.ts'
import type { Level, Programme } from '../lib/programmes.ts'
import { OUT, fetchRetry, isMain, log, writeJson } from './lib/common.ts'
import type { ScrapeOutput } from './lib/common.ts'

const SITE = 'https://www.academyinfo.go.kr'

/** The official subcategory (소계열) with its English name and our fields. */
export const KR_SUBFIELDS: Record<string, [string, string[]]> = {
  교양자연과학: ['General natural sciences', ['liberal-arts']],
  비서: ['Secretarial studies', ['business-management']],
  의과학: ['Medical science', ['medicine', 'molecular-biology']],
  간호학: ['Nursing', ['nursing']],
  건축공학: ['Architectural engineering', ['civil-engineering', 'architecture']],
  건축학: ['Architecture', ['architecture']],
  도시공학: ['Urban engineering', ['urban-planning', 'civil-engineering']],
  조경학: ['Landscape architecture', ['architecture', 'urban-planning']],
  토목공학: ['Civil engineering', ['civil-engineering']],
  환경공학: ['Environmental engineering', ['environmental-science', 'civil-engineering']],
  경영정보학: ['Management information systems', ['information-systems']],
  경영학: ['Business administration', ['business-management']],
  경제학: ['Economics', ['economics']],
  관광학: ['Tourism and hospitality', ['hospitality-tourism']],
  '광고・홍보학': ['Advertising and PR', ['marketing', 'media-communication']],
  '금융・보험학': ['Finance and insurance', ['finance-accounting']],
  '무역・유통학': ['Trade and distribution', ['logistics', 'business-management']],
  부동산: ['Real estate', ['business-management', 'finance-accounting']],
  '회계・세무학': ['Accounting and taxation', ['finance-accounting']],
  '금융・회계・세무학': ['Finance, accounting and taxation', ['finance-accounting']],
  '간호・보건 교육': ['Health education', ['education', 'nursing']],
  공학교육: ['Engineering education', ['education']],
  교양공학: ['General engineering', ['liberal-arts']],
  교육학: ['Education', ['education']],
  사회과교육: ['Social studies education', ['education']],
  언어교육: ['Language education', ['education', 'languages']],
  '예술・체육교육': ['Arts and physical education', ['education', 'sports-science']],
  유아교육: ['Early childhood education', ['education']],
  자연과학교육: ['Science and mathematics education', ['education']],
  초등교육: ['Primary education', ['education']],
  특수교육: ['Special education', ['education']],
  교통시스템공학: ['Transport systems engineering', ['civil-engineering', 'logistics']],
  '무인항공기(운항)학': ['Drone operation', ['aviation', 'aerospace-engineering']],
  선박운항학: ['Ship navigation', ['logistics']],
  철도운전제어학: ['Railway operation', ['logistics']],
  항공운항학: ['Flight operations', ['aviation']],
  기계공학: ['Mechanical engineering', ['mechanical-engineering']],
  메카트로닉스공학: ['Mechatronics', ['robotics-mechatronics']],
  자동차공학: ['Automotive engineering', ['automotive-engineering']],
  '조선・해양공학': ['Naval and ocean engineering', ['mechanical-engineering']],
  철도공학: ['Railway engineering', ['mechanical-engineering', 'civil-engineering']],
  '항공・우주공학': ['Aerospace engineering', ['aerospace-engineering']],
  농림수산바이오시스템공학: ['Biosystems engineering', ['agriculture']],
  농림수산환경생태학: ['Agricultural and environmental ecology', ['agriculture', 'environmental-science']],
  산림학: ['Forestry', ['agriculture', 'environmental-science']],
  수산학: ['Fisheries science', ['agriculture', 'marine-biology']],
  식품공학: ['Food science and engineering', ['nutrition', 'chemical-engineering']],
  '작물・원예학': ['Crop science and horticulture', ['agriculture']],
  축산학: ['Animal science', ['agriculture', 'zoology']],
  무용: ['Dance', ['performing-arts']],
  체육: ['Sport and physical education', ['sports-science']],
  공예: ['Crafts', ['fine-arts']],
  디자인: ['Design', ['graphic-design', 'industrial-design']],
  미술학: ['Fine arts', ['fine-arts']],
  산업디자인: ['Industrial design', ['industrial-design']],
  생활디자인: ['Interior and lifestyle design', ['industrial-design']],
  순수미술: ['Fine arts', ['fine-arts']],
  시각디자인: ['Visual communication design', ['graphic-design']],
  응용미술: ['Applied arts', ['graphic-design', 'fine-arts']],
  법학: ['Law', ['law']],
  동물보건: ['Veterinary nursing', ['veterinary-medicine']],
  보건관리: ['Health administration', ['public-health']],
  보건학: ['Public health', ['public-health']],
  임상보건: ['Clinical health sciences', ['public-health']],
  재활치료: ['Rehabilitation therapy', ['physiotherapy']],
  국제학: ['International studies', ['political-science']],
  '군사・국방・안보': ['Military and security studies', ['political-science']],
  '도시・지역・지리학': ['Geography and regional studies', ['geography', 'urban-planning']],
  문헌정보학: ['Library and information science', ['information-systems']],
  사회복지학: ['Social welfare', ['social-work']],
  사회학: ['Sociology', ['sociology']],
  '소비자・가정자원': ['Consumer studies', ['economics']],
  심리학: ['Psychology', ['psychology']],
  '아동・가족학': ['Child and family studies', ['social-work', 'education']],
  '언론・방송・매체학': ['Media and communication', ['media-communication', 'journalism']],
  인류학: ['Anthropology', ['anthropology']],
  정치외교학: ['Political science and diplomacy', ['political-science']],
  행정학: ['Public administration', ['political-science']],
  교양사회과학: ['General social sciences', ['liberal-arts']],
  방재공학: ['Disaster prevention engineering', ['civil-engineering']],
  산업공학: ['Industrial engineering', ['industrial-engineering']],
  안전공학: ['Safety engineering', ['industrial-engineering']],
  식품영양학: ['Food and nutrition', ['nutrition']],
  '의류・의상학': ['Clothing and textiles', ['fashion-design']],
  조리과학: ['Culinary science', ['culinary-arts']],
  주거학: ['Housing studies', ['architecture']],
  물리학: ['Physics', ['physics']],
  수학: ['Mathematics', ['mathematics']],
  '지구・지질학': ['Earth sciences and geology', ['earth-sciences']],
  '천문・대기과학': ['Astronomy and atmospheric science', ['astronomy', 'earth-sciences']],
  통계학: ['Statistics', ['statistics-data-science']],
  해양학: ['Oceanography', ['earth-sciences', 'marine-biology']],
  약학: ['Pharmacy', ['pharmacy']],
  한약학: ['Korean herbal pharmacy', ['pharmacy']],
  '교양어・문학': ['Languages and literature', ['languages', 'literature']],
  '국어・국문학': ['Korean language and literature', ['literature', 'linguistics']],
  '기타아시아어・문학': ['Asian languages and literature', ['languages']],
  '기타유럽어・문학': ['European languages and literature', ['languages']],
  '독일어・문학': ['German language and literature', ['languages', 'literature']],
  '러시아어・문학': ['Russian language and literature', ['languages', 'literature']],
  문예창작학: ['Creative writing', ['literature']],
  '스페인어・문학': ['Spanish language and literature', ['languages', 'literature']],
  언어학: ['Linguistics', ['linguistics']],
  '영어・영문학': ['English language and literature', ['languages', 'literature']],
  '일본어・문학': ['Japanese language and literature', ['languages']],
  '중국어・문학': ['Chinese language and literature', ['languages']],
  '프랑스어・문학': ['French language and literature', ['languages', 'literature']],
  방송연예: ['Broadcasting and entertainment', ['performing-arts', 'media-communication']],
  연극: ['Theatre', ['performing-arts']],
  영화: ['Film', ['film-production']],
  국악: ['Korean traditional music', ['music']],
  기악: ['Instrumental music', ['music']],
  성악: ['Voice', ['music']],
  실용음악: ['Popular music', ['music-production', 'music']],
  음악학: ['Music', ['music']],
  작곡: ['Composition', ['music']],
  게임: ['Game design', ['game-design']],
  만화: ['Comics and webtoon', ['animation-vfx', 'graphic-design']],
  사진: ['Photography', ['fine-arts']],
  애니메이션: ['Animation', ['animation-vfx']],
  영상예술: ['Film and video arts', ['film-production']],
  음향: ['Sound engineering', ['music-production']],
  수의학: ['Veterinary medicine', ['veterinary-medicine']],
  의학: ['Medicine', ['medicine']],
  치의학: ['Dentistry', ['dentistry']],
  한의학: ['Korean medicine', ['medicine']],
  수의예과: ['Pre-veterinary medicine', ['veterinary-medicine']],
  의예과: ['Pre-medicine', ['medicine']],
  치의예과: ['Pre-dentistry', ['dentistry']],
  한의예과: ['Pre-Korean medicine', ['medicine']],
  교양인문학: ['General humanities', ['liberal-arts']],
  국제지역학: ['Area studies', ['political-science', 'languages']],
  '문화・민속・미술사학': ['Cultural studies and art history', ['history', 'anthropology']],
  '역사・고고학': ['History and archaeology', ['history', 'archaeology']],
  종교학: ['Religious studies and theology', ['religious-studies']],
  '철학・윤리학': ['Philosophy and ethics', ['philosophy']],
  금속공학: ['Metallurgical engineering', ['materials-science']],
  반도체공학: ['Semiconductor engineering', ['electrical-engineering', 'materials-science']],
  세라믹공학: ['Ceramic engineering', ['materials-science']],
  신소재공학: ['Advanced materials engineering', ['materials-science']],
  재료공학: ['Materials engineering', ['materials-science']],
  광학공학: ['Optical engineering', ['physics', 'electrical-engineering']],
  응용소프트웨어공학: ['Software engineering', ['computer-science']],
  의공학: ['Biomedical engineering', ['biomedical-engineering']],
  인공지능공학: ['Artificial intelligence', ['artificial-intelligence', 'computer-science']],
  전기공학: ['Electrical engineering', ['electrical-engineering']],
  '전산학・컴퓨터공학': ['Computer science and engineering', ['computer-science', 'computer-engineering']],
  전자공학: ['Electronic engineering', ['electrical-engineering']],
  '정보・통신공학': ['Information and communication engineering', ['computer-engineering', 'electrical-engineering']],
  제어계측공학: ['Control and instrumentation engineering', ['electrical-engineering', 'robotics-mechatronics']],
  고분자공학: ['Polymer engineering', ['materials-science', 'chemical-engineering']],
  생명공학: ['Biotechnology', ['molecular-biology', 'chemical-engineering']],
  섬유공학: ['Textile engineering', ['materials-science']],
  에너지공학: ['Energy engineering', ['energy-engineering']],
  화학공학: ['Chemical engineering', ['chemical-engineering']],
  바이오테크놀로지학: ['Biotechnology', ['molecular-biology']],
  생명과학: ['Life sciences', ['biology']],
  화학: ['Chemistry', ['chemistry']],
  환경학: ['Environmental science', ['environmental-science']],
}

/** Where the subcategory is unclassified (N.C.E.), the middle category (중계열). */
const KR_MIDDLE: Record<string, [string, string[]]> = {
  건설: ['Construction', ['civil-engineering']],
  '경영・경제': ['Business and economics', ['business-management']],
  교육: ['Education', ['education']],
  기계: ['Mechanical engineering', ['mechanical-engineering']],
  '농림・수산': ['Agriculture and fisheries', ['agriculture']],
  '무용・체육': ['Dance and sport', ['sports-science']],
  미술: ['Art and design', ['fine-arts']],
  법학: ['Law', ['law']],
  보건: ['Health', ['public-health']],
  '산업・안전': ['Industrial and safety engineering', ['industrial-engineering']],
  약학: ['Pharmacy', ['pharmacy']],
  '언어・문학': ['Languages and literature', ['languages']],
  '연극・영화': ['Theatre and film', ['performing-arts']],
  음악: ['Music', ['music']],
  의료: ['Medicine', ['medicine']],
  재료: ['Materials engineering', ['materials-science']],
  '화공・고분자・에너지': ['Chemical and energy engineering', ['chemical-engineering']],
}

/** Words in the department's name that name a field more precisely than its category. */
const SHARPEN: Array<[RegExp, string]> = [
  [/인공지능|AI|에이아이|머신러닝/, 'artificial-intelligence'],
  [/데이터|통계/, 'statistics-data-science'],
  [/정보보호|정보보안|사이버보안|보안공학|해킹/, 'cybersecurity'],
  [/게임/, 'game-design'],
  [/로봇|로보틱스/, 'robotics-mechatronics'],
  [/소프트웨어|컴퓨터/, 'computer-science'],
  [/반도체/, 'electrical-engineering'],
  [/애니메이션|웹툰/, 'animation-vfx'],
  [/자유전공|자율|무전공|자유학부/, 'liberal-arts'],
  [/경찰|범죄|교정학/, 'criminology'],
  [/창업/, 'entrepreneurship'],
  [/물류/, 'logistics'],
]

/** Only where neither category says anything. */
const FALLBACK: Array<[RegExp, string]> = [
  [/경영/, 'business-management'],
  [/경제/, 'economics'],
  [/간호/, 'nursing'],
  [/심리/, 'psychology'],
  [/패션/, 'fashion-design'],
  [/디자인/, 'graphic-design'],
  [/미디어|방송|언론/, 'media-communication'],
  [/보건|헬스|의료/, 'public-health'],
  [/바이오/, 'molecular-biology'],
  [/환경/, 'environmental-science'],
  [/건축/, 'architecture'],
  [/스포츠|체육/, 'sports-science'],
  [/음악/, 'music'],
  [/법학|법과/, 'law'],
  [/전자/, 'electrical-engineering'],
  [/화학/, 'chemistry'],
  [/지구|지질|천문|해양학/, 'earth-sciences'],
  [/수학|수리/, 'mathematics'],
  [/식품/, 'nutrition'],
  [/군사|밀리터리|국방/, 'political-science'],
  [/교양|인문/, 'liberal-arts'],
]

export function krFields(name: string, middle: string, sub: string): { fields: string[]; confidence: number; focus?: string } {
  sub = sub.trim()
  const official = KR_SUBFIELDS[sub] ?? (sub.startsWith('N.C.E') ? KR_MIDDLE[middle.trim()] : undefined)
  const base = official?.[1] ?? []
  const sharp = [...new Set(SHARPEN.filter(([re]) => re.test(name)).map(([, f]) => f))]
  let fields = [...new Set([...sharp.filter((f) => !base.includes(f)), ...base])].slice(0, 3)
  let confidence = !official ? 0.6 : KR_SUBFIELDS[sub] ? (sharp.length && !base.includes(sharp[0]) ? 0.9 : 1) : 0.7
  if (!fields.length) {
    fields = [...new Set(FALLBACK.filter(([re]) => re.test(name)).map(([, f]) => f))].slice(0, 2)
    confidence = 0.6
  }
  return { fields, confidence, focus: official?.[0] }
}

/** The degree (학위과정) as our level; combined master's and doctoral programmes count as master's. */
export function krLevel(degree: string, years: number, sub: string): Level | null {
  if (/학석사통합/.test(degree)) return 'integrated'
  if (degree === '전문학사') return 'short'
  if (degree === '학사') return years >= 5.5 && /의학|치의학|한의학|수의학|약학/.test(sub) ? 'professional' : 'bachelor'
  if (/전문기술석사/.test(degree)) return null
  if (/석사/.test(degree)) return 'master'
  if (/박사/.test(degree)) return 'doctorate'
  return null
}

/** Published averages per year in KRW, by founding type and level (대학알리미, 2025). */
export function krTuition(isPublic: boolean, level: Level): number {
  if (level === 'short') return isPublic ? 3_000_000 : 6_200_000
  if (level === 'master' || level === 'doctorate') return isPublic ? 5_300_000 : 10_000_000
  if (level === 'professional') return isPublic ? 5_000_000 : 10_500_000
  return isPublic ? 4_200_000 : 7_600_000
}

const REGIONS: Record<string, string> = {
  서울: 'Seoul', 부산: 'Busan', 대구: 'Daegu', 인천: 'Incheon', 광주: 'Gwangju', 대전: 'Daejeon', 울산: 'Ulsan', 세종: 'Sejong', 경기: 'Gyeonggi',
  강원: 'Gangwon', 충북: 'North Chungcheong', 충남: 'South Chungcheong', 전북: 'North Jeolla', 전남: 'South Jeolla', 전남광주: 'South Jeolla',
  경북: 'North Gyeongsang', 경남: 'South Gyeongsang', 제주: 'Jeju',
}
const METROS = ['Seoul', 'Busan', 'Daegu', 'Incheon', 'Gwangju', 'Daejeon', 'Ulsan', 'Sejong']

/** The city from an English address: «…, Chuncheon-si, Gangwon-do» or «…, Buk-gu, Daegu, Republic of Korea». */
export function krCity(address: string): string | undefined {
  const si = address.match(/\b([A-Z][a-z]+(?:-[a-z]+)?)-si\b/)
  if (si && !METROS.includes(si[1])) return si[1]
  const metro = METROS.find((m) => new RegExp(`\\b${m}\\b`).test(address))
  if (metro) return metro
  return address.match(/\b([A-Z][a-z]+)-gun\b/)?.[1]
}

export interface KrSchool {
  name: string
  campus: string
  founding: string
  status: string
  english: string
  englishAddress: string
  homepage: string
}

/** Rows of a sheet as objects, keyed by the header row (found by one of its columns). */
export function sheetObjects(rows: string[][], column: string): Array<Record<string, string>> {
  const hi = rows.findIndex((r) => r.map((c) => String(c).trim()).includes(column))
  if (hi < 0) throw new Error(`No header row with «${column}»`)
  const head = rows[hi].map((c) => String(c).replace(/\s+/g, '').trim())
  return rows.slice(hi + 1).map((r) => Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? '').trim()])))
}

export function parseSchools(rows: string[][]): KrSchool[] {
  return sheetObjects(rows, '학교명').map((r) => ({
    name: r['학교명'],
    campus: r['본분교'],
    founding: r['설립구분'],
    status: r['학교상태'],
    english: r['학교명(영문)'],
    englishAddress: r['영문주소'],
    homepage: r['학교홈페이지'],
  }))
}

/** «University Of Seoul» and «GANGSEO UNIVERSITY» as «University of Seoul» and «Gangseo University». */
export function tidyEnglish(name: string): string {
  let s = name.replace(/\s+/g, ' ').trim()
  if (s.includes(' ') && s === s.toUpperCase()) s = s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
  return s.replace(/(?<=\S )(Of|And|For|The|In|At)(?= )/g, (w) => w.toLowerCase())
}

/** An English name as a lookup key, without «The», campus or brackets. */
export function siteKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+\S+\s+campus\b/g, ' ')
    .replace(/\b(the|campus)\b/g, ' ')
    .replace(/[^a-z]/g, '')
}

const homepageUrl = (h: string) => (h ? (/^https?:\/\//.test(h) ? h : `https://${h.replace(/^\/+/, '')}`) : undefined)

/** «서울대학교 대학원» and «가야대학교 일반대학원(김해)» belong to «서울대학교» and «가야대학교(김해)». */
export function parentName(name: string): string {
  const m = name.match(/^(\S+?)\s+\S*대학원(\([^)]*\))?$/)
  return m ? m[1] + (m[2] ?? '') : name
}

const KEEP_TRACKS = new Set(['일반과정', '일반과정(전문학사)', '학석사통합과정'])
const SKIP_SCHOOLS = new Set(['특수대학원', '각종학교(대학)'])

export function parseDepartments(listRows: string[][], schools: KrSchool[], fetchedAt: string, sites = new Map<string, string>()): { programmes: Programme[]; unclassified: string[]; unmatched: string[] } {
  const byKey = new Map(schools.map((s) => [`${s.name}|${s.campus}`, s]))
  const byName = new Map<string, KrSchool>()
  for (const s of schools) if (!byName.has(s.name) || s.campus === '본교') byName.set(s.name, s)
  // Branch campuses often leave the website empty; the main campus has it.
  const homeByEnglish = new Map<string, string>()
  for (const s of schools) if (s.homepage && s.english && !homeByEnglish.has(s.english)) homeByEnglish.set(s.english, s.homepage)

  const programmes: Programme[] = []
  const unclassified: string[] = []
  const unmatched = new Set<string>()
  const seen = new Set<string>()
  for (const r of sheetObjects(listRows, '학교명')) {
    const status = r['학과상태명'] ?? ''
    if (!status || status.includes('폐지')) continue
    if (!KEEP_TRACKS.has(r['학과특성명']) || SKIP_SCHOOLS.has(r['학교구분']) || r['주야간구분명'] === '계절제') continue
    const name = r['학부·과(전공)명']
    // Admission units («기타모집단위», «인문계열», «반도체대학») have their departments listed as well.
    if (!name || /모집단위|계열$|대학$/.test(name)) continue
    const years = parseFloat(r['수업연한명']) || undefined
    const level = krLevel(r['학위과정명'], years ?? 0, r['소계열분류'])
    if (!level || (level === 'bachelor' && (years ?? 4) < 2)) continue
    const { fields, confidence, focus } = krFields(name, r['중계열분류'], r['소계열분류'])
    if (!fields.length) {
      unclassified.push(name)
      continue
    }
    const id = programmeId(['kr', r['학교코드'], r['학교별학과코드']])
    if (seen.has(id)) continue
    seen.add(id)

    const own = byKey.get(`${r['학교명']}|${r['본분교']}`) ?? byName.get(r['학교명'])
    const parent = byName.get(parentName(r['학교명']))
    const school = own ?? parent
    if (!school) unmatched.add(r['학교명'])
    // A graduate school goes by its university's name.
    const rawEnglish = (r['대학구분'] === '대학원' ? parent?.english : undefined) ?? school?.english
    const english = rawEnglish ? tidyEnglish(rawEnglish) : undefined
    const founding = school?.founding ?? ''
    const isPublic = /국립|공립|특별법/.test(founding)
    const kind = r['학교구분']
    const distance = /사이버|방송통신/.test(kind) || r['주야간구분명'] === '원격'
    programmes.push({
      id,
      name,
      institution: english || r['학교명'],
      country: 'KR',
      city: (school && krCity(school.englishAddress)) || undefined,
      region: REGIONS[r['학교(지역)']],
      level,
      fields,
      fieldConfidence: confidence,
      languages: ['ko'],
      tuition: { currency: 'KRW', domestic: krTuition(isPublic, level), international: krTuition(isPublic, level), estimated: true },
      durationYears: years,
      mode: distance ? 'distance' : r['주야간구분명'] === '야간' ? 'part-time' : 'full-time',
      institutionUrl: homepageUrl(school?.homepage || (rawEnglish ? (homeByEnglish.get(rawEnglish) ?? sites.get(siteKey(rawEnglish)) ?? '') : '')),
      public: founding ? isPublic : undefined,
      institutionType: kind === '교육대학' ? 'ph' : /전문대학|기능대학|사이버대학\(전문\)/.test(kind) ? undefined : isPublic ? 'uni' : 'priv',
      focus: focus ? [focus] : undefined,
      source: 'kr-academyinfo',
      updated: fetchedAt,
    })
  }
  for (const p of programmes) if (p.city && p.region === p.city) p.region = undefined
  return { programmes, unclassified, unmatched: [...unmatched] }
}

/**
 * The files rarely name a website, so we look the universities up by English
 * name in the Hipo directory and OpenAlex. Missing ones only cost the link to
 * the institution: the programme link then searches the web.
 */
async function websites(): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    const hipo = (await (await fetchRetry('https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json')).json()) as Array<{ name: string; alpha_two_code: string; web_pages?: string[] }>
    for (const u of hipo) if (u.alpha_two_code === 'KR' && u.web_pages?.[0]) out.set(siteKey(u.name), u.web_pages[0])
  } catch (e) {
    log(`KR: Hipo directory unavailable (${(e as Error).message})`)
  }
  try {
    const key = process.env.OPENALEX_API_KEY
    const mail = process.env.OPENALEX_EMAIL
    const auth = `${key ? `&api_key=${key}` : ''}${mail ? `&mailto=${encodeURIComponent(mail)}` : ''}`
    let cursor: string | null = '*'
    for (let i = 0; cursor && i < 20; i++) {
      const j = (await (await fetchRetry(`https://api.openalex.org/institutions?filter=country_code:KR,type:education&per-page=200&cursor=${cursor}&select=display_name,homepage_url${auth}`)).json()) as {
        results: Array<{ display_name: string; homepage_url?: string }>
        meta: { next_cursor: string | null }
      }
      for (const r of j.results) if (r.homepage_url && !out.has(siteKey(r.display_name))) out.set(siteKey(r.display_name), r.homepage_url)
      cursor = j.meta.next_cursor
    }
  } catch (e) {
    log(`KR: OpenAlex unavailable (${(e as Error).message})`)
  }
  return out
}

interface BoardPost {
  ntce_sntc_sno: number
  ntce_sntc_tt_nm: string
  frst_regt_dtm: string
}

/** The newest post on the download board whose title matches. */
async function newestPost(title: RegExp): Promise<BoardPost> {
  for (let page = 1; page <= 5; page++) {
    const res = await fetchRetry(`${SITE}/brd/brd0480/selectList.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
      body: new URLSearchParams({ bbs_gubun: 'rfbr', pageindex: String(page) }),
    })
    const { resultList } = (await res.json()) as { resultList: BoardPost[] }
    const hit = resultList.filter((p) => title.test(p.ntce_sntc_tt_nm)).sort((a, b) => b.ntce_sntc_sno - a.ntce_sntc_sno)[0]
    if (hit) return hit
  }
  throw new Error(`No post matching ${title} on the academyinfo board`)
}

/** The post's attachment; the whole body, retried, because the server drops slow downloads. */
async function attachment(post: BoardPost): Promise<Uint8Array> {
  const html = await (await fetchRetry(`${SITE}/brd/brd0520/selectDetail.do?ntce_sntc_sno=${post.ntce_sntc_sno}&bbs_gubun=rfbr`)).text()
  const no = html.match(/fn_file_down\('(\d+)'\)/)?.[1]
  if (!no) throw new Error(`No attachment in post ${post.ntce_sntc_sno}`)
  let last: unknown
  for (let i = 0; i < 4; i++) {
    try {
      const started = Date.now()
      const res = await fetchRetry(`${SITE}/file/FileDown.do`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ atch_file_no: no }),
        signal: AbortSignal.timeout(25 * 60_000),
      })
      const data = new Uint8Array(await res.arrayBuffer())
      // Fails on a truncated file.
      XLSX.read(data, { type: 'array', sheetRows: 5 })
      log(`KR: «${post.ntce_sntc_tt_nm}» ${Math.round(data.length / 1024)} kB in ${Math.round((Date.now() - started) / 1000)} s`)
      return data
    } catch (e) {
      last = e
      log(`KR: download of «${post.ntce_sntc_tt_nm}» failed (${(e as Error).message}), attempt ${i + 1}`)
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

const sheetRows = (data: Uint8Array): string[][] => {
  const wb = XLSX.read(data, { type: 'array', dense: true })
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false })
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const listPost = await newestPost(/학부\/과\(전공\)\s*리스트/)
  const schoolPost = await newestPost(/학교\s*개황\s*정보/)
  log(`KR: «${listPost.ntce_sntc_tt_nm}» (${listPost.frst_regt_dtm}), «${schoolPost.ntce_sntc_tt_nm}» (${schoolPost.frst_regt_dtm})`)
  const [listData, schoolData, sites] = await Promise.all([attachment(listPost), attachment(schoolPost), websites()])
  const listRows = sheetRows(listData)
  const schoolRows = sheetRows(schoolData)
  const schools = parseSchools(schoolRows)
  const { programmes, unclassified, unmatched } = parseDepartments(listRows, schools, fetchedAt, sites)

  const byLevel = new Map<string, number>()
  for (const p of programmes) byLevel.set(p.level, (byLevel.get(p.level) ?? 0) + 1)
  log(`KR: ${listRows.length} rows, ${schools.length} institutions, ${programmes.length} programmes ${JSON.stringify([...byLevel])}`)
  log(`KR: websites for ${new Set(programmes.filter((p) => p.institutionUrl).map((p) => p.institution)).size} of ${new Set(programmes.map((p) => p.institution)).size} institutions`)
  log(`KR institutions not found in the overview (${unmatched.length}): ${unmatched.slice(0, 40).join(' || ')}`)
  log(`KR unclassified (${unclassified.length}): ${unclassified.slice(0, 300).join(' || ')}`)
  if (programmes.length < 5000) throw new Error(`Only ${programmes.length} Korean programmes`)
  const out: ScrapeOutput = { source: 'kr-academyinfo', fetchedAt, programmes }
  writeJson(join(OUT, 'kr-academyinfo.json'), out)

}

if (isMain(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
