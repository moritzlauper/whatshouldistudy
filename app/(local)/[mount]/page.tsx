import { chBase } from '@/lib/site/kit.ts'
import { Landing } from '../../views/landing.tsx'

export const revalidate = 3600

export default async function Home({ params }: { params: Promise<{ mount: string }> }) {
  const { mount } = await params
  return <Landing site="ch" base={chBase(mount)} />
}
