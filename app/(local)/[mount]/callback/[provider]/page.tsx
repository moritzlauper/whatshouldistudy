import type { Metadata } from 'next'
import { dict } from '@/lib/site/dict.ts'
import { localMount } from '@/lib/site/local-mount.ts'
import { CallbackView } from '../../../../views/callback.tsx'

export async function generateMetadata({ params }: { params: Promise<{ mount: string; provider: string }> }): Promise<Metadata> {
  const { mount } = await params
  return { title: dict(localMount(mount).locale).meta.connecting, robots: { index: false } }
}

export default async function Callback({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  return <CallbackView provider={provider} />
}
