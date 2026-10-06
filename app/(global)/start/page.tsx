import { pageMeta } from '@/lib/site/meta.ts'
import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { StartView } from '../../views/start.tsx'

const t = dict('en')

export const metadata: Metadata = pageMeta('global', (r) => r.start, { title: t.meta.start, description: t.meta.startDesc })

export default function Start() {
  return <StartView />
}
