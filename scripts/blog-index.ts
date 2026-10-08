import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Rewrites content/blog/index.ts, which imports every post so the site needs no
 * file system at runtime. Run after adding or deleting a post: the weekly
 * Action in the private outreach repo does it after writing one.
 */

const DIR = join(import.meta.dirname, '..', 'content', 'blog')
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
const lines = [
  '// Written by scripts/blog-index.ts: every post in this folder, oldest first.',
  "import type { Post } from '../../lib/blog-check.ts'",
  ...files.map((f, i) => `import p${i} from './${f}' with { type: 'json' }`),
  '',
  `export const POSTS: Post[] = [${files.map((_, i) => `p${i}`).join(', ')}]`,
  '',
]
writeFileSync(join(DIR, 'index.ts'), lines.join('\n'))
console.log(`content/blog/index.ts: ${files.length} posts`)
