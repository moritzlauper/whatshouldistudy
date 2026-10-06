import { mountInfo } from '@/lib/site/kit.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { Landing } from '../../views/landing.tsx'

export const revalidate = 3600

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, (r) => r.home, () => ({}))

export default async function Home({ params }: { params: Promise<{ mount: string }> }) {
  return <Landing {...mountInfo((await params).mount)} />
}
