import { accumulate } from '../engine/accumulate.ts'
import { truncate } from '../engine/text.ts'
import type { SignalItem, SourceSummary } from '../engine/types.ts'
import { ApiError, getJson } from './oauth.ts'
import type { Progress } from './oauth.ts'

/**
 * GitHub, by public username: no sign-in needed, everything is public. Your own
 * repositories show what you build (a strong signal: making beats watching),
 * starred repositories what you find interesting. Languages hint at domains:
 * Jupyter and R lean data science, Verilog hardware, GDScript games.
 */

const API = 'https://api.github.com'

const LANGUAGE_HINTS: Record<string, string> = {
  'Jupyter Notebook': 'data science machine learning jupyter',
  R: 'statistics rstudio data analysis',
  Julia: 'scientific computing mathematics',
  MATLAB: 'engineering signal processing matlab',
  Mathematica: 'mathematics physics',
  Fortran: 'scientific computing physics',
  TeX: 'mathematics',
  Verilog: 'verilog fpga',
  VHDL: 'vhdl fpga',
  SystemVerilog: 'verilog chip design',
  Assembly: 'assembly language embedded',
  C: 'embedded systems operating system',
  'C++': 'c++ programming',
  Rust: 'rust programming',
  Go: 'golang backend',
  Haskell: 'haskell',
  OCaml: 'ocaml',
  Python: 'python programming',
  JavaScript: 'javascript web development',
  TypeScript: 'typescript web development',
  HTML: 'web development web design',
  CSS: 'web design',
  Vue: 'frontend web development',
  Svelte: 'frontend web development',
  Swift: 'app development ios',
  Kotlin: 'kotlin app development',
  Dart: 'app development',
  'C#': 'c# programming',
  GDScript: 'godot game development',
  ShaderLab: 'shader game development',
  HLSL: 'shader game development',
  GLSL: 'shader computer graphics',
  Solidity: 'blockchain finance',
  OpenSCAD: '3d printing cad',
  'G-code': 'cnc 3d printing',
  Arduino: 'arduino microcontroller',
  Processing: 'creative coding generative art',
  SuperCollider: 'sound design music production',
  Lua: 'game development scripting',
  Shell: 'linux sysadmin',
  PowerShell: 'sysadmin',
  Dockerfile: 'devops',
  HCL: 'devops cloud computing',
  Nix: 'linux',
  Stan: 'bayesian statistics',
  SAS: 'statistics',
  Prolog: 'logic artificial intelligence',
}

interface Repo {
  name: string
  full_name: string
  description: string | null
  topics?: string[]
  language: string | null
  fork: boolean
  stargazers_count: number
  pushed_at?: string
  created_at?: string
  html_url: string
}

async function pages<T>(url: string, max: number): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; out.length < max; page++) {
    const batch = await getJson<T[]>(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`, undefined, {
      Accept: 'application/vnd.github+json',
    })
    out.push(...batch)
    if (batch.length < 100) break
  }
  return out.slice(0, max)
}

function repoText(r: Repo): string {
  return [
    r.name.replace(/[-_.]/g, ' '),
    r.description ?? '',
    (r.topics ?? []).join(' ').replace(/-/g, ' '),
    r.language ? (LANGUAGE_HINTS[r.language] ?? r.language) : '',
  ].join(' \n ')
}

export async function collectGitHub(username: string, onProgress: Progress = () => {}): Promise<SourceSummary> {
  const user = username.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//, '').split('/')[0]
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(user)) throw new Error('That does not look like a GitHub username.')
  onProgress('Reading your profile')
  let profile: { bio?: string | null; public_repos: number; followers: number }
  try {
    profile = await getJson(`${API}/users/${user}`, undefined, { Accept: 'application/vnd.github+json' })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new Error(`GitHub user "${user}" not found.`)
    if (e instanceof ApiError && e.status === 403) throw new Error('GitHub rate limit reached for your network. Try again in an hour.')
    throw e
  }
  onProgress('Reading your repositories')
  const repos = await pages<Repo>(`${API}/users/${user}/repos?sort=pushed`, 300)
  onProgress('Reading your stars')
  const starred = await pages<Repo>(`${API}/users/${user}/starred`, 300).catch(() => [] as Repo[])

  const items: SignalItem[] = []
  let own = 0
  for (const r of repos) {
    if (!r.fork) own++
    items.push({
      kind: r.fork ? 'fork' : 'repo',
      text: repoText(r),
      label: `${r.fork ? 'Fork' : 'Your repo'}: ${r.name}${r.description ? ` (${truncate(r.description, 50)})` : ''}`,
      // Own work weighs more, and a little more for repos others starred.
      weight: r.fork ? 0.8 : 3 + Math.min(2, Math.log10(1 + r.stargazers_count)),
      time: Date.parse(r.created_at ?? r.pushed_at ?? ''),
      learningPrior: 0.6,
      splitCamel: true,
      url: r.html_url,
    })
  }
  for (const r of starred) {
    items.push({
      kind: 'star',
      text: repoText(r),
      label: `Starred: ${r.full_name}`,
      weight: 1,
      learningPrior: 0.6,
      splitCamel: true,
      url: r.html_url,
    })
  }
  if (profile.bio) items.push({ kind: 'bio', text: profile.bio, label: 'Your GitHub bio', weight: 2 })

  const languages = new Map<string, number>()
  for (const r of repos) if (!r.fork && r.language) languages.set(r.language, (languages.get(r.language) ?? 0) + 1)

  onProgress('Analysing', items.length)
  return accumulate(items, {
    source: 'github',
    label: `GitHub (@${user})`,
    stats: {
      repositories: repos.length,
      ownRepositories: own,
      starred: starred.length,
      topLanguage: [...languages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
    },
    maker: own,
  })
}
