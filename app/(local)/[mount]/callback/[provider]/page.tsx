import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { CallbackView } from '../../../../views/callback.tsx'

export const metadata: Metadata = { title: dict('de-CH').meta.connecting, robots: { index: false } }

export default async function Callback({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  return <CallbackView provider={provider} />
}
