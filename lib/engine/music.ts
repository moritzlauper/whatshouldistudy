import type { Big5 } from '../taxonomy/fields.ts'
import type { MusicProfile } from './types.ts'

/**
 * Music taste → the five MUSIC dimensions (Rentfrow, Goldberg & Levitin 2011:
 * Mellow, Unpretentious, Sophisticated, Intense, Contemporary) → small Big Five
 * nudges. Taste–personality links are real but weak (correlations around
 * 0.1–0.2 in large samples), so the result only nudges, and only when the
 * questionnaire hasn't measured personality directly.
 */

type Dim = keyof MusicProfile['dimensions']

const RULES: Array<[RegExp, Dim, number]> = [
  [/classical|baroque|opera|orchestra|chamber|romantic era|early music|choral|symphon|contemporary classical|minimalism|neoclassical|composer/, 'sophisticated', 1],
  [/jazz|bebop|swing|bossa nova|fusion|big band/, 'sophisticated', 1],
  [/blues|world|afrobeat|flamenco|fado|tango|celtic|klezmer|avant.?garde|experimental|ambient|post.?rock|math rock|progressive/, 'sophisticated', 0.6],
  [/folk|singer.?songwriter|acoustic|americana|bluegrass/, 'mellow', 0.6],
  [/soft rock|chill|lo.?fi|lofi|downtempo|soul|r.?b|neo soul|quiet storm|easy listening|bedroom pop|dream pop|indie folk/, 'mellow', 1],
  [/country|schlager|christian|gospel|worship|religious|volksmusik|chanson|latin pop|mariachi|ranchera|banda/, 'unpretentious', 1],
  [/metal|metalcore|deathcore|hardcore|punk|grunge|thrash|doom|black metal|screamo|emo|hard rock|industrial/, 'intense', 1],
  [/rock|alternative|indie rock|garage|shoegaze|post.?punk|new wave/, 'intense', 0.7],
  [/hip.?hop|rap|trap|drill|grime|r&b|reggaeton|dancehall|afrobeats|funk|k.?pop|dance|edm|house|techno|electro|dubstep|drum and bass|dnb|trance|pop/, 'contemporary', 1],
]

export function genresToProfile(genreWeights: Map<string, number>, artists: number): MusicProfile {
  const dims: MusicProfile['dimensions'] = {
    mellow: 0,
    unpretentious: 0,
    sophisticated: 0,
    intense: 0,
    contemporary: 0,
  }
  let total = 0
  for (const [genre, w] of genreWeights) {
    const g = genre.toLowerCase()
    for (const [re, dim, strength] of RULES) {
      if (re.test(g)) {
        dims[dim] += w * strength
        total += w * strength
        break
      }
    }
  }
  if (total > 0) for (const k of Object.keys(dims) as Dim[]) dims[k] = round(dims[k] / total)

  const weights = [...genreWeights.values()]
  const sum = weights.reduce((s, x) => s + x, 0)
  let entropy = 0
  for (const w of weights) {
    const p = w / sum
    if (p > 0) entropy -= p * Math.log(p)
  }
  const diversity = weights.length > 1 ? round(entropy / Math.log(Math.min(weights.length, 40))) : 0

  return {
    dimensions: dims,
    topGenres: [...genreWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([genre, weight]) => ({ genre, weight: round(weight) })),
    diversity: Math.min(1, diversity),
    artists,
  }
}

/** Typical shares in streaming populations; deviations from these drive the nudges. */
const BASELINE: MusicProfile['dimensions'] = {
  mellow: 0.15,
  unpretentious: 0.08,
  sophisticated: 0.07,
  intense: 0.2,
  contemporary: 0.5,
}

/** Weak Big Five z-nudges from music taste. Returns values within about ±0.6. */
export function musicBig5(m: MusicProfile): Partial<Big5> {
  const d = (k: Dim) => m.dimensions[k] - BASELINE[k]
  const out: Partial<Big5> = {
    O: 1.6 * d('sophisticated') + 0.6 * d('intense') + 0.5 * d('mellow') - 0.6 * d('unpretentious') + 0.4 * (m.diversity - 0.6),
    E: 0.7 * d('contemporary') + 0.3 * d('unpretentious') - 0.3 * d('sophisticated'),
    A: 0.5 * d('unpretentious') + 0.4 * d('mellow') - 0.3 * d('intense'),
    C: 0.5 * d('unpretentious') - 0.3 * d('intense'),
  }
  for (const k of Object.keys(out) as Array<keyof Big5>) out[k] = round(Math.max(-0.6, Math.min(0.6, out[k]!)))
  return out
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000
}
