import type { Metadata } from 'next'
import { UnlockedClient } from './unlocked-client.tsx'

export const metadata: Metadata = { title: 'Unlocked', robots: { index: false } }

export default function Unlocked() {
  return <UnlockedClient />
}
