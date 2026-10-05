import type { Metadata } from 'next'
import { CallbackClient } from './callback-client.tsx'

export const metadata: Metadata = { title: 'Connecting…', robots: { index: false } }

export default async function Callback({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  return <CallbackClient provider={provider} />
}
