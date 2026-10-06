/**
 * YouTube's own topics (topicDetails.topicCategories, as Wikipedia pages):
 * what YouTube's algorithm files a video or channel under. They are broad and
 * sit on almost every video, so they nudge fields a little instead of being
 * read as words; «Lifestyle (sociology)» is fashion and fitness, not sociology.
 *
 * `group` is what the source report shows («Gesellschaft 30 %»), `boost` is
 * added to the field vector of the item (a strong word match is about 0.7, so
 * these stay hints), `learning`/`entertainment` move the learning prior.
 */

export type YtGroup =
  | 'society'
  | 'politics'
  | 'knowledge'
  | 'business'
  | 'health'
  | 'religion'
  | 'military'
  | 'technology'
  | 'music'
  | 'gaming'
  | 'sport'
  | 'entertainment'
  | 'humour'
  | 'film'
  | 'tv'
  | 'performing-arts'
  | 'lifestyle'
  | 'fashion'
  | 'fitness'
  | 'food'
  | 'hobby'
  | 'pets'
  | 'beauty'
  | 'travel'
  | 'vehicles'

export interface YtTopic {
  group: YtGroup
  boost?: Record<string, number>
  music?: boolean
  learning?: boolean
  entertainment?: boolean
}

const music: YtTopic = { group: 'music', music: true }
const gaming: YtTopic = { group: 'gaming', entertainment: true }
const sport: YtTopic = { group: 'sport', boost: { 'sports-science': 0.06 }, entertainment: true }

export const YT_TOPICS: Record<string, YtTopic> = {
  Music: music,
  'Christian music': music,
  'Classical music': music,
  'Country music': music,
  'Electronic music': music,
  'Hip hop music': music,
  'Independent music': music,
  Jazz: music,
  'Music of Asia': music,
  'Music of Latin America': music,
  'Pop music': music,
  Reggae: music,
  'Rhythm and blues': music,
  'Rock music': music,
  'Soul music': music,
  'Video game culture': gaming,
  'Action game': gaming,
  'Action-adventure game': gaming,
  'Casual game': gaming,
  'Music video game': gaming,
  'Puzzle video game': gaming,
  'Racing video game': gaming,
  'Role-playing video game': gaming,
  'Simulation video game': gaming,
  'Sports game': gaming,
  'Strategy video game': gaming,
  Sport: sport,
  'American football': sport,
  Baseball: sport,
  Basketball: sport,
  Boxing: sport,
  Cricket: sport,
  'Association football': sport,
  Golf: sport,
  'Ice hockey': sport,
  'Mixed martial arts': sport,
  Motorsport: sport,
  'Professional wrestling': sport,
  Tennis: sport,
  Volleyball: sport,
  Entertainment: { group: 'entertainment', entertainment: true },
  Humour: { group: 'humour', entertainment: true },
  Film: { group: 'film', boost: { 'film-production': 0.08 }, entertainment: true },
  'Television program': { group: 'tv', entertainment: true },
  'Performing arts': { group: 'performing-arts', boost: { 'performing-arts': 0.12 } },
  'Lifestyle (sociology)': { group: 'lifestyle' },
  Fashion: { group: 'fashion', boost: { 'fashion-design': 0.12 } },
  'Physical fitness': { group: 'fitness', boost: { 'sports-science': 0.12, nutrition: 0.04 } },
  Food: { group: 'food', boost: { 'culinary-arts': 0.1, nutrition: 0.04 } },
  Hobby: { group: 'hobby' },
  Pet: { group: 'pets', boost: { 'veterinary-medicine': 0.06, zoology: 0.04 } },
  'Physical attractiveness': { group: 'beauty' },
  Technology: { group: 'technology', boost: { 'computer-science': 0.06, 'computer-engineering': 0.04, 'electrical-engineering': 0.03 } },
  Tourism: { group: 'travel', boost: { 'hospitality-tourism': 0.1, geography: 0.04 } },
  Vehicle: { group: 'vehicles', boost: { 'automotive-engineering': 0.1, 'mechanical-engineering': 0.04 } },
  Society: { group: 'society', boost: { sociology: 0.1, 'political-science': 0.03, anthropology: 0.03 } },
  Politics: { group: 'politics', boost: { 'political-science': 0.12, sociology: 0.03 } },
  Business: { group: 'business', boost: { 'business-management': 0.1, economics: 0.05, entrepreneurship: 0.04 } },
  Health: { group: 'health', boost: { medicine: 0.05, 'public-health': 0.05, nutrition: 0.03 } },
  Military: { group: 'military', boost: { history: 0.06, 'political-science': 0.05 } },
  Religion: { group: 'religion', boost: { 'religious-studies': 0.12 } },
  Knowledge: { group: 'knowledge', learning: true },
}

/** Topic names from YouTube's topic URLs (https://en.wikipedia.org/wiki/Hip_hop_music). */
export function ytTopicNames(urls?: string[]): string[] {
  return (urls ?? []).map((u) => decodeURIComponent(u.split('/').pop() ?? '').replace(/_/g, ' '))
}

/** What YouTube's topics say about one item: field hints, music, learning. */
export function ytTopicSignal(names: string[], scale = 1): { boost?: Record<string, number>; music: boolean; learning: boolean; entertainment: boolean; groups: YtGroup[] } {
  const boost: Record<string, number> = {}
  let music = false
  let learning = false
  let entertainment = false
  const groups = new Set<YtGroup>()
  for (const n of names) {
    const t = YT_TOPICS[n]
    if (!t) continue
    groups.add(t.group)
    if (t.music) music = true
    if (t.learning) learning = true
    if (t.entertainment) entertainment = true
    for (const [f, b] of Object.entries(t.boost ?? {})) boost[f] = Math.max(boost[f] ?? 0, b * scale)
  }
  return { boost: Object.keys(boost).length ? boost : undefined, music, learning, entertainment, groups: [...groups] }
}

/** Learning prior from category and topics: an Education video about knowledge is learning, gaming isn't. */
export function learningPriorFrom(categoryLearning: number | undefined, sig: { learning: boolean; entertainment: boolean }): number {
  let p = categoryLearning ?? 0.3
  if (sig.learning) p = Math.max(p, 0.7)
  if (sig.entertainment && !sig.learning) p = Math.min(p, 0.15)
  return p
}
