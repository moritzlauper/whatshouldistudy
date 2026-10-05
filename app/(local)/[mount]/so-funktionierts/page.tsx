import { mountInfo } from '@/lib/site/kit.ts'
import { localMeta } from '@/lib/site/meta.ts'
import { HowView } from '../../../views/longform.tsx'

export const revalidate = 3600

export const generateMetadata = ({ params }: { params: Promise<{ mount: string }> }) => localMeta(params, '/so-funktionierts', (t) => ({ title: t.meta.how, description: t.meta.howDesc }))

export default async function Page({ params }: { params: Promise<{ mount: string }> }) {
  return <HowView {...mountInfo((await params).mount)} />
}
