import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { StartView } from '../../views/start.tsx'

const t = dict('en')

export const metadata: Metadata = { title: t.meta.start, description: t.meta.startDesc, alternates: { canonical: '/start' } }

export default function Start() {
  return <StartView />
}
