import type { Metadata } from 'next'
import { chUrl } from '@/lib/site.ts'
import { dict } from '@/lib/site/dict.ts'
import { StartView } from '../../../views/start.tsx'

const t = dict('de')

export const metadata: Metadata = { title: t.meta.start, description: t.meta.startDesc, alternates: { canonical: chUrl('/start') } }

export default function Start() {
  return <StartView />
}
