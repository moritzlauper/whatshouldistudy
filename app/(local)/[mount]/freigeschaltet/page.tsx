import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { UnlockedView } from '../../../views/unlocked.tsx'

export const metadata: Metadata = { title: dict('de').meta.unlocked, robots: { index: false } }

export default function Freigeschaltet() {
  return <UnlockedView />
}
