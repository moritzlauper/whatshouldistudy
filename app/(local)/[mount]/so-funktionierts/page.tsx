import { localMount } from '@/lib/site/local-mount.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { HowView } from '../../../views/longform.tsx'

export const revalidate = 3600

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, (r) => r.how, (t) => ({ title: t.meta.how, description: t.meta.howDesc }))

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <HowView {...localMount((await params).mount)} />
}
